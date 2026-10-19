import { createApplication } from './app.js';
import { getConfig } from './config.js';

try {
  const config = getConfig();
  const app = await createApplication({ config });
  await app.listen(config.port, config.host);
  console.log(`点餐服务已启动：http://${config.host}:${config.port}`);
} catch (error) {
  console.error('点餐服务启动失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
