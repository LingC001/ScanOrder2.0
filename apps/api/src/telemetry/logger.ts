import type { LoggerService } from '@nestjs/common';
import { context, logs, trace } from '@opentelemetry/api';

export function safeMessage(value: unknown): string {
  const text =
    value instanceof Error ? value.message : typeof value === 'string' ? value : '应用事件';
  return text
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[已脱敏]@')
    .replace(/(?:password|authorization|token)\s*[:=]\s*[^\s,;]+/gi, '[已脱敏]');
}

export class JsonLogger implements LoggerService {
  constructor(private readonly scope = '应用') {}

  event(level: string, message: unknown, fields: Record<string, string | number> = {}): void {
    const span = trace.getSpan(context.active())?.spanContext();
    const record = {
      timestamp: new Date().toISOString(),
      level,
      scope: this.scope,
      instanceId: process.env.HARNESS_INSTANCE_ID ?? 'development',
      message: safeMessage(message),
      ...fields,
      ...(span ? { traceId: span.traceId, spanId: span.spanId } : {}),
    };
    const body = JSON.stringify(record);
    process.stdout.write(`${body}\n`);
    if (process.env.HARNESS_INSTANCE_ID)
      logs.getLogger('scanorder').emit({
        body,
        severityText: level.toUpperCase(),
        attributes: { 'harness.instance.id': record.instanceId },
      });
  }

  log(message: unknown): void {
    this.event('info', message);
  }
  error(message: unknown): void {
    this.event('error', message);
  }
  warn(message: unknown): void {
    this.event('warn', message);
  }
  debug(message: unknown): void {
    this.event('debug', message);
  }
  verbose(message: unknown): void {
    this.event('debug', message);
  }
  fatal(message: unknown): void {
    this.event('fatal', message);
  }
}
