/**
 * Cash-on-Delivery (COD) Tracker
 *
 * Not a real payment gateway — provides a unified tracking interface
 * for COD orders so that apps can handle all payment types with one API.
 *
 * Accepts an optional CODStore adapter for persistent storage.
 * Defaults to in-memory Map (fine for testing, not for production).
 */

import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  IraqPayError,
  CODConfig,
  CODStore,
  CODOrderData,
} from '../types';

/** Default in-memory store — data lost on restart */
class InMemoryStore implements CODStore {
  private map = new Map<string, CODOrderData>();

  async get(id: string): Promise<CODOrderData | undefined> {
    return this.map.get(id);
  }

  async set(id: string, data: CODOrderData): Promise<void> {
    this.map.set(id, data);
  }
}

export class CODGateway implements PaymentGateway {
  readonly name = 'cod' as const;
  private store: CODStore;

  constructor(config?: CODConfig) {
    this.store = config?.store ?? new InMemoryStore();
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const id = `cod_${params.orderId}`;

    await this.store.set(id, { status: 'pending', params });

    return {
      id,
      gateway: 'cod',
      status: 'pending',
      amount: params.amount,
      currency: params.currency || 'IQD',
      orderId: params.orderId,
      raw: { type: 'cash_on_delivery', note: 'Collect cash upon delivery' },
    };
  }

  async getStatus(paymentId: string): Promise<PaymentStatusResult> {
    const order = await this.store.get(paymentId);

    return {
      id: paymentId,
      gateway: 'cod',
      status: order?.status || 'pending',
      raw: { stored: !!order },
    };
  }

  /** Mark COD as collected by delivery driver */
  async markPaid(paymentId: string): Promise<boolean> {
    const order = await this.store.get(paymentId);
    if (order) {
      order.status = 'paid';
      await this.store.set(paymentId, order);
      return true;
    }
    return false;
  }

  async cancel(paymentId: string, _amount?: number): Promise<boolean> {
    const order = await this.store.get(paymentId);
    if (order) {
      order.status = 'cancelled';
      await this.store.set(paymentId, order);
      return true;
    }
    return false;
  }

  async refund(_paymentId: string, _amount?: number): Promise<boolean> {
    throw new IraqPayError(
      'COD refunds are handled manually',
      'cod',
      'NOT_SUPPORTED',
    );
  }

  async verifyCallback(payload: unknown): Promise<WebhookEvent> {
    const data = payload as Record<string, unknown>;
    return {
      id: (data.id || '') as string,
      gateway: 'cod',
      status: (data.status as PaymentResult['status']) || 'pending',
      raw: data,
    };
  }
}
