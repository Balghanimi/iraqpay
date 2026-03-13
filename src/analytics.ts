/**
 * IraqPay Analytics & Metrics
 *
 * Event-driven analytics with per-gateway performance metrics.
 * Provides latency percentiles, success/failure rates, and error breakdowns.
 */

import { GatewayName, PaymentResult, PaymentStatusResult, WebhookEvent } from './types';

// ─── Event Types ──────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | 'payment.created'
  | 'payment.failed'
  | 'status.checked'
  | 'status.failed'
  | 'payment.cancelled'
  | 'payment.refunded'
  | 'callback.verified'
  | 'callback.failed'
  | 'circuit.opened'
  | 'circuit.closed'
  | 'circuit.half_open'
  | 'router.fallback';

export interface AnalyticsEvent {
  type: AnalyticsEventType;
  gateway: GatewayName;
  traceId?: string;
  timestamp: number;
  durationMs: number;
  success: boolean;
  error?: { code: string; message: string };
  metadata?: Record<string, unknown>;
}

export type AnalyticsListener = (event: AnalyticsEvent) => void;

// ─── Per-Gateway Metrics ──────────────────────────────────────────────────────

export interface GatewayMetrics {
  gateway: GatewayName;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  avgLatencyMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  errorsByCode: Record<string, number>;
  lastRequestAt: number | null;
  windowStartedAt: number;
}

export interface AggregateMetrics {
  totalRequests: number;
  totalSuccess: number;
  totalFailures: number;
  overallSuccessRate: number;
  byGateway: Record<string, GatewayMetrics>;
  collectedAt: number;
}

// ─── Configuration ────────────────────────────────────────────────────────────

export interface AnalyticsConfig {
  /** Enable analytics collection. Default: true */
  enabled?: boolean;
  /** Max latency samples to keep per gateway (sliding window). Default: 1000 */
  maxSamples?: number;
  /** Event listeners */
  listeners?: AnalyticsListener[];
}

// ─── Analytics Engine ─────────────────────────────────────────────────────────

interface GatewayData {
  latencies: number[];
  successCount: number;
  failureCount: number;
  errorsByCode: Record<string, number>;
  lastRequestAt: number | null;
  windowStartedAt: number;
}

export class Analytics {
  private enabled: boolean;
  private maxSamples: number;
  private listeners: AnalyticsListener[] = [];
  private data: Map<GatewayName, GatewayData> = new Map();

  constructor(config?: AnalyticsConfig) {
    this.enabled = config?.enabled ?? true;
    this.maxSamples = config?.maxSamples ?? 1000;
    if (config?.listeners) {
      this.listeners.push(...config.listeners);
    }
  }

  /** Add an event listener */
  on(listener: AnalyticsListener): void {
    this.listeners.push(listener);
  }

  /** Remove an event listener */
  off(listener: AnalyticsListener): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /** Record a successful operation */
  recordSuccess(
    type: AnalyticsEventType,
    gateway: GatewayName,
    durationMs: number,
    metadata?: Record<string, unknown>,
    traceId?: string,
  ): void {
    if (!this.enabled) return;
    const data = this.getOrCreate(gateway);
    data.successCount++;
    this.addLatency(data, durationMs);
    data.lastRequestAt = Date.now();
    this.emit({ type, gateway, traceId, timestamp: Date.now(), durationMs, success: true, metadata });
  }

  /** Record a failed operation */
  recordFailure(
    type: AnalyticsEventType,
    gateway: GatewayName,
    durationMs: number,
    errorCode: string,
    errorMessage: string,
    metadata?: Record<string, unknown>,
    traceId?: string,
  ): void {
    if (!this.enabled) return;
    const data = this.getOrCreate(gateway);
    data.failureCount++;
    data.errorsByCode[errorCode] = (data.errorsByCode[errorCode] || 0) + 1;
    this.addLatency(data, durationMs);
    data.lastRequestAt = Date.now();
    this.emit({
      type, gateway, traceId, timestamp: Date.now(), durationMs, success: false,
      error: { code: errorCode, message: errorMessage }, metadata,
    });
  }

  /** Emit a non-request event (circuit breaker state changes, router fallbacks) */
  emitEvent(
    type: AnalyticsEventType,
    gateway: GatewayName,
    metadata?: Record<string, unknown>,
    traceId?: string,
  ): void {
    if (!this.enabled) return;
    this.emit({ type, gateway, traceId, timestamp: Date.now(), durationMs: 0, success: true, metadata });
  }

  /** Get metrics for a specific gateway */
  getGatewayMetrics(gateway: GatewayName): GatewayMetrics {
    const data = this.data.get(gateway);
    if (!data) {
      return {
        gateway, totalRequests: 0, successCount: 0, failureCount: 0,
        successRate: 0, avgLatencyMs: 0, p50Ms: 0, p95Ms: 0, p99Ms: 0,
        minLatencyMs: 0, maxLatencyMs: 0, errorsByCode: {},
        lastRequestAt: null, windowStartedAt: Date.now(),
      };
    }
    const total = data.successCount + data.failureCount;
    const sorted = [...data.latencies].sort((a, b) => a - b);
    return {
      gateway,
      totalRequests: total,
      successCount: data.successCount,
      failureCount: data.failureCount,
      successRate: total > 0 ? data.successCount / total : 0,
      avgLatencyMs: sorted.length > 0 ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
      p50Ms: percentile(sorted, 0.5),
      p95Ms: percentile(sorted, 0.95),
      p99Ms: percentile(sorted, 0.99),
      minLatencyMs: sorted.length > 0 ? sorted[0] : 0,
      maxLatencyMs: sorted.length > 0 ? sorted[sorted.length - 1] : 0,
      errorsByCode: { ...data.errorsByCode },
      lastRequestAt: data.lastRequestAt,
      windowStartedAt: data.windowStartedAt,
    };
  }

  /** Get aggregate metrics across all gateways */
  getMetrics(): AggregateMetrics {
    const byGateway: Record<string, GatewayMetrics> = {};
    let totalRequests = 0;
    let totalSuccess = 0;
    let totalFailures = 0;

    for (const gateway of this.data.keys()) {
      const m = this.getGatewayMetrics(gateway);
      byGateway[gateway] = m;
      totalRequests += m.totalRequests;
      totalSuccess += m.successCount;
      totalFailures += m.failureCount;
    }

    return {
      totalRequests,
      totalSuccess,
      totalFailures,
      overallSuccessRate: totalRequests > 0 ? totalSuccess / totalRequests : 0,
      byGateway,
      collectedAt: Date.now(),
    };
  }

  /** Reset all metrics */
  reset(): void {
    this.data.clear();
  }

  /** Reset metrics for a specific gateway */
  resetGateway(gateway: GatewayName): void {
    this.data.delete(gateway);
  }

  private getOrCreate(gateway: GatewayName): GatewayData {
    let d = this.data.get(gateway);
    if (!d) {
      d = {
        latencies: [], successCount: 0, failureCount: 0,
        errorsByCode: {}, lastRequestAt: null, windowStartedAt: Date.now(),
      };
      this.data.set(gateway, d);
    }
    return d;
  }

  private addLatency(data: GatewayData, ms: number): void {
    data.latencies.push(ms);
    if (data.latencies.length > this.maxSamples) {
      data.latencies.shift();
    }
  }

  private emit(event: AnalyticsEvent): void {
    for (const listener of this.listeners) {
      try { listener(event); } catch { /* listener errors should not break SDK */ }
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}
