/**
 * NassPay Payment Gateway Adapter
 *
 * Auth: POST /auth/merchant/login → Bearer token
 * Flow: Create transaction → redirect to 3DS URL → callback
 * Callback: POST to notifyUrl
 *
 * GOTCHAS:
 * - Status check only available within 24 hours of transaction
 * - Currency uses ISO numeric: 368 = IQD
 * - Sandbox port: 9746
 */

import axios, { AxiosInstance } from 'axios';
import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  NassPayConfig,
  IraqPayError,
  PaymentFailedError,
} from '../types';

const URLS = {
  sandbox: 'https://uat-gateway.nass.iq:9746',
  production: 'https://gateway.nass.iq:9746',
};

// ISO 4217 numeric currency codes
const CURRENCY_CODES: Record<string, string> = {
  IQD: '368',
  USD: '840',
};

export class NassPayGateway implements PaymentGateway {
  readonly name = 'nasspay' as const;
  private baseUrl: string;
  private accessToken: string | null = null;
  private http: AxiosInstance | null = null;

  constructor(
    private config: NassPayConfig,
    private sandbox: boolean = true,
  ) {
    this.baseUrl = sandbox ? URLS.sandbox : URLS.production;
  }

  private async authenticate(): Promise<void> {
    const { data } = await axios.post(
      `${this.baseUrl}/auth/merchant/login`,
      {
        username: this.config.username,
        password: this.config.password,
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    if (!data.access_token) {
      throw new IraqPayError(
        'NassPay authentication failed',
        'nasspay',
        'AUTH_FAILED',
        data,
      );
    }

    this.accessToken = data.access_token;
    this.http = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  private async ensureAuth(): Promise<AxiosInstance> {
    if (!this.http) {
      await this.authenticate();
    }
    return this.http!;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const http = await this.ensureAuth();
    const currencyCode =
      CURRENCY_CODES[params.currency || 'IQD'] || CURRENCY_CODES.IQD;

    const body = {
      orderId: params.orderId,
      orderDesc: params.description || 'Payment',
      amount: params.amount,
      currency: currencyCode,
      transactionType: '1',
      backRef: params.successUrl || params.callbackUrl || '',
      notifyUrl: params.callbackUrl || '',
    };

    let data: Record<string, unknown>;
    try {
      const response = await http.post('/transaction', body);
      data = response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'NassPay payment creation failed';
      throw new PaymentFailedError('nasspay', message, err);
    }

    const responseData = (data.data || data) as Record<string, unknown>;

    return {
      id: params.orderId,
      gateway: 'nasspay',
      status: 'pending',
      amount: params.amount,
      currency: params.currency || 'IQD',
      orderId: params.orderId,
      redirectUrl: responseData.url as string | undefined,
      raw: data,
    };
  }

  async getStatus(orderId: string): Promise<PaymentStatusResult> {
    const http = await this.ensureAuth();

    const { data } = await http.get(
      `/transaction/${orderId}/checkStatus`,
    );

    return {
      id: orderId,
      gateway: 'nasspay',
      status: mapNassPayStatus(data),
      raw: data,
    };
  }

  async cancel(_paymentId: string): Promise<boolean> {
    throw new IraqPayError(
      'NassPay cancel is not supported via SDK',
      'nasspay',
      'NOT_SUPPORTED',
    );
  }

  async refund(_paymentId: string): Promise<boolean> {
    throw new IraqPayError(
      'NassPay refund is not documented. Contact NassPay support.',
      'nasspay',
      'NOT_SUPPORTED',
    );
  }

  async verifyCallback(payload: unknown): Promise<WebhookEvent> {
    const data = payload as Record<string, unknown>;

    if (!data) {
      throw new IraqPayError(
        'Invalid NassPay callback payload',
        'nasspay',
        'INVALID_CALLBACK',
      );
    }

    const actionCode = data.actionCode as string | undefined;
    const isSuccess = actionCode === '0';

    return {
      id: (data.ORDER || data.orderId || '') as string,
      gateway: 'nasspay',
      status: isSuccess ? 'paid' : 'declined',
      raw: data,
    };
  }
}

function mapNassPayStatus(
  data: Record<string, unknown>,
): PaymentResult['status'] {
  const actionCode = data.actionCode as string | undefined;
  const responseCode = data.responseCode as string | undefined;

  if (actionCode === '0' && responseCode === '00') return 'paid';
  if (actionCode === '0') return 'pending';
  return 'declined';
}
