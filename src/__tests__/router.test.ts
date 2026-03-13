import { SmartRouter } from '../router';
import { CircuitBreaker } from '../circuit-breaker';
import { Analytics } from '../analytics';
import { CreatePaymentParams, GatewayName } from '../types';

describe('SmartRouter', () => {
  const configured: GatewayName[] = ['zaincash', 'fib', 'qicard'];
  const baseParams: CreatePaymentParams = {
    amount: 10000,
    orderId: 'test_123',
    currency: 'IQD',
  };

  describe('explicit gateway', () => {
    it('should use explicitly specified gateway', () => {
      const router = new SmartRouter({ enabled: true, strategy: 'priority' });
      const result = router.route(baseParams, configured, 'fib');
      expect(result.gateway).toBe('fib');
      expect(result.reason).toBe('explicit');
    });
  });

  describe('priority routing', () => {
    it('should route to highest priority gateway', () => {
      const router = new SmartRouter({
        enabled: true,
        strategy: 'priority',
        rules: {
          zaincash: { priority: 3 },
          fib: { priority: 1 },
          qicard: { priority: 2 },
        },
      });

      const result = router.route(baseParams, configured);
      expect(result.gateway).toBe('fib');
      expect(result.reason).toBe('priority');
    });

    it('should default priority to 10', () => {
      const router = new SmartRouter({
        enabled: true,
        strategy: 'priority',
        rules: { fib: { priority: 5 } },
      });

      const result = router.route(baseParams, configured);
      expect(result.gateway).toBe('fib');
    });
  });

  describe('round-robin routing', () => {
    it('should cycle through gateways', () => {
      const router = new SmartRouter({ enabled: true, strategy: 'round-robin' });

      const g1 = router.route(baseParams, configured).gateway;
      const g2 = router.route(baseParams, configured).gateway;
      const g3 = router.route(baseParams, configured).gateway;
      const g4 = router.route(baseParams, configured).gateway;

      expect(g1).toBe('zaincash');
      expect(g2).toBe('fib');
      expect(g3).toBe('qicard');
      expect(g4).toBe('zaincash');
    });
  });

  describe('lowest-latency routing', () => {
    it('should route to gateway with lowest p50 latency', () => {
      const analytics = new Analytics();
      analytics.recordSuccess('payment.created', 'zaincash', 300);
      analytics.recordSuccess('payment.created', 'fib', 100);
      analytics.recordSuccess('payment.created', 'qicard', 200);

      const router = new SmartRouter(
        { enabled: true, strategy: 'lowest-latency' },
        undefined,
        analytics,
      );

      const result = router.route(baseParams, configured);
      expect(result.gateway).toBe('fib');
      expect(result.reason).toContain('lowest-latency');
    });

    it('should fall back to priority when no analytics data', () => {
      const router = new SmartRouter(
        { enabled: true, strategy: 'lowest-latency' },
      );

      const result = router.route(baseParams, configured);
      expect(result.reason).toBe('priority');
    });
  });

  describe('amount/currency filtering', () => {
    it('should exclude gateways below minAmount', () => {
      const router = new SmartRouter({
        enabled: true,
        strategy: 'priority',
        rules: {
          zaincash: { minAmount: 250, priority: 1 },
          fib: { priority: 2 },
        },
      });

      const result = router.route({ ...baseParams, amount: 100 }, configured);
      expect(result.gateway).toBe('fib');
    });

    it('should exclude gateways above maxAmount', () => {
      const router = new SmartRouter({
        enabled: true,
        strategy: 'priority',
        rules: {
          zaincash: { maxAmount: 5000, priority: 1 },
          fib: { priority: 2 },
        },
      });

      const result = router.route({ ...baseParams, amount: 10000 }, configured);
      expect(result.gateway).toBe('fib');
    });

    it('should filter by supported currencies', () => {
      const router = new SmartRouter({
        enabled: true,
        strategy: 'priority',
        rules: {
          zaincash: { currencies: ['IQD'], priority: 1 },
          fib: { currencies: ['IQD', 'USD'], priority: 2 },
        },
      });

      const result = router.route({ ...baseParams, currency: 'USD' }, configured);
      expect(result.gateway).toBe('fib');
    });
  });

  describe('circuit breaker integration', () => {
    it('should skip gateways with open circuits', () => {
      const cb = new CircuitBreaker({ failureThreshold: 2 });
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');

      const router = new SmartRouter(
        { enabled: true, strategy: 'priority', rules: { zaincash: { priority: 1 }, fib: { priority: 2 } } },
        cb,
      );

      const result = router.route(baseParams, configured);
      expect(result.gateway).toBe('fib');
    });
  });

  describe('fallback chain', () => {
    it('should return fallback gateways excluding failed one', () => {
      const router = new SmartRouter({
        enabled: true,
        fallbackChain: ['zaincash', 'fib', 'qicard'],
      });

      const fallbacks = router.getFallbacks('zaincash', baseParams, configured);
      expect(fallbacks).toEqual(['fib', 'qicard']);
    });

    it('should filter fallbacks by rules', () => {
      const router = new SmartRouter({
        enabled: true,
        fallbackChain: ['zaincash', 'fib', 'qicard'],
        rules: { fib: { currencies: ['USD'] } },
      });

      const fallbacks = router.getFallbacks('zaincash', { ...baseParams, currency: 'IQD' }, configured);
      expect(fallbacks).toEqual(['qicard']);
    });
  });

  describe('no gateway available', () => {
    it('should throw when routing is not enabled and no gateway specified', () => {
      const router = new SmartRouter({ enabled: false });
      expect(() => router.route(baseParams, configured)).toThrow('smart routing is not enabled');
    });

    it('should throw when no candidates match', () => {
      const router = new SmartRouter({
        enabled: true,
        rules: {
          zaincash: { currencies: ['USD'] },
          fib: { currencies: ['USD'] },
          qicard: { currencies: ['USD'] },
        },
      });

      expect(() => router.route({ ...baseParams, currency: 'IQD' }, configured)).toThrow('No gateway available');
    });
  });
});
