/**
 * IraqPay — Unified Payment SDK for Iraq
 *
 * One SDK for ZainCash, FIB, QiCard, NassPay, and Cash-on-Delivery
 *
 * @example
 * ```typescript
 * import { IraqPay } from 'iraqpay';
 *
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
 * ```
 *
 * @packageDocumentation
 */

export { IraqPay } from './iraqpay';

// Types
export type {
  GatewayName,
  IraqPayConfig,
  GatewayConfigs,
  ZainCashConfig,
  FIBConfig,
  QiCardConfig,
  NassPayConfig,
  CODConfig,
  CODStore,
  CODOrderData,
  Currency,
  CreatePaymentParams,
  CustomerInfo,
  PaymentStatus,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  PaymentGateway,
} from './types';

// Errors
export {
  IraqPayError,
  GatewayNotConfiguredError,
  PaymentFailedError,
} from './types';

// Individual gateways (for advanced usage)
export { ZainCashGateway } from './gateways/zaincash';
export { FIBGateway } from './gateways/fib';
export { QiCardGateway } from './gateways/qicard';
export { NassPayGateway } from './gateways/nasspay';
export { CODGateway } from './gateways/cod';

// Express.js middleware
export {
  createWebhookHandler,
  createCheckoutHandler,
} from './middleware/express';
export type {
  WebhookHandlerOptions,
  CheckoutHandlerOptions,
} from './middleware/express';
