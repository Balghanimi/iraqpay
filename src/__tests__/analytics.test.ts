import { Analytics, AnalyticsEvent } from '../analytics';

describe('Analytics', () => {
  let analytics: Analytics;

  beforeEach(() => {
    analytics = new Analytics({ enabled: true, maxSamples: 100 });
  });

  describe('recordSuccess', () => {
    it('should record successful operations', () => {
      analytics.recordSuccess('payment.created', 'zaincash', 150);
      analytics.recordSuccess('payment.created', 'zaincash', 200);
      analytics.recordSuccess('payment.created', 'fib', 100);

      const zc = analytics.getGatewayMetrics('zaincash');
      expect(zc.totalRequests).toBe(2);
      expect(zc.successCount).toBe(2);
      expect(zc.failureCount).toBe(0);
      expect(zc.successRate).toBe(1);
      expect(zc.avgLatencyMs).toBe(175);

      const fib = analytics.getGatewayMetrics('fib');
      expect(fib.totalRequests).toBe(1);
    });
  });

  describe('recordFailure', () => {
    it('should record failed operations with error codes', () => {
      analytics.recordFailure('payment.failed', 'zaincash', 500, 'TIMEOUT', 'Request timed out');
      analytics.recordFailure('payment.failed', 'zaincash', 300, 'TIMEOUT', 'Request timed out');
      analytics.recordFailure('payment.failed', 'zaincash', 200, 'AUTH_FAILED', 'Invalid token');

      const m = analytics.getGatewayMetrics('zaincash');
      expect(m.totalRequests).toBe(3);
      expect(m.failureCount).toBe(3);
      expect(m.successRate).toBe(0);
      expect(m.errorsByCode['TIMEOUT']).toBe(2);
      expect(m.errorsByCode['AUTH_FAILED']).toBe(1);
    });
  });

  describe('percentiles', () => {
    it('should compute p50, p95, p99 correctly', () => {
      for (let i = 1; i <= 100; i++) {
        analytics.recordSuccess('payment.created', 'fib', i);
      }

      const m = analytics.getGatewayMetrics('fib');
      expect(m.p50Ms).toBe(50);
      expect(m.p95Ms).toBe(95);
      expect(m.p99Ms).toBe(99);
      expect(m.minLatencyMs).toBe(1);
      expect(m.maxLatencyMs).toBe(100);
    });
  });

  describe('getMetrics (aggregate)', () => {
    it('should aggregate across all gateways', () => {
      analytics.recordSuccess('payment.created', 'zaincash', 100);
      analytics.recordSuccess('payment.created', 'fib', 80);
      analytics.recordFailure('payment.failed', 'qicard', 200, 'ERR', 'fail');

      const agg = analytics.getMetrics();
      expect(agg.totalRequests).toBe(3);
      expect(agg.totalSuccess).toBe(2);
      expect(agg.totalFailures).toBe(1);
      expect(agg.overallSuccessRate).toBeCloseTo(2 / 3);
      expect(Object.keys(agg.byGateway)).toHaveLength(3);
    });
  });

  describe('event listeners', () => {
    it('should emit events to listeners', () => {
      const events: AnalyticsEvent[] = [];
      analytics.on((e) => events.push(e));

      analytics.recordSuccess('payment.created', 'zaincash', 100);
      analytics.recordFailure('payment.failed', 'fib', 200, 'ERR', 'fail');

      expect(events).toHaveLength(2);
      expect(events[0].type).toBe('payment.created');
      expect(events[0].success).toBe(true);
      expect(events[1].type).toBe('payment.failed');
      expect(events[1].success).toBe(false);
      expect(events[1].error?.code).toBe('ERR');
    });

    it('should remove listeners with off()', () => {
      const events: AnalyticsEvent[] = [];
      const listener = (e: AnalyticsEvent) => events.push(e);
      analytics.on(listener);
      analytics.recordSuccess('payment.created', 'zaincash', 100);
      expect(events).toHaveLength(1);

      analytics.off(listener);
      analytics.recordSuccess('payment.created', 'zaincash', 100);
      expect(events).toHaveLength(1);
    });

    it('should not crash if listener throws', () => {
      analytics.on(() => { throw new Error('boom'); });
      expect(() => analytics.recordSuccess('payment.created', 'zaincash', 100)).not.toThrow();
    });
  });

  describe('disabled analytics', () => {
    it('should not record anything when disabled', () => {
      const disabled = new Analytics({ enabled: false });
      disabled.recordSuccess('payment.created', 'zaincash', 100);
      expect(disabled.getGatewayMetrics('zaincash').totalRequests).toBe(0);
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      analytics.recordSuccess('payment.created', 'zaincash', 100);
      analytics.reset();
      expect(analytics.getMetrics().totalRequests).toBe(0);
    });

    it('should clear a single gateway', () => {
      analytics.recordSuccess('payment.created', 'zaincash', 100);
      analytics.recordSuccess('payment.created', 'fib', 80);
      analytics.resetGateway('zaincash');
      expect(analytics.getGatewayMetrics('zaincash').totalRequests).toBe(0);
      expect(analytics.getGatewayMetrics('fib').totalRequests).toBe(1);
    });
  });

  describe('sliding window', () => {
    it('should evict old samples when maxSamples exceeded', () => {
      const small = new Analytics({ maxSamples: 5 });
      for (let i = 1; i <= 10; i++) {
        small.recordSuccess('payment.created', 'zaincash', i * 100);
      }
      const m = small.getGatewayMetrics('zaincash');
      expect(m.minLatencyMs).toBe(600);
      expect(m.maxLatencyMs).toBe(1000);
    });
  });

  describe('empty gateway', () => {
    it('should return zero metrics for unknown gateway', () => {
      const m = analytics.getGatewayMetrics('nasspay');
      expect(m.totalRequests).toBe(0);
      expect(m.successRate).toBe(0);
      expect(m.p50Ms).toBe(0);
    });
  });
});
