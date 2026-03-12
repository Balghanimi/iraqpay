/**
 * IraqPay — Unified Payment SDK for Iraq
 *
 * One SDK for all Iraqi payment gateways:
 * ZainCash, FIB, QiCard, NassPay, and Cash-on-Delivery
 *
 * @example
 * ```typescript
 * const pay = new IraqPay({
 *   gateways: {
 *     zaincash: { msisdn: '...', merchantId: '...', secret: '...' },
 *     fib: { clientId: '...', clientSecret: '...' },
 *   },
 *   sandbox: true,
 * });
 *
 * const payment = await pay.createPayment({
 *   gateway: 'zaincash',
 *   amount: 25000,
 *   orderId: 'order_123',
 *   callbackUrl: 'https://myapp.com/callback',
 * });
 *
 * console.log(payment.redirectUrl); // Redirect user here
 * ```
 */

import {
  IraqPayConfig,
  GatewayName,
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  GatewayNotConfiguredError,
} from './types';
import { ZainCashGateway } from './gateways/zaincash';
import { FIBGateway } from './gateways/fib';
import { QiCardGateway } from './gateways/qicard';
import { NassPayGateway } from './gateways/nasspay';
import { CODGateway } from './gateways/cod';

export class IraqPay {
  private gateways: Map<GatewayName, PaymentGateway> = new Map();
  private defaultGateway?: GatewayName;

  constructor(private config: IraqPayConfig) {
    const sandbox = config.sandbox ?? true;
    const lang = config.language || 'ar';
    this.defaultGateway = config.defaultGateway;

    // Initialize configured gateways
    if (config.gateways.zaincash) {
      this.gateways.set(
        'zaincash',
        new ZainCashGateway(config.gateways.zaincash, sandbox, lang),
      );
    }

    if (config.gateways.fib) {
      this.gateways.set(
        'fib',
        new FIBGateway(config.gateways.fib, sandbox),
      );
    }

    if (config.gateways.qicard) {
      this.gateways.set(
        'qicard',
        new QiCardGateway(config.gateways.qicard, sandbox),
      );
    }

    if (config.gateways.nasspay) {
      this.gateways.set(
        'nasspay',
        new NassPayGateway(config.gateways.nasspay, sandbox),
      );
    }

    if (config.gateways.cod) {
      this.gateways.set('cod', new CODGateway(config.gateways.cod));
    }
  }

  /** Get list of configured gateway names */
  get configuredGateways(): GatewayName[] {
    return Array.from(this.gateways.keys());
  }

  /** Get a specific gateway adapter for direct usage */
  getGateway<T extends PaymentGateway>(name: GatewayName): T {
    const gw = this.gateways.get(name);
    if (!gw) throw new GatewayNotConfiguredError(name);
    return gw as T;
  }

  private resolveGateway(name?: GatewayName): PaymentGateway {
    const gatewayName = name || this.defaultGateway;
    if (!gatewayName) {
      throw new GatewayNotConfiguredError(
        'zaincash' as GatewayName, // placeholder
      );
    }
    const gw = this.gateways.get(gatewayName);
    if (!gw) throw new GatewayNotConfiguredError(gatewayName);
    return gw;
  }

  /**
   * Create a payment — works the same regardless of gateway
   *
   * @example
   * ```typescript
   * const payment = await pay.createPayment({
   *   gateway: 'fib',
   *   amount: 10000,
   *   orderId: 'order_456',
   *   callbackUrl: 'https://myapp.com/webhook',
   * });
   *
   * // FIB returns QR code
   * console.log(payment.qrCode);
   *
   * // ZainCash returns redirect URL
   * console.log(payment.redirectUrl);
   * ```
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const gw = this.resolveGateway(params.gateway);
    return gw.createPayment(params);
  }

  /**
   * Check payment status
   *
   * @param paymentId - The payment/transaction ID returned by createPayment
   * @param gateway - Which gateway to check (required if not using defaultGateway)
   */
  async getStatus(
    paymentId: string,
    gateway?: GatewayName,
  ): Promise<PaymentStatusResult> {
    const gw = this.resolveGateway(gateway);
    return gw.getStatus(paymentId);
  }

  /**
   * Cancel a pending payment
   *
   * @param amount - Optional amount for partial cancellation (QiCard). Omit for full cancel.
   * @returns true if cancelled successfully
   * @throws IraqPayError if gateway doesn't support cancellation
   */
  async cancel(paymentId: string, gateway?: GatewayName, amount?: number): Promise<boolean> {
    const gw = this.resolveGateway(gateway);
    return gw.cancel(paymentId, amount);
  }

  /**
   * Refund a completed payment
   *
   * @param amount - Optional amount for partial refund (QiCard, FIB). Omit for full refund.
   * @returns true if refund initiated successfully
   * @throws IraqPayError if gateway doesn't support refunds (ZainCash, NassPay)
   */
  async refund(paymentId: string, gateway?: GatewayName, amount?: number): Promise<boolean> {
    const gw = this.resolveGateway(gateway);
    return gw.refund(paymentId, amount);
  }

  /**
   * Verify and parse a webhook/callback from a gateway
   *
   * @param payload - For ZainCash: the JWT token string from ?token= query param
   *                  For FIB: the POST body { id, status }
   *                  For QiCard: the POST notification body
   *                  For NassPay: the POST callback body
   * @param gateway - Which gateway sent the callback
   */
  async verifyCallback(
    payload: unknown,
    gateway: GatewayName,
  ): Promise<WebhookEvent> {
    const gw = this.resolveGateway(gateway);
    return gw.verifyCallback(payload);
  }
}
