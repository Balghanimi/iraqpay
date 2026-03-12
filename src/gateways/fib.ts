/**
 * FIB (First Iraqi Bank) Payment Gateway Adapter
 *
 * Auth: OAuth2 client_credentials (OpenID Connect)
 * Flow: Create payment → get QR code + deep links → user pays in FIB app → webhook
 * Callback: POST webhook to statusCallbackUrl with {id, status}
 *
 * Supports: IQD + USD, refund, cancel
 * Envs: dev (fib.dev.fib.iq), stage (fib.stage.fib.iq), prod (fib.prod.fib.iq)
 */

import axios, { AxiosInstance } from 'axios';
import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  FIBConfig,
  IraqPayError,
  PaymentFailedError,
} from '../types';

const URLS = {
  sandbox: {
    auth: 'https://fib.stage.fib.iq/auth/realms/fib-online-shop/protocol/openid-connect/token',
    payments: 'https://fib.stage.fib.iq/protected/v1/payments',
  },
  production: {
    auth: 'https://fib.prod.fib.iq/auth/realms/fib-online-shop/protocol/openid-connect/token',
    payments: 'https://fib.prod.fib.iq/protected/v1/payments',
  },
};

export class FIBGateway implements PaymentGateway {
  readonly name = 'fib' as const;
  private urls: typeof URLS.sandbox;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private http: AxiosInstance | null = null;

  constructor(
    private config: FIBConfig,
    private sandbox: boolean = true,
  ) {
    this.urls = sandbox ? URLS.sandbox : URLS.production;
  }

  private async authenticate(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    const { data } = await axios.post(this.urls.auth, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!data.access_token) {
      throw new IraqPayError(
        'FIB authentication failed',
        'fib',
        'AUTH_FAILED',
        data,
      );
    }

    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || null;
    this.http = axios.create({
      baseURL: this.urls.payments,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
      },
    });
  }

  private async refreshAuth(): Promise<void> {
    if (!this.refreshToken) {
      return this.authenticate();
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.refreshToken,
      });

      const { data } = await axios.post(this.urls.auth, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (!data.access_token) {
        return this.authenticate();
      }

      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token || this.refreshToken;
      this.http = axios.create({
        baseURL: this.urls.payments,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.accessToken}`,
        },
      });
    } catch {
      return this.authenticate();
    }
  }

  private async ensureAuth(): Promise<AxiosInstance> {
    if (!this.http) {
      await this.authenticate();
    } else {
      await this.refreshAuth();
    }
    return this.http!;
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const http = await this.ensureAuth();

    const body = {
      monetaryValue: {
        amount: params.amount,
        currency: params.currency || 'IQD',
      },
      statusCallbackUrl: params.callbackUrl,
      description: params.description
        ? params.description.substring(0, 50)
        : undefined,
    };

    let data: Record<string, unknown>;
    try {
      const response = await http.post('/', JSON.stringify(body));
      data = response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'FIB payment creation failed';
      throw new PaymentFailedError('fib', message, err);
    }

    return {
      id: data.paymentId as string,
      gateway: 'fib',
      status: 'pending',
      amount: params.amount,
      currency: params.currency || 'IQD',
      orderId: params.orderId,
      qrCode: data.qrCode as string | undefined,
      readableCode: data.readableCode as string | undefined,
      deepLinks: {
        personal: data.personalAppLink as string | undefined,
        business: data.businessAppLink as string | undefined,
        corporate: data.corporateAppLink as string | undefined,
      },
      expiresAt: data.validUntil as string | undefined,
      raw: data,
    };
  }

  async getStatus(paymentId: string): Promise<PaymentStatusResult> {
    const http = await this.ensureAuth();

    const { data } = await http.get(`/${paymentId}/status`);

    return {
      id: paymentId,
      gateway: 'fib',
      status: mapFIBStatus(data.status),
      amount: data.amount?.amount,
      currency: data.amount?.currency,
      paidBy: data.paidBy
        ? { name: data.paidBy.name, identifier: data.paidBy.iban }
        : undefined,
      declineReason: data.decliningReason,
      raw: data,
    };
  }

  async cancel(paymentId: string, _amount?: number): Promise<boolean> {
    const http = await this.ensureAuth();

    try {
      const response = await http.post(`/${paymentId}/cancel`);
      return response.status === 204;
    } catch {
      return false;
    }
  }

  async refund(paymentId: string, _amount?: number): Promise<boolean> {
    const http = await this.ensureAuth();

    try {
      const response = await http.post(`/${paymentId}/refund`);
      return response.status === 202;
    } catch {
      return false;
    }
  }

  async verifyCallback(payload: unknown): Promise<WebhookEvent> {
    // FIB sends POST with { id, status } to statusCallbackUrl
    const data = payload as Record<string, unknown>;

    if (!data || !data.id || !data.status) {
      throw new IraqPayError(
        'Invalid FIB webhook payload. Expected { id, status }',
        'fib',
        'INVALID_CALLBACK',
      );
    }

    return {
      id: data.id as string,
      gateway: 'fib',
      status: mapFIBStatus(data.status as string),
      raw: data,
    };
  }
}

function mapFIBStatus(status: string): PaymentResult['status'] {
  switch (status) {
    case 'PAID':
      return 'paid';
    case 'UNPAID':
      return 'pending';
    case 'DECLINED':
      return 'declined';
    case 'REFUND_REQUESTED':
    case 'REFUNDED':
      return 'refunded';
    default:
      return 'pending';
  }
}
