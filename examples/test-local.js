#!/usr/bin/env node
/**
 * IraqPay — Quick Local Test
 *
 * Run:   node examples/test-local.js
 *
 * Tests ZainCash sandbox (no credentials needed) and COD.
 * No Express required — just Node.js.
 */

const { IraqPay } = require('../dist');

// These are ZainCash's PUBLIC sandbox test credentials (not real secrets).
// For production, always use environment variables — see .env.example.
const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: '9647835077893',
      merchantId: '5ffacf6612b5777c6d44266f',
      secret: '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
    },
    cod: {},
  },
  sandbox: true,
  language: 'ar',
});

async function main() {
  console.log('=== IraqPay Local Test ===\n');
  console.log('Configured gateways:', pay.configuredGateways.join(', '));
  console.log('');

  // ── Test 1: ZainCash sandbox payment ──
  console.log('--- Test 1: ZainCash Payment ---');
  try {
    const zc = await pay.createPayment({
      gateway: 'zaincash',
      amount: 5000,
      orderId: 'test_' + Date.now(),
      description: 'Test payment',
      callbackUrl: 'http://localhost:3000/callback',
    });
    console.log('  Status:', zc.status);
    console.log('  Payment ID:', zc.id);
    console.log('  Redirect URL:', zc.redirectUrl);
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message, '\n');
  }

  // ── Test 2: ZainCash status check ──
  console.log('--- Test 2: ZainCash Status Check ---');
  try {
    const status = await pay.getStatus('69b28bbf4758590b12651610', 'zaincash');
    console.log('  Status:', status.status);
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message, '\n');
  }

  // ── Test 3: COD payment ──
  console.log('--- Test 3: COD Payment ---');
  try {
    const cod = await pay.createPayment({
      gateway: 'cod',
      amount: 25000,
      orderId: 'cod_' + Date.now(),
    });
    console.log('  Status:', cod.status);
    console.log('  Payment ID:', cod.id);

    // Mark as paid
    const codGw = pay.getGateway('cod');
    await codGw.markPaid(cod.id);
    const after = await pay.getStatus(cod.id, 'cod');
    console.log('  After markPaid:', after.status);
    console.log('  PASS\n');
  } catch (e) {
    console.log('  FAIL:', e.message, '\n');
  }

  // ── Test 4: Error handling ──
  console.log('--- Test 4: Unconfigured Gateway Error ---');
  try {
    await pay.createPayment({
      gateway: 'fib',
      amount: 1000,
      orderId: 'err_test',
    });
    console.log('  FAIL: should have thrown\n');
  } catch (e) {
    console.log('  Caught:', e.constructor.name, '-', e.message);
    console.log('  PASS\n');
  }

  console.log('=== All tests done ===');
}

main().catch(console.error);
