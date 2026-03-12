/**
 * QiCard Payment Gateway Adapter (3DS API)
 *
 * Auth: HTTP Basic (username:password) + X-Terminal-Id header
 * Flow: Create payment → redirect user to formUrl (3DS page) → callback
 * Callback: POST to notificationUrl + redirect to finishPaymentUrl
 *
 * Supports: IQD, refund, cancel (with requestId)
 * Sandbox: uat-sandbox-3ds-api.qi.iq
 */

import axios, { AxiosInstance } from 'axios';
import {
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  QiCardConfig,
  IraqPayError,
  PaymentFailedError,
} from '../types';

const URLS = {
  sandbox: 'https://uat-sandbox-3ds-api.qi.iq/api/v1',
  production: 'https://3ds-api.qi.iq/api/v1',
};

export class QiCardGateway implements PaymentGateway {
  readonly name = 'qicard' as const;
  private http: AxiosInstance;

  constructor(
    private config: QiCardConfig,
    private sandbox: boolean = true,
  ) {
    const baseURL = sandbox ? URLS.sandbox : URLS.production;
    const auth = Buffer.from(
      `${config.username}:${config.password}`,
    ).toString('base64');

    this.http = axios.create({
      baseURL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
        'X-Terminal-Id': config.terminalId,
      },
    });
  }

  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    const requestId = params.orderId;

    const body = {
      requestId,
      amount: params.amount,
      currency: params.currency || 'IQD',
      locale: 'en_US',
      finishPaymentUrl: params.successUrl || params.callbackUrl || '',
      notificationUrl: params.callbackUrl || '',
      customerInfo: params.customerInfo
        ? {
            firstName: params.customerInfo.firstName,
            lastName: params.customerInfo.lastName,
            phone: params.customerInfo.phone,
            email: params.customerInfo.email,
          }
        : undefined,
    };

    let data: Record<string, unknown>;
    try {
      const response = await this.http.post('/payment', body);
      data = response.data;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'QiCard payment creation failed';
      throw new PaymentFailedError('qicard', message, err);
    }

    return {
      id: data.paymentId as string,
      gateway: 'qicard',
      status: 'pending',
      amount: params.amount,
      currency: params.currency || 'IQD',
      orderId: params.orderId,
      redirectUrl: data.formUrl as string | undefined,
      raw: data,
    };
  }

  async getStatus(paymentId: string): Promise<PaymentStatusResult> {
    const { data } = await this.http.get(`/payment/${paymentId}/status`);

    return {
      id: paymentId,
      gateway: 'qicard',
      status: mapQiCardStatus(data.status),
      raw: data,
    };
  }

  async cancel(paymentId: string, amount?: number): Promise<boolean> {
    try {
      const { status } = await this.http.post(`/payment/${paymentId}/cancel`, {
        requestId: paymentId,
        ...(amount != null && { amount }),
      });
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }

  async refund(paymentId: string, amount?: number): Promise<boolean> {
    try {
      const { status } = await this.http.post(`/payment/${paymentId}/refund`, {
        requestId: paymentId,
        ...(amount != null && { amount }),
      });
      return status >= 200 && status < 300;
    } catch {
      return false;
    }
  }

  async verifyCallback(payload: unknown): Promise<WebhookEvent> {
    const data = payload as Record<string, unknown>;

    if (!data || !data.paymentId) {
      throw new IraqPayError(
        'Invalid QiCard callback payload',
        'qicard',
        'INVALID_CALLBACK',
      );
    }

    // Always verify with server-side status check (QiCard best practice)
    const statusResult = await this.getStatus(data.paymentId as string);

    return {
      id: data.paymentId as string,
      gateway: 'qicard',
      status: statusResult.status,
      raw: data,
    };
  }
}

function mapQiCardStatus(status: string): PaymentResult['status'] {
  switch (status) {
    case 'SUCCESS':
      return 'paid';
    case 'CREATED':
    case 'FORM_SHOWED':
      return 'pending';
    case 'FAILED':
    case 'AUTHENTICATION_FAILED':
      return 'declined';
    default:
      return 'pending';
  }
}
