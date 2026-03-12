import { FIBGateway } from '../gateways/fib';
import { IraqPayError } from '../types';

describe('FIBGateway', () => {
  let gateway: FIBGateway;

  beforeEach(() => {
    gateway = new FIBGateway(
      { clientId: 'test-client', clientSecret: 'test-secret' },
      true,
    );
  });

  it('should have correct name', () => {
    expect(gateway.name).toBe('fib');
  });

  it('should reject invalid callback payload', async () => {
    await expect(gateway.verifyCallback({})).rejects.toThrow(IraqPayError);
    await expect(gateway.verifyCallback(null)).rejects.toThrow(IraqPayError);
  });

  it('should parse valid callback payload', async () => {
    const event = await gateway.verifyCallback({
      id: 'payment-123',
      status: 'PAID',
    });

    expect(event.id).toBe('payment-123');
    expect(event.gateway).toBe('fib');
    expect(event.status).toBe('paid');
  });

  it('should map FIB statuses correctly', async () => {
    const paid = await gateway.verifyCallback({
      id: 't1',
      status: 'PAID',
    });
    expect(paid.status).toBe('paid');

    const declined = await gateway.verifyCallback({
      id: 't2',
      status: 'DECLINED',
    });
    expect(declined.status).toBe('declined');

    const unpaid = await gateway.verifyCallback({
      id: 't3',
      status: 'UNPAID',
    });
    expect(unpaid.status).toBe('pending');
  });
});
