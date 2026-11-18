import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { root } from './common.mjs';

const require = createRequire(resolve(root, 'apps/web/package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')).href);
const server = await createServer({
  root: resolve(root, 'apps/web'),
  configFile: resolve(root, 'apps/web/vite.config.ts'),
  server: { host: 'localhost', port: Number(process.env.WEB_PORT), strictPort: true },
});
await server.listen();
process.on('message', async (message) => {
  if (message === 'harness:stop') {
    await server.close();
    process.exit(0);
  }
});
process.once('disconnect', async () => {
  await server.close();
  process.exit(0);
});
