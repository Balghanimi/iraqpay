#!/usr/bin/env node
/**
 * IraqPay — Express Example Server (plain JS, no TypeScript needed)
 *
 * Install:  npm install express
 * Run:      node examples/server.js
 * Test:     curl -X POST http://localhost:3000/api/checkout \
 *             -H "Content-Type: application/json" \
 *             -d '{"gateway":"zaincash","amount":5000,"orderId":"test_1"}'
 */

let express;
try {
  express = require('express');
} catch {
  console.error('Express not installed. Run: npm install express');
  console.error('Or use examples/test-local.js (no Express needed)');
  process.exit(1);
}

const { IraqPay, createWebhookHandler, createCheckoutHandler } = require('../dist');

const app = express();
app.use(express.json());

const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: process.env.ZAINCASH_MSISDN || '9647835077893',
      merchantId: process.env.ZAINCASH_MERCHANT_ID || '5ffacf6612b5777c6d44266f',
      secret: process.env.ZAINCASH_SECRET || '$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS',
    },
    cod: {},
  },
  sandbox: true,
  language: 'ar',
  defaultGateway: 'zaincash',
});

// Checkout
app.post('/api/checkout', createCheckoutHandler(pay));

// Webhooks
app.use('/webhooks', createWebhookHandler(pay, {
  onEvent: async (event) => {
    console.log('Payment event:', { id: event.id, gateway: event.gateway, status: event.status });
  },
  onError: (error, _req, res) => {
    console.error('Webhook error:', error.message);
    res.status(400).json({ error: error.message });
  },
}));

// Status check
app.get('/api/payment/:gateway/:id/status', async (req, res) => {
  try {
    const status = await pay.getStatus(req.params.id, req.params.gateway);
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// List gateways
app.get('/api/gateways', (_req, res) => {
  res.json({ gateways: pay.configuredGateways, sandbox: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\nIraqPay server: http://localhost:${PORT}`);
  console.log(`Gateways: ${pay.configuredGateways.join(', ')}\n`);
  console.log('Endpoints:');
  console.log('  POST /api/checkout              — Create payment');
  console.log('  GET  /api/gateways              — List gateways');
  console.log('  GET  /api/payment/:gw/:id/status — Check status');
  console.log('  GET  /webhooks/zaincash          — ZainCash callback');
  console.log('  POST /webhooks/qicard            — QiCard webhook\n');
  console.log('Try:');
  console.log(`  curl -X POST http://localhost:${PORT}/api/checkout \\`);
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"gateway":"zaincash","amount":5000,"orderId":"test_1"}\'');
});
