import { BenchmarkRunner, BenchmarkReport } from '../benchmark';
import { IraqPay } from '../iraqpay';

describe('BenchmarkRunner', () => {
  let pay: IraqPay;

  beforeEach(() => {
    pay = new IraqPay({
      gateways: {
        cod: {},
      },
      sandbox: true,
      tracing: { enabled: false },
    });
  });

  describe('run()', () => {
    it('should benchmark COD gateway (no network)', async () => {
      const runner = new BenchmarkRunner(pay);
      const report = await runner.run({
        iterations: 5,
        delayMs: 0,
        gateways: ['cod'],
        paymentTemplate: {
          callbackUrl: 'https://example.com/cb',
        },
      });

      expect(report.gateways).toHaveLength(1);
      expect(report.gateways[0].gateway).toBe('cod');
      expect(report.gateways[0].iterations).toBe(5);
      expect(report.gateways[0].successCount).toBe(5);
      expect(report.gateways[0].successRate).toBe(1);
      expect(report.gateways[0].stats.avg).toBeGreaterThanOrEqual(0);
      expect(report.raw).toHaveLength(5);
    });

    it('should report progress via callback', async () => {
      const progress: any[] = [];
      const runner = new BenchmarkRunner(pay);

      await runner.run({
        iterations: 3,
        delayMs: 0,
        gateways: ['cod'],
        onProgress: (p) => progress.push(p),
      });

      expect(progress).toHaveLength(3);
      expect(progress[0].iteration).toBe(1);
      expect(progress[2].iteration).toBe(3);
      expect(progress.every((p: any) => p.status === 'success')).toBe(true);
    });

    it('should handle gateway errors gracefully', async () => {
      const failPay = new IraqPay({
        gateways: {
          zaincash: { msisdn: 'x', merchantId: 'x', secret: 'x' },
        },
        sandbox: true,
        tracing: { enabled: false },
      });

      const runner = new BenchmarkRunner(failPay);
      const report = await runner.run({
        iterations: 2,
        delayMs: 0,
        gateways: ['zaincash'],
        paymentTemplate: {
          callbackUrl: 'https://example.com/cb',
        },
      });

      expect(report.gateways[0].failureCount).toBe(2);
      expect(report.gateways[0].errors.length).toBeGreaterThan(0);
    });
  });

  describe('comparison table', () => {
    it('should build a valid comparison table', async () => {
      const runner = new BenchmarkRunner(pay);
      const report = await runner.run({
        iterations: 3,
        delayMs: 0,
        gateways: ['cod'],
      });

      const table = report.comparison;
      expect(table.headers).toContain('Gateway');
      expect(table.headers).toContain('Success%');
      expect(table.headers).toContain('Avg(ms)');
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]['Gateway']).toBe('cod');
    });
  });

  describe('export formats', () => {
    let report: BenchmarkReport;

    beforeAll(async () => {
      const runner = new BenchmarkRunner(
        new IraqPay({ gateways: { cod: {} }, sandbox: true, tracing: { enabled: false } }),
      );
      report = await runner.run({ iterations: 3, delayMs: 0, gateways: ['cod'] });
    });

    it('should export to markdown', () => {
      const md = BenchmarkRunner.toMarkdown(report);
      expect(md).toContain('## IraqPay Gateway Benchmark Report');
      expect(md).toContain('cod');
      expect(md).toContain('|');
    });

    it('should export to CSV', () => {
      const csv = BenchmarkRunner.toCsv(report);
      const lines = csv.split('\n');
      expect(lines[0]).toBe('gateway,iteration,success,latency_ms,error,timestamp');
      expect(lines).toHaveLength(4);
    });

    it('should export to JSON', () => {
      const json = BenchmarkRunner.toJson(report);
      const parsed = JSON.parse(json);
      expect(parsed.gateways).toHaveLength(1);
      expect(parsed.raw).toHaveLength(3);
    });
  });
});
