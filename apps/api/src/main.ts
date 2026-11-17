import { startApplication } from './app.js';
import { getConfig } from './config/index.js';

try {
  const config = getConfig();
  await startApplication({ config });
  console.log(`点餐服务已启动：http://${config.host}:${config.port}`);
} catch (error) {
  console.error('点餐服务启动失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
