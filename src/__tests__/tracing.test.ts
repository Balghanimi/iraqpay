import { Tracer, TraceContext, ConsoleLogger, LogEntry } from '../tracing';

describe('Tracer', () => {
  describe('TraceContext', () => {
    it('should generate unique trace and span IDs', () => {
      const ctx1 = new TraceContext('createPayment', 'zaincash');
      const ctx2 = new TraceContext('createPayment', 'fib');
      expect(ctx1.traceId).not.toBe(ctx2.traceId);
      expect(ctx1.spanId).not.toBe(ctx2.spanId);
      expect(ctx1.traceId.length).toBe(16);
    });

    it('should create child spans with same trace ID', () => {
      const parent = new TraceContext('createPayment', 'zaincash');
      const child = parent.child('httpRequest', 'zaincash');
      expect(child.traceId).toBe(parent.traceId);
      expect(child.spanId).not.toBe(parent.spanId);
    });

    it('should track elapsed time', async () => {
      const ctx = new TraceContext('test');
      await new Promise((r) => setTimeout(r, 20));
      expect(ctx.elapsed).toBeGreaterThanOrEqual(15);
    });
  });

  describe('Tracer', () => {
    it('should log to custom logger', () => {
      const entries: LogEntry[] = [];
      const logger = { log: (e: LogEntry) => entries.push(e) };

      const tracer = new Tracer({ logger, minLevel: 'debug' });
      const ctx = tracer.startTrace('createPayment', 'zaincash');

      tracer.info('Payment started', ctx, { amount: 1000 });
      tracer.debug('Sending request', ctx);
      tracer.error('Failed', ctx, { code: 'TIMEOUT' });

      expect(entries).toHaveLength(4);
      expect(entries[0].message).toContain('Starting');
      expect(entries[1].level).toBe('info');
      expect(entries[2].level).toBe('debug');
      expect(entries[3].level).toBe('error');
    });

    it('should respect minimum log level', () => {
      const entries: LogEntry[] = [];
      const logger = { log: (e: LogEntry) => entries.push(e) };

      const tracer = new Tracer({ logger, minLevel: 'warn' });
      const ctx = tracer.startTrace('test', 'zaincash');

      tracer.debug('debug msg', ctx);
      tracer.info('info msg', ctx);
      tracer.warn('warn msg', ctx);
      tracer.error('error msg', ctx);

      expect(entries).toHaveLength(2);
      expect(entries[0].level).toBe('warn');
      expect(entries[1].level).toBe('error');
    });

    it('should not log when disabled', () => {
      const entries: LogEntry[] = [];
      const logger = { log: (e: LogEntry) => entries.push(e) };

      const tracer = new Tracer({ enabled: false, logger });
      const ctx = new TraceContext('test');
      tracer.info('should not appear', ctx);

      expect(entries).toHaveLength(0);
    });

    it('should include gateway and operation in log entries', () => {
      const entries: LogEntry[] = [];
      const logger = { log: (e: LogEntry) => entries.push(e) };

      const tracer = new Tracer({ logger, minLevel: 'info' });
      const ctx = tracer.startTrace('createPayment', 'fib');

      expect(entries[0].gateway).toBe('fib');
      expect(entries[0].operation).toBe('createPayment');
      expect(entries[0].traceId).toBe(ctx.traceId);
    });
  });

  describe('ConsoleLogger', () => {
    it('should not throw on any log level', () => {
      const logger = new ConsoleLogger();
      const entry: LogEntry = {
        level: 'info',
        message: 'test',
        traceId: 'abc123',
        spanId: 'def456',
        gateway: 'zaincash',
        operation: 'createPayment',
        durationMs: 100,
        timestamp: Date.now(),
      };

      expect(() => logger.log({ ...entry, level: 'debug' })).not.toThrow();
      expect(() => logger.log({ ...entry, level: 'info' })).not.toThrow();
      expect(() => logger.log({ ...entry, level: 'warn' })).not.toThrow();
      expect(() => logger.log({ ...entry, level: 'error' })).not.toThrow();
    });
  });
});
