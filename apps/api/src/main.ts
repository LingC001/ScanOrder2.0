import { startApplication } from './app.js';
import { getConfig } from './config/index.js';
import { JsonLogger } from './telemetry/logger.js';
import { shutdownTelemetry } from './telemetry/bootstrap.js';

const logger = new JsonLogger('启动');

try {
  const config = getConfig();
  const app = await startApplication({ config });
  logger.log(`点餐服务已启动：http://${config.host}:${config.port}`);
  if (process.env.HARNESS_INSTANCE_ID && process.send) {
    const close = async () => {
      await app.close();
      await shutdownTelemetry();
      process.exit(0);
    };
    process.on('message', (message) => {
      if (message === 'harness:stop') void close();
    });
    process.once('disconnect', () => {
      void close();
    });
  }
} catch (error) {
  logger.error(error);
  await shutdownTelemetry();
  process.exitCode = 1;
}
