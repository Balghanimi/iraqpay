import { QiCardGateway } from '../gateways/qicard';
import { IraqPayError } from '../types';

describe('QiCardGateway', () => {
  let gateway: QiCardGateway;

  beforeEach(() => {
    gateway = new QiCardGateway(
      { username: 'test_user', password: 'test_pass', terminalId: 'term_001' },
      true,
    );
  });

  it('should have correct name', () => {
    expect(gateway.name).toBe('qicard');
  });

  it('should reject invalid callback payload (missing paymentId)', async () => {
    await expect(gateway.verifyCallback({})).rejects.toThrow(IraqPayError);
    await expect(gateway.verifyCallback(null)).rejects.toThrow(IraqPayError);
    await expect(gateway.verifyCallback({ status: 'SUCCESS' })).rejects.toThrow(
      'Invalid QiCard callback payload',
    );
  });

  it('should handle createPayment network failure gracefully', async () => {
    // Sandbox URL won't resolve with fake credentials — should throw PaymentFailedError
    await expect(
      gateway.createPayment({
        amount: 5000,
        orderId: 'qi_test_001',
        callbackUrl: 'https://example.com/callback',
      }),
    ).rejects.toThrow();
  });

  it('should attempt cancel and return false on network error', async () => {
    const result = await gateway.cancel('nonexistent_payment');
    expect(result).toBe(false);
  });

  it('should attempt refund and return false on network error', async () => {
    const result = await gateway.refund('nonexistent_payment');
    expect(result).toBe(false);
  });
});
