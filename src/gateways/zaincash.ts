/**
 * ZainCash Payment Gateway Adapter
 *
 * Auth: JWT (HS256) — merchant secret signs payload
 * Flow: POST /transaction/init → redirect to /transaction/pay?id=
 * Callback: Redirect to callbackUrl?token=JWT (decode with same secret)
 *
 * GOTCHAS:
 * - NO server-to-server webhooks — only redirect callbacks
 * - NO refund API — refunds are manual via ZainCash support
 * - JWT token MUST be URL-encoded before POST
 * - Min amount: 250 IQD
 * - Languages: ar, en, ku
 */

import axios from 'axios';
import * as jose from 'jose';
import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  ZainCashConfig,
  IraqPayError,
  PaymentFailedError,
} from '../types';

const URLS = {
  sandbox: 'https://test.zaincash.iq',
  production: 'https://api.zaincash.iq',
};

export class ZainCashGateway implements PaymentGateway {
  readonly name = 'zaincash' as const;
  private baseUrl: string;
  private secret: Uint8Array;

  private timeout: number;

  constructor(
    private config: ZainCashConfig,
    private sandbox: boolean = true,
    private language: string = 'ar',
    timeout: number = 30000,
  ) {
    this.baseUrl = sandbox ? URLS.sandbox : URLS.production;
    this.secret = new TextEncoder().encode(config.secret);
    this.timeout = timeout;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const amount = params.amount;
    if (amount < 250) {
      throw new IraqPayError(
        'Minimum amount is 250 IQD',
        'zaincash',
        'MIN_AMOUNT',
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      amount,
      serviceType: params.description || 'Payment',
      msisdn: this.config.msisdn,
      orderId: params.orderId,
      redirectUrl: params.callbackUrl || params.successUrl || '',
      iat: now,
      exp: now + 60 * 60 * 4, // 4 hours
    };

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(this.secret);

    const { data } = await axios.post(
      `${this.baseUrl}/transaction/init`,
      new URLSearchParams({
        token: encodeURIComponent(token),
        merchantId: this.config.merchantId,
        lang: this.language,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.timeout,
      },
    );

    if (data.err) {
      throw new PaymentFailedError(
        'zaincash',
        data.err.msg || 'Transaction init failed',
        data,
      );
    }

    const transactionId = data.id;

    return {
      id: transactionId,
      gateway: 'zaincash',
      status: 'pending',
      amount,
      currency: params.currency || 'IQD',
      orderId: params.orderId,
      redirectUrl: `${this.baseUrl}/transaction/pay?id=${transactionId}`,
      raw: data,
    };
  }

  async getStatus(paymentId: string): Promise<PaymentStatusResult> {
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      id: paymentId,
      msisdn: this.config.msisdn,
      iat: now,
      exp: now + 60 * 60 * 4,
    };

    const token = await new jose.SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .sign(this.secret);

    const { data } = await axios.post(
      `${this.baseUrl}/transaction/get`,
      new URLSearchParams({
        token: encodeURIComponent(token),
        merchantId: this.config.merchantId,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.timeout,
      },
    );

    return {
      id: paymentId,
      gateway: 'zaincash',
      status: mapZainCashStatus(data.status),
      raw: data,
    };
  }

  async cancel(_paymentId: string, _amount?: number): Promise<boolean> {
    // ZainCash cancel is available but undocumented
    // For now, throw a descriptive error
    throw new IraqPayError(
      'ZainCash cancel is not reliably supported via API',
      'zaincash',
      'NOT_SUPPORTED',
    );
  }

  async refund(_paymentId: string, _amount?: number): Promise<boolean> {
    throw new IraqPayError(
      'ZainCash does not have a refund API. Contact ZainCash support for manual refunds.',
      'zaincash',
      'NOT_SUPPORTED',
    );
  }

  async verifyCallback(payload: unknown): Promise<WebhookEvent> {
    // payload is the JWT token string from ?token= query parameter
    if (typeof payload !== 'string') {
      throw new IraqPayError(
        'ZainCash callback payload must be the JWT token string from the redirect URL query parameter',
        'zaincash',
        'INVALID_CALLBACK',
      );
    }

    const { payload: decoded } = await jose.jwtVerify(payload, this.secret, {
      algorithms: ['HS256'],
    });

    const data = decoded as Record<string, unknown>;

    return {
      id: data.id as string,
      gateway: 'zaincash',
      status: data.status === 'success' ? 'paid' : 'declined',
      orderId: data.orderid as string | undefined,
      raw: data,
    };
  }
}

function mapZainCashStatus(status: string): PaymentResult['status'] {
  switch (status) {
    case 'completed':
    case 'success':
      return 'paid';
    case 'pending':
    case 'pending_otp':
      return 'pending';
    case 'failed':
      return 'declined';
    case 'cancel':
      return 'cancelled';
    default:
      return 'pending';
  }
}
