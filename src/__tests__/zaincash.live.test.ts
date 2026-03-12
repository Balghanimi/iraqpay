/**
 * ZainCash Live Sandbox Integration Test
 *
 * Uses publicly available test credentials from ZainCash docs.
 * Run with: npx jest zaincash.live --no-cache
 */

import { IraqPay } from '../index';

// Public test credentials (from ZainCash documentation + community repos)
const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: '9647835077893',
      merchantId: '5ffacf6612b5777c6d44266f',
      secret: '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
    },
  },
  sandbox: true,
  language: 'ar',
});

describe('ZainCash Live Sandbox', () => {
  it('should create a payment and get redirect URL', async () => {
    const payment = await pay.createPayment({
      gateway: 'zaincash',
      amount: 1000,
      orderId: `test_${Date.now()}`,
      description: 'IraqPay SDK Test',
      callbackUrl: 'https://example.com/callback',
    });

    console.log('Payment created:', {
      id: payment.id,
      status: payment.status,
      redirectUrl: payment.redirectUrl,
    });

    expect(payment.id).toBeTruthy();
    expect(payment.gateway).toBe('zaincash');
    expect(payment.status).toBe('pending');
    expect(payment.amount).toBe(1000);
    expect(payment.currency).toBe('IQD');
    expect(payment.redirectUrl).toContain('test.zaincash.iq/transaction/pay?id=');
  }, 15000);

  it('should check payment status after creation', async () => {
    const payment = await pay.createPayment({
      gateway: 'zaincash',
      amount: 500,
      orderId: `status_test_${Date.now()}`,
      description: 'Status check test',
      callbackUrl: 'https://example.com/callback',
    });

    const status = await pay.getStatus(payment.id, 'zaincash');

    console.log('Status check:', {
      id: status.id,
      status: status.status,
    });

    expect(status.id).toBe(payment.id);
    expect(status.gateway).toBe('zaincash');
    // Should be pending since no one paid yet
    expect(['pending', 'declined']).toContain(status.status);
  }, 15000);
});
