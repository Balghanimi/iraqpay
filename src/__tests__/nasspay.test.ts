import { NassPayGateway } from '../gateways/nasspay';
import { IraqPayError } from '../types';

describe('NassPayGateway', () => {
  let gateway: NassPayGateway;

  beforeEach(() => {
    gateway = new NassPayGateway(
      { username: 'test_merchant', password: 'test_pass' },
      true,
    );
  });

  it('should have correct name', () => {
    expect(gateway.name).toBe('nasspay');
  });

  it('should reject invalid callback payload', async () => {
    await expect(gateway.verifyCallback(null)).rejects.toThrow(IraqPayError);
  });

  it('should parse valid callback with actionCode 0 as paid', async () => {
    const event = await gateway.verifyCallback({
      ORDER: 'order_123',
      actionCode: '0',
      responseCode: '00',
    });

    expect(event.id).toBe('order_123');
    expect(event.gateway).toBe('nasspay');
    expect(event.status).toBe('paid');
  });

  it('should parse callback with non-zero actionCode as declined', async () => {
    const event = await gateway.verifyCallback({
      orderId: 'order_456',
      actionCode: '3',
      responseCode: '05',
    });

    expect(event.id).toBe('order_456');
    expect(event.gateway).toBe('nasspay');
    expect(event.status).toBe('declined');
  });

  it('should parse callback with actionCode 0 but missing ORDER/orderId', async () => {
    const event = await gateway.verifyCallback({
      actionCode: '0',
    });

    expect(event.id).toBe('');
    expect(event.status).toBe('paid');
  });

  it('should throw on cancel (not supported)', async () => {
    await expect(gateway.cancel('any_id')).rejects.toThrow(IraqPayError);
    await expect(gateway.cancel('any_id')).rejects.toThrow('not supported');
  });

  it('should throw on refund (not supported)', async () => {
    await expect(gateway.refund('any_id')).rejects.toThrow(IraqPayError);
    await expect(gateway.refund('any_id')).rejects.toThrow('not documented');
  });
});
