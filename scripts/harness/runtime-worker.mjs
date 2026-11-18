import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { freePort, postgres } from '../postgres.mjs';
import { root } from './common.mjs';
import { command, poll, writeJson, assertOwned } from './process.mjs';
import { readState, readSettings, statePath } from './runtime-store.mjs';
import { provision, grafana } from './observe.mjs';
import { removeContainer, stopChild, stopDatabase, recoverRuntime } from './runtime-cleanup.mjs';

const id = process.argv[2];
const state = readState(id);
const directory = resolve(root, '.local/harness/runtimes', id);
const settings = readSettings();
const children = [];
let database;
let stop;
let stopping = false;
const boot = new AbortController();
const requested = new Promise((accept) => {
  stop = () => {
    boot.abort(new Error('实例收到停止请求'));
    accept();
  };
});
const save = () => writeJson(statePath(id), state);
const fail = (error) => {
  state.error = error instanceof Error ? error.message : String(error);
  stop();
};
const control = createServer((request, response) => {
  if (
    request.method !== 'POST' ||
    request.url !== '/stop' ||
    request.headers['x-harness-token'] !== state.ownerToken
  ) {
    response.writeHead(403).end();
    return;
  }
  response.writeHead(202).end();
  stop();
});

function startNode(name, args, env) {
  const child = spawn(process.execPath, [...args, `--harness-instance=${id}`], {
    cwd: root,
    env: { ...process.env, ...env },
    windowsHide: true,
    stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
  });
  children.push(child);
  child.once('error', fail);
  child.once('exit', (code) => {
    if (!stopping) fail(new Error(`${name} 提前退出：${code}`));
  });
  state.processes[name] = child.pid;
  save();
  return child;
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('uncaughtException', fail);
process.on('unhandledRejection', fail);
try {
  state.processes.worker = process.pid;
  await new Promise((accept, reject) => {
    control.once('error', reject);
    control.listen(0, 'localhost', accept);
  });
  state.controlPort = control.address().port;
  save();
  const databasePort = await freePort();
  state.apiPort = await freePort();
  state.webPort = await freePort();
  state.apiUrl = `http://localhost:${state.apiPort}`;
  state.webUrl = `http://localhost:${state.webPort}`;
  state.databaseUrl = `postgresql://scanorder:scanorder@127.0.0.1:${databasePort}/scanorder_test`;
  save();
  await mkdir(resolve(directory, 'uploads'), { recursive: true });
  database = postgres(resolve(directory, 'database'), databasePort).instance;
  await database.initialise();
  await database.start();
  await database.createDatabase('scanorder_test');
  const { createDataSource } = await import(
    pathToFileURL(resolve(root, 'apps/api/dist/database/data-source.js')).href
  );
  const { prepareFoods, importPreparedFoods } = await import(
    pathToFileURL(resolve(root, 'apps/api/dist/import/foods-importer.js')).href
  );
  const source = createDataSource(state.databaseUrl);
  try {
    await source.initialize();
    await source.runMigrations();
    await importPreparedFoods(
      source,
      resolve(directory, 'uploads'),
      await prepareFoods(resolve(root, 'examples/foods.json'), resolve(root, 'examples/images')),
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
  state.phase = 'observability';
  save();
  state.containerId = (
    await command(
      'docker',
      [
        'create',
        '--name',
        `scanorder-h-${id}`,
        '--label',
        `scanorder.harness.owner=${state.ownerToken}`,
        '--memory',
        settings.containerMemory,
        '--cpus',
        settings.containerCpus,
        '-e',
        'GF_SECURITY_ADMIN_PASSWORD',
        '-p',
        '127.0.0.1::3000',
        '-p',
        '127.0.0.1::4318',
        settings.image,
      ],
      { env: { GF_SECURITY_ADMIN_PASSWORD: state.adminPassword }, signal: boot.signal },
    )
  ).trim();
  save();
  await command('docker', ['start', state.containerId]);
  const inspect = JSON.parse(await command('docker', ['inspect', state.containerId]))[0];
  const ports = inspect.NetworkSettings.Ports;
  state.grafanaUrl = `http://localhost:${ports['3000/tcp'][0].HostPort}`;
  state.otlpUrl = `http://localhost:${ports['4318/tcp'][0].HostPort}`;
  save();
  await poll(() => grafana(state, '/api/health', { signal: boot.signal }), {
    timeout: 100000,
    description: 'Grafana 就绪',
    signal: boot.signal,
  });
  state.dataSources = await poll(() => provision(state, { signal: boot.signal }), {
    timeout: 30000,
    signal: boot.signal,
    description: '观测数据源就绪',
  });
  save();
  const env = {
    DATABASE_URL: state.databaseUrl,
    UPLOAD_DIR: resolve(directory, 'uploads'),
    PORT: String(state.apiPort),
    HOST: '127.0.0.1',
    WEB_PORT: String(state.webPort),
    API_PROXY_TARGET: state.apiUrl,
    HARNESS_INSTANCE_ID: id,
    OTEL_EXPORTER_OTLP_ENDPOINT: state.otlpUrl,
    OTEL_BSP_SCHEDULE_DELAY: '500',
    OTEL_TRACES_EXPORTER: 'none',
    OTEL_METRICS_EXPORTER: 'none',
    OTEL_LOGS_EXPORTER: 'none',
  };
  startNode(
    'api',
    [
      '--import',
      pathToFileURL(resolve(root, 'apps/api/dist/telemetry/bootstrap.js')).href,
      resolve(root, 'apps/api/dist/main.js'),
    ],
    env,
  );
  startNode('web', [resolve(root, 'scripts/harness/web-worker.mjs')], env);
  await poll(
    async () => {
      if (state.error) throw Object.assign(new Error(state.error), { fatal: true });
      const [api, web] = await Promise.all([
        fetch(`${state.apiUrl}/api/health/ready`, {
          signal: AbortSignal.any([boot.signal, AbortSignal.timeout(5000)]),
        }),
        fetch(state.webUrl, { signal: AbortSignal.any([boot.signal, AbortSignal.timeout(5000)]) }),
      ]);
      return api.ok && web.ok;
    },
    { timeout: 40000, description: '应用就绪', signal: boot.signal },
  );
  state.phase = 'ready';
  state.readyAt = new Date().toISOString();
  save();
  await requested;
} catch (error) {
  fail(error);
} finally {
  stopping = true;
  state.phase = 'stopping';
  save();
  const errors = [];
  if (state.containerId)
    try {
      const text = await command('docker', ['logs', '--tail', '200', state.containerId], {
        timeout: 3000,
      });
      await writeFile(
        resolve(directory, 'observability.log'),
        text.replaceAll(state.adminPassword, '[已脱敏]'),
        { mode: 0o600 },
      );
    } catch (error) {
      await writeFile(
        resolve(directory, 'observability.log'),
        String(error.stdout ?? '').replaceAll(state.adminPassword, '[已脱敏]'),
        { mode: 0o600 },
      ).catch(() => undefined);
    }
  for (const child of children) await stopChild(child).catch((error) => errors.push(error.message));
  if (database) await stopDatabase(database).catch((error) => errors.push(error.message));
  await removeContainer(state).catch((error) => errors.push(error.message));
  for (const name of ['database', 'uploads'])
    await rm(assertOwned(directory, resolve(directory, name)), {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 200,
    }).catch((error) => errors.push(error.message));
  control.close();
  if (errors.length) {
    state.cleanupWarnings = [...errors];
    try {
      await recoverRuntime(state, { keepWorker: true });
      errors.length = 0;
      if (
        database &&
        (!database.process || database.process.exitCode !== null || database.process.signalCode)
      )
        database.process = undefined;
    } catch (error) {
      errors.push(error.message);
    }
  }
  if (errors.length) state.error = [state.error, ...errors].filter(Boolean).join('；');
  state.cleanupCompleted = errors.length === 0;
  state.phase = state.error ? 'failed' : 'stopped';
  state.stoppedAt = new Date().toISOString();
  save();
  process.exit(state.error ? 1 : 0);
}
