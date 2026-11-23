import { SpanStatusCode, trace } from '@opentelemetry/api';

export function withSpan<T>(name: string, operation: () => Promise<T>): Promise<T> {
  return trace.getTracer('scanorder.business').startActiveSpan(name, async (span) => {
    try {
      return await operation();
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
    }
  });
}
