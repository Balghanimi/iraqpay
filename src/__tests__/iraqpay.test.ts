import { IraqPay, GatewayNotConfiguredError } from '../index';

describe('IraqPay', () => {
  describe('initialization', () => {
    it('should initialize with no gateways', () => {
      const pay = new IraqPay({ gateways: {} });
      expect(pay.configuredGateways).toEqual([]);
    });

    it('should initialize with zaincash gateway', () => {
      const pay = new IraqPay({
        gateways: {
          zaincash: {
            msisdn: '9647835077893',
            merchantId: '5ffacf6612b5777c6d44266f',
            secret:
              '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
          },
        },
        sandbox: true,
      });
      expect(pay.configuredGateways).toContain('zaincash');
    });

    it('should initialize with fib gateway', () => {
      const pay = new IraqPay({
        gateways: {
          fib: {
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        },
        sandbox: true,
      });
      expect(pay.configuredGateways).toContain('fib');
    });

    it('should initialize with multiple gateways', () => {
      const pay = new IraqPay({
        gateways: {
          zaincash: {
            msisdn: '9647835077893',
            merchantId: '5ffacf6612b5777c6d44266f',
            secret: 'test',
          },
          fib: {
            clientId: 'test',
            clientSecret: 'test',
          },
          qicard: {
            username: 'test',
            password: 'test',
            terminalId: 'test',
          },
          cod: {},
        },
        sandbox: true,
      });
      expect(pay.configuredGateways).toHaveLength(4);
      expect(pay.configuredGateways).toContain('zaincash');
      expect(pay.configuredGateways).toContain('fib');
      expect(pay.configuredGateways).toContain('qicard');
      expect(pay.configuredGateways).toContain('cod');
    });
  });

  describe('gateway resolution', () => {
    it('should throw GatewayNotConfiguredError for unconfigured gateway', async () => {
      const pay = new IraqPay({ gateways: {} });

      await expect(
        pay.createPayment({
          gateway: 'zaincash',
          amount: 1000,
          orderId: 'test',
        }),
      ).rejects.toThrow(GatewayNotConfiguredError);
    });

    it('should use defaultGateway when no gateway specified in params', async () => {
      const pay = new IraqPay({
        gateways: { cod: {} },
        defaultGateway: 'cod',
      });

      const result = await pay.createPayment({
        amount: 5000,
        orderId: 'test_order',
      });

      expect(result.gateway).toBe('cod');
    });

    it('should allow getting a specific gateway adapter', () => {
      const pay = new IraqPay({
        gateways: { cod: {} },
      });

      const codGateway = pay.getGateway('cod');
      expect(codGateway.name).toBe('cod');
    });
  });

  describe('COD gateway (unit tests without network)', () => {
    let pay: IraqPay;

    beforeEach(() => {
      pay = new IraqPay({
        gateways: { cod: {} },
        defaultGateway: 'cod',
      });
    });

    it('should create a COD payment', async () => {
      const result = await pay.createPayment({
        amount: 25000,
        orderId: 'cod_test_1',
        description: 'Test order',
      });

      expect(result.id).toBe('cod_cod_test_1');
      expect(result.gateway).toBe('cod');
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(25000);
      expect(result.currency).toBe('IQD');
    });

    it('should get COD payment status', async () => {
      const created = await pay.createPayment({
        amount: 10000,
        orderId: 'cod_status_test',
      });

      const status = await pay.getStatus(created.id, 'cod');
      expect(status.status).toBe('pending');
    });

    it('should cancel COD payment', async () => {
      const created = await pay.createPayment({
        amount: 10000,
        orderId: 'cod_cancel_test',
      });

      const cancelled = await pay.cancel(created.id, 'cod');
      expect(cancelled).toBe(true);

      const status = await pay.getStatus(created.id, 'cod');
      expect(status.status).toBe('cancelled');
    });
  });
});
