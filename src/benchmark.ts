/**
 * IraqPay Benchmark Suite
 *
 * Systematic performance comparison across all configured gateways.
 * Measures latency distributions, success rates, and error patterns.
 * Outputs structured data suitable for academic paper tables and charts.
 */

import { IraqPay } from './iraqpay';
import { GatewayName, CreatePaymentParams, PaymentResult, IraqPayError } from './types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BenchmarkConfig {
  /** Number of iterations per gateway. Default: 10 */
  iterations?: number;
  /** Delay between requests in ms (avoid rate limiting). Default: 500 */
  delayMs?: number;
  /** Payment params template. Amount and orderId are auto-generated if not provided. */
  paymentTemplate?: Partial<CreatePaymentParams>;
  /** Gateways to benchmark. Default: all configured gateways */
  gateways?: GatewayName[];
  /** Callback for progress updates */
  onProgress?: (progress: BenchmarkProgress) => void;
}

export interface BenchmarkProgress {
  gateway: GatewayName;
  iteration: number;
  totalIterations: number;
  status: 'running' | 'success' | 'failure';
  latencyMs?: number;
  error?: string;
}

export interface GatewayBenchmarkResult {
  gateway: GatewayName;
  iterations: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  latencies: number[];
  errors: { code: string; message: string; count: number }[];
  stats: LatencyStats;
}

export interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  median: number;
  p95: number;
  p99: number;
  stdDev: number;
}

export interface BenchmarkReport {
  timestamp: string;
  duration: number;
  gateways: GatewayBenchmarkResult[];
  comparison: ComparisonTable;
  raw: RawBenchmarkEntry[];
}

export interface ComparisonTable {
  headers: string[];
  rows: Record<string, string | number>[];
}

export interface RawBenchmarkEntry {
  gateway: GatewayName;
  iteration: number;
  success: boolean;
  latencyMs: number;
  error?: string;
  timestamp: number;
}

// ─── Benchmark Runner ─────────────────────────────────────────────────────────

export class BenchmarkRunner {
  constructor(private pay: IraqPay) {}

  /**
   * Run benchmarks across all (or specified) gateways.
   *
   * @example
   * ```typescript
   * const runner = new BenchmarkRunner(pay);
   * const report = await runner.run({
   *   iterations: 20,
   *   delayMs: 1000,
   *   onProgress: (p) => console.log(`${p.gateway} ${p.iteration}/${p.totalIterations}`),
   * });
   *
   * console.table(report.comparison.rows);
   * ```
   */
  async run(config?: BenchmarkConfig): Promise<BenchmarkReport> {
    const iterations = config?.iterations ?? 10;
    const delayMs = config?.delayMs ?? 500;
    const gateways = config?.gateways ?? this.pay.configuredGateways;
    const template = config?.paymentTemplate ?? {};
    const onProgress = config?.onProgress;
    const startTime = Date.now();
    const rawEntries: RawBenchmarkEntry[] = [];

    for (const gateway of gateways) {
      for (let i = 0; i < iterations; i++) {
        const params: CreatePaymentParams = {
          amount: template.amount ?? 1000,
          currency: template.currency ?? 'IQD',
          orderId: template.orderId ?? `bench_${gateway}_${i}_${Date.now()}`,
          description: template.description ?? `Benchmark test ${i + 1}`,
          callbackUrl: template.callbackUrl ?? 'https://example.com/callback',
          ...template,
          gateway, // ensure gateway override
        };

        const entry: RawBenchmarkEntry = {
          gateway,
          iteration: i + 1,
          success: false,
          latencyMs: 0,
          timestamp: Date.now(),
        };

        const t0 = Date.now();
        try {
          await this.pay.createPayment(params);
          entry.success = true;
          entry.latencyMs = Date.now() - t0;
          onProgress?.({
            gateway, iteration: i + 1, totalIterations: iterations,
            status: 'success', latencyMs: entry.latencyMs,
          });
        } catch (err: any) {
          entry.latencyMs = Date.now() - t0;
          entry.error = err instanceof IraqPayError
            ? `[${err.code}] ${err.message}`
            : err.message || String(err);
          onProgress?.({
            gateway, iteration: i + 1, totalIterations: iterations,
            status: 'failure', latencyMs: entry.latencyMs, error: entry.error,
          });
        }

        rawEntries.push(entry);

        // Delay between requests
        if (delayMs > 0 && (i < iterations - 1 || gateways.indexOf(gateway) < gateways.length - 1)) {
          await sleep(delayMs);
        }
      }
    }

    const duration = Date.now() - startTime;
    const gatewayResults = gateways.map((g) => this.aggregateGateway(g, rawEntries));
    const comparison = this.buildComparisonTable(gatewayResults);

    return {
      timestamp: new Date(startTime).toISOString(),
      duration,
      gateways: gatewayResults,
      comparison,
      raw: rawEntries,
    };
  }

  /** Format a benchmark report as a markdown table (for papers) */
  static toMarkdown(report: BenchmarkReport): string {
    const lines: string[] = [];
    lines.push(`## IraqPay Gateway Benchmark Report`);
    lines.push(`**Date:** ${report.timestamp}`);
    lines.push(`**Duration:** ${(report.duration / 1000).toFixed(1)}s`);
    lines.push('');

    // Comparison table
    const headers = report.comparison.headers;
    lines.push('| ' + headers.join(' | ') + ' |');
    lines.push('| ' + headers.map(() => '---').join(' | ') + ' |');
    for (const row of report.comparison.rows) {
      lines.push('| ' + headers.map((h) => String(row[h] ?? '')).join(' | ') + ' |');
    }
    lines.push('');

    // Error summary
    for (const gw of report.gateways) {
      if (gw.errors.length > 0) {
        lines.push(`### ${gw.gateway} Errors`);
        for (const err of gw.errors) {
          lines.push(`- ${err.code}: ${err.message} (×${err.count})`);
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /** Export raw data as CSV */
  static toCsv(report: BenchmarkReport): string {
    const lines: string[] = [];
    lines.push('gateway,iteration,success,latency_ms,error,timestamp');
    for (const entry of report.raw) {
      lines.push([
        entry.gateway,
        entry.iteration,
        entry.success,
        entry.latencyMs,
        entry.error ? `"${entry.error.replace(/"/g, '""')}"` : '',
        entry.timestamp,
      ].join(','));
    }
    return lines.join('\n');
  }

  /** Export as JSON (for charts / Python analysis) */
  static toJson(report: BenchmarkReport): string {
    return JSON.stringify(report, null, 2);
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private aggregateGateway(gateway: GatewayName, entries: RawBenchmarkEntry[]): GatewayBenchmarkResult {
    const gwEntries = entries.filter((e) => e.gateway === gateway);
    const successes = gwEntries.filter((e) => e.success);
    const failures = gwEntries.filter((e) => !e.success);
    const latencies = successes.map((e) => e.latencyMs);

    // Aggregate errors
    const errorMap = new Map<string, { message: string; count: number }>();
    for (const f of failures) {
      const key = f.error || 'UNKNOWN';
      const existing = errorMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        errorMap.set(key, { message: key, count: 1 });
      }
    }
    const errors = Array.from(errorMap.entries()).map(([code, { message, count }]) => ({
      code, message, count,
    }));

    return {
      gateway,
      iterations: gwEntries.length,
      successCount: successes.length,
      failureCount: failures.length,
      successRate: gwEntries.length > 0 ? successes.length / gwEntries.length : 0,
      latencies,
      errors,
      stats: computeStats(latencies),
    };
  }

  private buildComparisonTable(results: GatewayBenchmarkResult[]): ComparisonTable {
    const headers = [
      'Gateway', 'N', 'Success%', 'Avg(ms)', 'Med(ms)',
      'P95(ms)', 'P99(ms)', 'Min(ms)', 'Max(ms)', 'StdDev',
    ];

    const rows = results.map((r) => ({
      'Gateway': r.gateway,
      'N': r.iterations,
      'Success%': `${(r.successRate * 100).toFixed(1)}%`,
      'Avg(ms)': r.stats.avg.toFixed(0),
      'Med(ms)': r.stats.median.toFixed(0),
      'P95(ms)': r.stats.p95.toFixed(0),
      'P99(ms)': r.stats.p99.toFixed(0),
      'Min(ms)': r.stats.min.toFixed(0),
      'Max(ms)': r.stats.max.toFixed(0),
      'StdDev': r.stats.stdDev.toFixed(0),
    }));

    return { headers, rows };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeStats(latencies: number[]): LatencyStats {
  if (latencies.length === 0) {
    return { min: 0, max: 0, avg: 0, median: 0, p95: 0, p99: 0, stdDev: 0 };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;
  const variance = sorted.reduce((acc, v) => acc + (v - avg) ** 2, 0) / sorted.length;

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg,
    median: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    p99: percentile(sorted, 0.99),
    stdDev: Math.sqrt(variance),
  };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
