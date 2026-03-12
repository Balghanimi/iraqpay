/**
 * IraqPay — Unified Payment SDK for Iraq
 * Type definitions
 */

// ─── Gateway Identifiers ────────────────────────────────────────────────────

export type GatewayName = 'zaincash' | 'fib' | 'qicard' | 'nasspay' | 'cod';

// ─── Configuration ──────────────────────────────────────────────────────────

export interface ZainCashConfig {
  msisdn: string;
  merchantId: string;
  secret: string;
}

export interface FIBConfig {
  clientId: string;
  clientSecret: string;
}

export interface QiCardConfig {
  username: string;
  password: string;
  terminalId: string;
}

export interface NassPayConfig {
  username: string;
  password: string;
}

export interface CODConfig {
  /** Optional storage adapter for COD order persistence. Defaults to in-memory Map. */
  store?: CODStore;
}

/** Pluggable storage for COD orders. Implement this to persist orders to your database. */
export interface CODStore {
  get(id: string): Promise<CODOrderData | undefined>;
  set(id: string, data: CODOrderData): Promise<void>;
}

export interface CODOrderData {
  status: PaymentStatus;
  params: CreatePaymentParams;
}

export interface GatewayConfigs {
  zaincash?: ZainCashConfig;
  fib?: FIBConfig;
  qicard?: QiCardConfig;
  nasspay?: NassPayConfig;
  cod?: CODConfig;
}

export interface IraqPayConfig {
  gateways: GatewayConfigs;
  sandbox?: boolean;
  language?: 'ar' | 'en' | 'ku';
  defaultGateway?: GatewayName;
  /** Request timeout in milliseconds for all gateway API calls. Default: 30000 (30s) */
  timeout?: number;
}

// ─── Payment Request / Response ─────────────────────────────────────────────

export type Currency = 'IQD' | 'USD';

export interface CreatePaymentParams {
  gateway?: GatewayName;
  amount: number;
  currency?: Currency;
  orderId: string;
  description?: string;
  callbackUrl?: string;
  successUrl?: string;
  failureUrl?: string;
  customerInfo?: CustomerInfo;
}

export interface CustomerInfo {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
}

export type PaymentStatus =
  | 'pending'
  | 'paid'
  | 'declined'
  | 'cancelled'
  | 'refunded'
  | 'expired';

export interface PaymentResult {
  id: string;
  gateway: GatewayName;
  status: PaymentStatus;
  amount: number;
  currency: Currency;
  orderId: string;

  /** URL to redirect user to (ZainCash, QiCard, NassPay) */
  redirectUrl?: string;

  /** Base64 QR code image (FIB) */
  qrCode?: string;

  /** Human-readable payment code (FIB) */
  readableCode?: string;

  /** Mobile deep links (FIB) */
  deepLinks?: {
    personal?: string;
    business?: string;
    corporate?: string;
  };

  /** When the payment expires */
  expiresAt?: string;

  /** Raw gateway response for advanced usage */
  raw: unknown;
}

export interface PaymentStatusResult {
  id: string;
  gateway: GatewayName;
  status: PaymentStatus;
  amount?: number;
  currency?: Currency;
  paidBy?: {
    name?: string;
    identifier?: string;
  };
  declineReason?: string;
  raw: unknown;
}

// ─── Webhook / Callback ─────────────────────────────────────────────────────

export interface WebhookEvent {
  id: string;
  gateway: GatewayName;
  status: PaymentStatus;
  orderId?: string;
  amount?: number;
  currency?: Currency;
  raw: unknown;
}

// ─── Gateway Interface ──────────────────────────────────────────────────────

export interface PaymentGateway {
  readonly name: GatewayName;

  createPayment(params: CreatePaymentParams): Promise<PaymentResult>;
  getStatus(paymentId: string): Promise<PaymentStatusResult>;
  cancel(paymentId: string, amount?: number): Promise<boolean>;
  refund(paymentId: string, amount?: number): Promise<boolean>;
  verifyCallback(payload: unknown): Promise<WebhookEvent>;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export class IraqPayError extends Error {
  constructor(
    message: string,
    public gateway: GatewayName,
    public code: string,
    public raw?: unknown,
  ) {
    super(message);
    this.name = 'IraqPayError';
  }
}

export class GatewayNotConfiguredError extends IraqPayError {
  constructor(gateway: GatewayName) {
    super(
      `Gateway "${gateway}" is not configured. Add it to the gateways config.`,
      gateway,
      'GATEWAY_NOT_CONFIGURED',
    );
    this.name = 'GatewayNotConfiguredError';
  }
}

export class PaymentFailedError extends IraqPayError {
  constructor(gateway: GatewayName, message: string, raw?: unknown) {
    super(message, gateway, 'PAYMENT_FAILED', raw);
    this.name = 'PaymentFailedError';
  }
}
