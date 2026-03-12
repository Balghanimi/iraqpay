import { ZainCashGateway } from '../gateways/zaincash';
import { IraqPayError } from '../types';

// Test credentials (publicly available in ZainCash docs)
const TEST_CONFIG = {
  msisdn: '9647835077893',
  merchantId: '5ffacf6612b5777c6d44266f',
  secret: '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
};

describe('ZainCashGateway', () => {
  let gateway: ZainCashGateway;

  beforeEach(() => {
    gateway = new ZainCashGateway(TEST_CONFIG, true, 'ar');
  });

  it('should have correct name', () => {
    expect(gateway.name).toBe('zaincash');
  });

  it('should reject amounts below 250 IQD', async () => {
    await expect(
      gateway.createPayment({
        amount: 100,
        orderId: 'test',
        callbackUrl: 'https://example.com',
      }),
    ).rejects.toThrow('Minimum amount is 250 IQD');
  });

  it('should throw on refund (not supported)', async () => {
    await expect(gateway.refund('any_id')).rejects.toThrow(IraqPayError);
  });

  it('should throw on cancel (not reliably supported)', async () => {
    await expect(gateway.cancel('any_id')).rejects.toThrow(IraqPayError);
  });

  it('should throw on invalid callback payload', async () => {
    await expect(gateway.verifyCallback(123)).rejects.toThrow(IraqPayError);
  });

  // Integration test — only runs if ZAINCASH_LIVE=1
  const itLive = process.env.ZAINCASH_LIVE ? it : it.skip;

  itLive('should create a payment on sandbox', async () => {
    const result = await gateway.createPayment({
      amount: 1000,
      orderId: `test_${Date.now()}`,
      description: 'SDK Test',
      callbackUrl: 'https://example.com/callback',
    });

    expect(result.id).toBeTruthy();
    expect(result.gateway).toBe('zaincash');
    expect(result.status).toBe('pending');
    expect(result.redirectUrl).toContain('test.zaincash.iq/transaction/pay');
  });
});
