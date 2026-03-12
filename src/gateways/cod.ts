/**
 * Cash-on-Delivery (COD) Tracker
 *
 * Not a real payment gateway — provides a unified tracking interface
 * for COD orders so that apps can handle all payment types with one API.
 */

import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  IraqPayError,
} from '../types';

// In-memory store (replace with your own persistence)
const codOrders = new Map<
  string,
  { status: PaymentResult['status']; params: CreatePaymentParams }
>();

export class CODGateway implements PaymentGateway {
  readonly name = 'cod' as const;

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const id = `cod_${params.orderId}`;

    codOrders.set(id, { status: 'pending', params });

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
    const order = codOrders.get(paymentId);

    return {
      id: paymentId,
      gateway: 'cod',
      status: order?.status || 'pending',
      raw: { stored: !!order },
    };
  }

  /** Mark COD as collected by delivery driver */
  async markPaid(paymentId: string): Promise<boolean> {
    const order = codOrders.get(paymentId);
    if (order) {
      order.status = 'paid';
      return true;
    }
    return false;
  }

  async cancel(paymentId: string): Promise<boolean> {
    const order = codOrders.get(paymentId);
    if (order) {
      order.status = 'cancelled';
      return true;
    }
    return false;
  }

  async refund(_paymentId: string): Promise<boolean> {
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
