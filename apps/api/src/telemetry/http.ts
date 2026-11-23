import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DataSource } from 'typeorm';
import {
  context,
  metrics,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  isSpanContextValid,
} from '@opentelemetry/api';
import { JsonLogger } from './logger.js';

const logger = new JsonLogger('HTTP');
const meter = metrics.getMeter('scanorder.http');
const requests = meter.createCounter('scanorder_http_requests');
const duration = meter.createHistogram('scanorder_http_duration', { unit: 's' });

export function harnessHttp(source: DataSource) {
  return (request: Request, response: Response, next: NextFunction): void => {
    const supplied = request.headers['x-request-id'];
    const requestId =
      typeof supplied === 'string' && /^[a-z0-9_-]{1,64}$/i.test(supplied)
        ? supplied
        : randomUUID();
    const path = request.path;
    const parent = propagation.extract(context.active(), request.headers);
    const span = trace
      .getTracer('scanorder.http')
      .startSpan(
        `业务请求 ${request.method} ${path.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id')}`,
        { kind: SpanKind.INTERNAL },
        parent,
      );
    const active = trace.setSpan(parent, span);
    const start = performance.now();
    response.setHeader('x-request-id', requestId);
    const ids = span.spanContext();
    if (isSpanContextValid(ids))
      response.setHeader('traceparent', `00-${ids.traceId}-${ids.spanId}-01`);
    let finished = false;
    const finish = () =>
      context.with(active, () => {
        if (finished) return;
        finished = true;
        const route = request.route?.path
          ? String(request.route.path)
          : path.startsWith('/api/health/')
            ? path
            : '/unmatched';
        const attributes = {
          'http.route': route,
          'http.request.method': request.method,
          'http.response.status_code': response.statusCode,
        };
        requests.add(1, attributes);
        duration.record((performance.now() - start) / 1000, attributes);
        span.setAttributes(attributes);
        if (response.statusCode >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
        logger.event(response.statusCode >= 500 ? 'error' : 'info', '请求完成', {
          requestId,
          route,
          method: request.method,
          statusCode: response.statusCode,
          durationMs: Math.round(performance.now() - start),
        });
        span.end();
      });
    response.once('finish', finish);
    response.once('close', finish);
    context.with(active, () => {
      if (path === '/api/health/live' && request.method === 'GET') {
        response.json({ status: 'ok' });
        return;
      }
      if (path === '/api/health/ready' && request.method === 'GET') {
        source.query('SELECT 1').then(
          () => response.json({ status: 'ok' }),
          () => response.status(503).json({ status: 'unavailable' }),
        );
        return;
      }
      next();
    });
  };
}
