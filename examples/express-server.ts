/**
 * IraqPay — Express.js Example Server
 *
 * A complete example showing how to integrate all Iraqi payment gateways
 * in an Express app using the IraqPay SDK.
 *
 * Run:
 *   npx ts-node examples/express-server.ts
 *
 * Test:
 *   curl -X POST http://localhost:3000/api/checkout \
 *     -H "Content-Type: application/json" \
 *     -d '{"gateway":"zaincash","amount":5000,"orderId":"test_1"}'
 */

import express from 'express';
import { IraqPay } from '../src';
import {
  createWebhookHandler,
  createCheckoutHandler,
} from '../src/middleware/express';

const app = express();
app.use(express.json());

// ── Initialize IraqPay with all gateways ────────────────────────────────────

// Credentials are resolved from IRAQPAY_* environment variables automatically.
// Set them in your .env file — see .env.example for the full list.
const pay = new IraqPay({
  gateways: {
    zaincash: {}, // resolved from IRAQPAY_ZAINCASH_* env vars
    // fib: {},    // uncomment when you have IRAQPAY_FIB_* env vars set
    cod: {},
  },
  sandbox: process.env.IRAQPAY_SANDBOX !== 'false',
  language: 'ar',
  defaultGateway: 'zaincash',
});

// ── Checkout endpoint ───────────────────────────────────────────────────────

app.post('/api/checkout', createCheckoutHandler(pay));

// ── Webhook handlers for all gateways ───────────────────────────────────────

app.use(
  '/webhooks',
  createWebhookHandler(pay, {
    onEvent: async (event) => {
      console.log('Payment event received:', {
        id: event.id,
        gateway: event.gateway,
        status: event.status,
        orderId: event.orderId,
      });

      // TODO: Update your database here
      // await db.orders.update(event.orderId, { paymentStatus: event.status });
    },
    onError: (error, _req, res) => {
      console.error('Webhook error:', error.message);
      res.status(400).json({ error: error.message });
    },
  }),
);

// ── Manual status check ─────────────────────────────────────────────────────

app.get('/api/payment/:gateway/:id/status', async (req, res) => {
  try {
    const status = await pay.getStatus(
      req.params.id,
      req.params.gateway as any,
    );
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(400).json({ success: false, error: (error as Error).message });
  }
});

// ── List configured gateways ────────────────────────────────────────────────

app.get('/api/gateways', (_req, res) => {
  res.json({
    gateways: pay.configuredGateways,
    sandbox: true,
  });
});

// ── Start server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`IraqPay example server running on http://localhost:${PORT}`);
  console.log(`Configured gateways: ${pay.configuredGateways.join(', ')}`);
  console.log('');
  console.log('Endpoints:');
  console.log('  POST /api/checkout          — Create payment');
  console.log('  GET  /api/gateways          — List gateways');
  console.log('  GET  /api/payment/:gw/:id/status — Check status');
  console.log('  GET  /webhooks/zaincash     — ZainCash callback');
  console.log('  POST /webhooks/fib          — FIB webhook');
  console.log('  POST /webhooks/qicard       — QiCard webhook');
  console.log('  POST /webhooks/nasspay      — NassPay webhook');
});
