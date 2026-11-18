import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chooseState, readSettings } from './runtime-store.mjs';
import { root, isMain } from './common.mjs';

export async function grafana(state, path, options = {}) {
  const response = await fetch(`${state.grafanaUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Basic ${Buffer.from(`admin:${state.adminPassword}`).toString('base64')}`,
      ...options.headers,
    },
    signal: options.signal
      ? AbortSignal.any([options.signal, AbortSignal.timeout(15_000)])
      : AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`观测查询失败：HTTP ${response.status}`);
  return response.json();
}

export async function provision(state, options = {}) {
  const sources = await grafana(state, '/api/datasources', options);
  const uid = (type) => {
    const source = sources.find((item) => item.type === type);
    if (!source) throw new Error(`缺少 ${type} 数据源`);
    return source.uid;
  };
  const dataSources = { metrics: uid('prometheus'), logs: uid('loki'), traces: uid('tempo') };
  const text = readFileSync(resolve(state.workspace, 'infra/observability/dashboard.json'), 'utf8')
    .replaceAll('METRICS_UID', dataSources.metrics)
    .replaceAll('LOGS_UID', dataSources.logs);
  await grafana(state, '/api/dashboards/db', {
    ...options,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ dashboard: JSON.parse(text), overwrite: true }),
  });
  return dataSources;
}

export async function query(state, type, expression) {
  if (!['logs', 'metrics', 'traces', 'trace'].includes(type))
    throw new Error('查询类型必须是 logs、metrics、traces 或 trace');
  const key = type === 'trace' ? 'traces' : type;
  const uid = state.dataSources?.[key];
  if (!uid) throw new Error('实例观测数据源未就绪');
  const prefix = `/api/datasources/proxy/uid/${encodeURIComponent(uid)}`;
  if (type === 'metrics')
    return grafana(
      state,
      `${prefix}/api/v1/query?${new URLSearchParams({ query: expression ?? 'scanorder_http_requests_total' })}`,
    );
  if (type === 'logs')
    return grafana(
      state,
      `${prefix}/loki/api/v1/query_range?${new URLSearchParams({ query: expression ?? '{service_name="scanorder-api"}', limit: '200', since: '1h' })}`,
    );
  if (type === 'traces')
    return grafana(
      state,
      `${prefix}/api/search?${new URLSearchParams({ tags: expression ?? 'service.name=scanorder-api', limit: '100' })}`,
    );
  if (!/^[a-f0-9]{32}$/i.test(expression ?? '')) throw new Error('trace ID 必须是 32 位十六进制');
  return grafana(state, `${prefix}/api/traces/${expression}`, {
    headers: { Accept: 'application/json' },
  });
}

export function assertMetric(result, { max, min } = {}) {
  if (
    (max !== undefined && !Number.isFinite(max)) ||
    (min !== undefined && !Number.isFinite(min)) ||
    (max !== undefined && min !== undefined && min > max)
  )
    throw new Error('指标预算必须是有效数值，且下限不能大于上限');
  const values = result?.data?.result?.map((item) => Number(item.value?.[1])) ?? [];
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('没有可用于断言的指标样本');
  if (max !== undefined && values.some((value) => value > max))
    throw new Error(`指标超过上限 ${max}`);
  if (min !== undefined && values.some((value) => value < min))
    throw new Error(`指标低于下限 ${min}`);
  return values;
}

if (isMain(import.meta.url)) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const [type, id, expression] = args;
  try {
    const result = await query(chooseState(id), type, expression);
    const maxIndex = args.indexOf('--max'),
      minIndex = args.indexOf('--min');
    if (maxIndex >= 0 || minIndex >= 0)
      assertMetric(result, {
        ...(maxIndex >= 0 ? { max: Number(args[maxIndex + 1]) } : {}),
        ...(minIndex >= 0 ? { min: Number(args[minIndex + 1]) } : {}),
      });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(
      `观测失败：${error.message}；等待采集超时配置 ${readSettings(root).telemetryTimeoutMs}ms`,
    );
    process.exitCode = 1;
  }
}
