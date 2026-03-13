import { CircuitBreaker } from '../circuit-breaker';

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({
      enabled: true,
      failureThreshold: 3,
      resetTimeoutMs: 1000,
      halfOpenMaxAttempts: 2,
    });
  });

  describe('closed state', () => {
    it('should allow requests by default', () => {
      expect(cb.isAvailable('zaincash')).toBe(true);
      expect(cb.getStatus('zaincash').state).toBe('closed');
    });

    it('should stay closed below failure threshold', () => {
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(true);
      expect(cb.getStatus('zaincash').state).toBe('closed');
    });

    it('should reset failure count on success', () => {
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');
      cb.recordSuccess('zaincash');
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(true);
    });
  });

  describe('opening the circuit', () => {
    it('should open after reaching failure threshold', () => {
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');
      cb.recordFailure('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(false);
      expect(cb.getStatus('zaincash').state).toBe('open');
    });

    it('should block requests when open', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure('fib');
      expect(cb.isAvailable('fib')).toBe(false);
    });
  });

  describe('half-open recovery', () => {
    it('should transition to half_open after reset timeout', async () => {
      const fastCb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 1,
      });

      fastCb.recordFailure('zaincash');
      fastCb.recordFailure('zaincash');
      expect(fastCb.isAvailable('zaincash')).toBe(false);

      await new Promise((r) => setTimeout(r, 60));
      expect(fastCb.isAvailable('zaincash')).toBe(true);
      expect(fastCb.getStatus('zaincash').state).toBe('half_open');
    });

    it('should close circuit after enough half-open successes', async () => {
      const fastCb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
      });

      fastCb.recordFailure('fib');
      fastCb.recordFailure('fib');
      await new Promise((r) => setTimeout(r, 60));

      fastCb.isAvailable('fib');
      fastCb.recordSuccess('fib');
      fastCb.recordSuccess('fib');
      expect(fastCb.getStatus('fib').state).toBe('closed');
    });

    it('should reopen on failure during half-open', async () => {
      const fastCb = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 50,
        halfOpenMaxAttempts: 2,
      });

      fastCb.recordFailure('qicard');
      fastCb.recordFailure('qicard');
      await new Promise((r) => setTimeout(r, 60));

      fastCb.isAvailable('qicard');
      fastCb.recordFailure('qicard');
      expect(fastCb.getStatus('qicard').state).toBe('open');
    });
  });

  describe('guard()', () => {
    it('should throw when circuit is open', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure('nasspay');
      expect(() => cb.guard('nasspay')).toThrow('circuit is open');
    });

    it('should not throw when circuit is closed', () => {
      expect(() => cb.guard('zaincash')).not.toThrow();
    });
  });

  describe('per-gateway isolation', () => {
    it('should track gateways independently', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(false);
      expect(cb.isAvailable('fib')).toBe(true);
    });
  });

  describe('disabled circuit breaker', () => {
    it('should always allow requests when disabled', () => {
      const disabled = new CircuitBreaker({ enabled: false });
      for (let i = 0; i < 100; i++) disabled.recordFailure('zaincash');
      expect(disabled.isAvailable('zaincash')).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset a single gateway', () => {
      for (let i = 0; i < 3; i++) cb.recordFailure('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(false);
      cb.reset('zaincash');
      expect(cb.isAvailable('zaincash')).toBe(true);
    });

    it('should reset all gateways', () => {
      for (let i = 0; i < 3; i++) {
        cb.recordFailure('zaincash');
        cb.recordFailure('fib');
      }
      cb.resetAll();
      expect(cb.isAvailable('zaincash')).toBe(true);
      expect(cb.isAvailable('fib')).toBe(true);
    });
  });

  describe('per-gateway overrides', () => {
    it('should use gateway-specific thresholds', () => {
      const custom = new CircuitBreaker({
        failureThreshold: 5,
        overrides: {
          zaincash: { failureThreshold: 2 },
        },
      });

      custom.recordFailure('zaincash');
      custom.recordFailure('zaincash');
      expect(custom.isAvailable('zaincash')).toBe(false);

      custom.recordFailure('fib');
      custom.recordFailure('fib');
      expect(custom.isAvailable('fib')).toBe(true);
    });
  });

  describe('getAllStatus', () => {
    it('should return status for all standard gateways', () => {
      const statuses = cb.getAllStatus();
      expect(statuses).toHaveLength(5);
      expect(statuses.map((s) => s.gateway)).toEqual(
        expect.arrayContaining(['zaincash', 'fib', 'qicard', 'nasspay', 'cod']),
      );
    });
  });
});
