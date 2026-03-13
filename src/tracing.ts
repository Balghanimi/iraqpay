/**
 * IraqPay Request Tracing
 *
 * Correlation IDs and structured logging for payment lifecycle tracking.
 * Every payment operation gets a unique trace ID that flows through
 * all related calls, making debugging and auditing straightforward.
 */

import { GatewayName } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  traceId: string;
  spanId: string;
  gateway?: GatewayName;
  operation?: string;
  durationMs?: number;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface Logger {
  log(entry: LogEntry): void;
}

export interface TracingConfig {
  /** Enable tracing. Default: true */
  enabled?: boolean;
  /** Custom logger implementation. Default: console logger */
  logger?: Logger;
  /** Minimum log level. Default: 'info' */
  minLevel?: LogLevel;
  /** Include raw gateway responses in logs. Default: false (privacy) */
  includeRawResponses?: boolean;
}

// ─── Trace Context ────────────────────────────────────────────────────────────

export class TraceContext {
  readonly traceId: string;
  readonly spanId: string;
  readonly gateway?: GatewayName;
  readonly operation: string;
  readonly startTime: number;

  constructor(operation: string, gateway?: GatewayName, traceId?: string) {
    this.traceId = traceId || generateId();
    this.spanId = generateId();
    this.gateway = gateway;
    this.operation = operation;
    this.startTime = Date.now();
  }

  /** Create a child span under the same trace */
  child(operation: string, gateway?: GatewayName): TraceContext {
    const child = new TraceContext(operation, gateway ?? this.gateway, this.traceId);
    return child;
  }

  /** Get elapsed time in ms */
  get elapsed(): number {
    return Date.now() - this.startTime;
  }
}

// ─── Console Logger ───────────────────────────────────────────────────────────

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export class ConsoleLogger implements Logger {
  log(entry: LogEntry): void {
    const prefix = `[IraqPay] [${entry.traceId.slice(0, 8)}]`;
    const gwTag = entry.gateway ? ` [${entry.gateway}]` : '';
    const opTag = entry.operation ? ` ${entry.operation}` : '';
    const dur = entry.durationMs !== undefined ? ` (${entry.durationMs}ms)` : '';
    const msg = `${prefix}${gwTag}${opTag}${dur} ${entry.message}`;

    switch (entry.level) {
      case 'debug': console.debug(msg); break;
      case 'info': console.info(msg); break;
      case 'warn': console.warn(msg); break;
      case 'error': console.error(msg, entry.data || ''); break;
    }
  }
}

// ─── Tracer ───────────────────────────────────────────────────────────────────

export class Tracer {
  private enabled: boolean;
  private logger: Logger;
  private minLevel: number;
  readonly includeRawResponses: boolean;

  constructor(config?: TracingConfig) {
    this.enabled = config?.enabled ?? true;
    this.logger = config?.logger ?? new ConsoleLogger();
    this.minLevel = LOG_LEVELS[config?.minLevel ?? 'info'];
    this.includeRawResponses = config?.includeRawResponses ?? false;
  }

  /** Start a new trace for an operation */
  startTrace(operation: string, gateway?: GatewayName): TraceContext {
    const ctx = new TraceContext(operation, gateway);
    this.log('info', `Starting ${operation}`, ctx);
    return ctx;
  }

  /** Log at a specific level */
  log(
    level: LogLevel,
    message: string,
    ctx: TraceContext,
    data?: Record<string, unknown>,
  ): void {
    if (!this.enabled) return;
    if (LOG_LEVELS[level] < this.minLevel) return;

    this.logger.log({
      level,
      message,
      traceId: ctx.traceId,
      spanId: ctx.spanId,
      gateway: ctx.gateway,
      operation: ctx.operation,
      durationMs: ctx.elapsed,
      timestamp: Date.now(),
      data,
    });
  }

  debug(message: string, ctx: TraceContext, data?: Record<string, unknown>): void {
    this.log('debug', message, ctx, data);
  }

  info(message: string, ctx: TraceContext, data?: Record<string, unknown>): void {
    this.log('info', message, ctx, data);
  }

  warn(message: string, ctx: TraceContext, data?: Record<string, unknown>): void {
    this.log('warn', message, ctx, data);
  }

  error(message: string, ctx: TraceContext, data?: Record<string, unknown>): void {
    this.log('error', message, ctx, data);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a random hex ID (16 chars) */
function generateId(): string {
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    // Fallback for Node < 19
    for (let i = 0; i < 8; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
