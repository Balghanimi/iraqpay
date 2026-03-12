import { CODGateway } from '../gateways/cod';
import { IraqPayError, CODStore, CODOrderData } from '../types';

describe('CODGateway', () => {
  let gateway: CODGateway;

  beforeEach(() => {
    gateway = new CODGateway();
  });

  it('should have correct name', () => {
    expect(gateway.name).toBe('cod');
  });

  it('should create a COD payment with correct id format', async () => {
    const result = await gateway.createPayment({
      amount: 15000,
      orderId: 'test_001',
    });

    expect(result.id).toBe('cod_test_001');
    expect(result.gateway).toBe('cod');
    expect(result.status).toBe('pending');
    expect(result.amount).toBe(15000);
    expect(result.currency).toBe('IQD');
    expect(result.redirectUrl).toBeUndefined();
    expect(result.qrCode).toBeUndefined();
  });

  it('should get status of existing payment', async () => {
    const created = await gateway.createPayment({
      amount: 10000,
      orderId: 'status_test',
    });

    const status = await gateway.getStatus(created.id);
    expect(status.status).toBe('pending');
    expect(status.gateway).toBe('cod');
  });

  it('should return pending for non-existent payment', async () => {
    const status = await gateway.getStatus('cod_nonexistent');
    expect(status.status).toBe('pending');
  });

  it('should mark payment as paid', async () => {
    const created = await gateway.createPayment({
      amount: 20000,
      orderId: 'mark_paid_test',
    });

    const marked = await gateway.markPaid(created.id);
    expect(marked).toBe(true);

    const status = await gateway.getStatus(created.id);
    expect(status.status).toBe('paid');
  });

  it('should return false when marking non-existent payment as paid', async () => {
    const result = await gateway.markPaid('cod_nonexistent');
    expect(result).toBe(false);
  });

  it('should cancel a pending payment', async () => {
    const created = await gateway.createPayment({
      amount: 8000,
      orderId: 'cancel_test',
    });

    const cancelled = await gateway.cancel(created.id);
    expect(cancelled).toBe(true);

    const status = await gateway.getStatus(created.id);
    expect(status.status).toBe('cancelled');
  });

  it('should return false when cancelling non-existent payment', async () => {
    const result = await gateway.cancel('cod_nonexistent');
    expect(result).toBe(false);
  });

  it('should throw on refund (manual only)', async () => {
    await expect(gateway.refund('any_id')).rejects.toThrow(IraqPayError);
    await expect(gateway.refund('any_id')).rejects.toThrow('manually');
  });

  it('should handle verifyCallback', async () => {
    const event = await gateway.verifyCallback({
      id: 'cod_order_1',
      status: 'paid',
    });

    expect(event.id).toBe('cod_order_1');
    expect(event.gateway).toBe('cod');
    expect(event.status).toBe('paid');
  });

  it('should respect USD currency', async () => {
    const result = await gateway.createPayment({
      amount: 50,
      orderId: 'usd_test',
      currency: 'USD',
    });

    expect(result.currency).toBe('USD');
  });
});

describe('CODGateway with custom store', () => {
  it('should use provided store adapter', async () => {
    const store: Record<string, CODOrderData> = {};
    const customStore: CODStore = {
      get: async (id) => store[id],
      set: async (id, data) => { store[id] = data; },
    };

    const gateway = new CODGateway({ store: customStore });

    await gateway.createPayment({
      amount: 5000,
      orderId: 'custom_store_test',
    });

    expect(store['cod_custom_store_test']).toBeDefined();
    expect(store['cod_custom_store_test'].status).toBe('pending');

    await gateway.markPaid('cod_custom_store_test');
    expect(store['cod_custom_store_test'].status).toBe('paid');
  });
});
