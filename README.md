# IraqPay — Unified Payment SDK for Iraq

[![CI](https://github.com/Balghanimi/iraqpay/actions/workflows/ci.yml/badge.svg)](https://github.com/Balghanimi/iraqpay/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/iraqpay.svg)](https://www.npmjs.com/package/iraqpay)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

One SDK for **all** Iraqi payment gateways. Stop writing separate integrations for each gateway.

| Gateway | Auth | Payment Flow | Refund | Status |
|---------|------|-------------|--------|--------|
| **ZainCash** | JWT (HS256) | Web redirect | Manual | Ready |
| **FIB** | OAuth2 | QR code + deep links | API | Ready |
| **QiCard** | Basic Auth | 3DS redirect | API | Ready |
| **NassPay** | Bearer token | 3DS redirect | Manual | Ready |
| **COD** | None | Tracking only | Manual | Ready |

## Security

**Credentials must be stored in environment variables, never in source code.**

- Store all gateway credentials in a `.env` file
- Add `.env` to your `.gitignore` (it is already in ours)
- **Never commit credentials** to version control
- If credentials were ever committed to git, **rotate them immediately** — git history preserves them even after deletion
- Use `.env.example` as your template (contains only placeholder values)

## Install

```bash
npm install iraqpay
```

## Quick Start

**Step 1:** Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

```bash
# .env
IRAQPAY_ZAINCASH_MSISDN=9647XXXXXXXXX
IRAQPAY_ZAINCASH_MERCHANT_ID=your_merchant_id
IRAQPAY_ZAINCASH_SECRET=your_secret

IRAQPAY_FIB_CLIENT_ID=your_client_id
IRAQPAY_FIB_CLIENT_SECRET=your_client_secret
```

**Step 2:** Initialize IraqPay — credentials are resolved from env vars automatically:

```typescript
import { IraqPay } from 'iraqpay';

// Recommended: resolve credentials from IRAQPAY_* environment variables
const pay = IraqPay.fromEnv({
  sandbox: true,
  language: 'ar',
});

// Or specify which gateways to enable:
const pay = IraqPay.fromEnv({
  gateways: ['zaincash', 'fib'],
  sandbox: true,
});

// Or pass an empty config object per gateway (same effect):
const pay = new IraqPay({
  gateways: {
    zaincash: {}, // resolved from IRAQPAY_ZAINCASH_* env vars
    fib: {},      // resolved from IRAQPAY_FIB_* env vars
  },
  sandbox: true,
});
```

**Step 3:** Create a payment — same interface for every gateway:

```typescript
const payment = await pay.createPayment({
  gateway: 'zaincash',
  amount: 25000,
  orderId: 'order_123',
  description: 'Product purchase',
  callbackUrl: 'https://myapp.com/payment/callback',
});

console.log(payment.redirectUrl); // ZainCash, QiCard, NassPay
console.log(payment.qrCode);     // FIB (base64 image)
console.log(payment.deepLinks);  // FIB (personal/business/corporate)
```

### Environment Variable Reference

| Gateway | Variable | Description |
|---------|----------|-------------|
| ZainCash | `IRAQPAY_ZAINCASH_MSISDN` | Merchant wallet phone number |
| ZainCash | `IRAQPAY_ZAINCASH_MERCHANT_ID` | Merchant ID from ZainCash dashboard |
| ZainCash | `IRAQPAY_ZAINCASH_SECRET` | Shared secret for JWT signing |
| FIB | `IRAQPAY_FIB_CLIENT_ID` | OAuth2 client ID |
| FIB | `IRAQPAY_FIB_CLIENT_SECRET` | OAuth2 client secret |
| QiCard | `IRAQPAY_QICARD_USERNAME` | API username |
| QiCard | `IRAQPAY_QICARD_PASSWORD` | API password |
| QiCard | `IRAQPAY_QICARD_TERMINAL_ID` | Terminal identifier |
| NassPay | `IRAQPAY_NASSPAY_USERNAME` | Merchant username |
| NassPay | `IRAQPAY_NASSPAY_PASSWORD` | Merchant password |
| General | `IRAQPAY_SANDBOX` | `true` for test environments |

### Explicit Config (Advanced)

For cases where env vars are not suitable (e.g., multi-tenant), you can still pass credentials directly. The SDK will warn in development if credentials appear hardcoded:

```typescript
const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: tenantConfig.zaincashMsisdn,
      merchantId: tenantConfig.zaincashMerchantId,
      secret: tenantConfig.zaincashSecret,
    },
  },
  sandbox: false,
});
```

## Check Payment Status

```typescript
const status = await pay.getStatus(payment.id, 'zaincash');

if (status.status === 'paid') {
  console.log('Payment received!');
}
```

## Handle Callbacks

```typescript
// Express.js example
app.get('/payment/callback', async (req, res) => {
  // ZainCash sends JWT token as query parameter
  const event = await pay.verifyCallback(req.query.token, 'zaincash');

  if (event.status === 'paid') {
    // Update your order
  }
});

app.post('/payment/webhook', async (req, res) => {
  // FIB sends POST with { id, status }
  const event = await pay.verifyCallback(req.body, 'fib');

  if (event.status === 'paid') {
    // Update your order
  }
  res.sendStatus(200);
});
```

## All Gateways

### ZainCash

```typescript
// Set IRAQPAY_ZAINCASH_MSISDN, IRAQPAY_ZAINCASH_MERCHANT_ID, IRAQPAY_ZAINCASH_SECRET
const pay = IraqPay.fromEnv({ gateways: ['zaincash'], sandbox: true });

const payment = await pay.createPayment({
  gateway: 'zaincash',
  amount: 5000,
  orderId: 'zc_001',
  callbackUrl: 'https://myapp.com/callback',
});

// Redirect user to payment page
res.redirect(payment.redirectUrl);
```

### FIB (First Iraqi Bank)

```typescript
// Set IRAQPAY_FIB_CLIENT_ID, IRAQPAY_FIB_CLIENT_SECRET
const pay = IraqPay.fromEnv({ gateways: ['fib'], sandbox: true });

const payment = await pay.createPayment({
  gateway: 'fib',
  amount: 10000,
  currency: 'IQD', // Also supports 'USD'
  orderId: 'fib_001',
  description: 'Order payment',
  callbackUrl: 'https://myapp.com/webhook',
});

// Show QR code to user
console.log(payment.qrCode);       // base64 image
console.log(payment.readableCode); // manual entry code

// Or redirect to FIB app
console.log(payment.deepLinks?.personal); // fib://...

// Refund (FIB supports this)
await pay.refund(payment.id, 'fib');
```

### QiCard

```typescript
// Set IRAQPAY_QICARD_USERNAME, IRAQPAY_QICARD_PASSWORD, IRAQPAY_QICARD_TERMINAL_ID
const pay = IraqPay.fromEnv({ gateways: ['qicard'], sandbox: true });

const payment = await pay.createPayment({
  gateway: 'qicard',
  amount: 50000,
  orderId: 'qi_001',
  successUrl: 'https://myapp.com/success',
  callbackUrl: 'https://myapp.com/notify',
  customerInfo: {
    firstName: 'Ahmed',
    lastName: 'Ali',
    phone: '9647XXXXXXXXX',
    email: 'ahmed@example.com',
  },
});

// Redirect to 3DS payment page
res.redirect(payment.redirectUrl);
```

### NassPay

```typescript
// Set IRAQPAY_NASSPAY_USERNAME, IRAQPAY_NASSPAY_PASSWORD
const pay = IraqPay.fromEnv({ gateways: ['nasspay'], sandbox: true });

const payment = await pay.createPayment({
  gateway: 'nasspay',
  amount: 15000,
  orderId: 'nass_001',
  description: 'Electronics purchase',
  successUrl: 'https://myapp.com/success',
  callbackUrl: 'https://myapp.com/notify',
});

// Redirect to 3DS page
res.redirect(payment.redirectUrl);
```

### Cash-on-Delivery

```typescript
const pay = new IraqPay({
  gateways: { cod: {} },
});

const payment = await pay.createPayment({
  gateway: 'cod',
  amount: 30000,
  orderId: 'cod_001',
});

// When driver collects cash:
const codGateway = pay.getGateway('cod');
await codGateway.markPaid(payment.id);
```

## Multi-Gateway Setup

```typescript
// Set all IRAQPAY_* env vars in .env, then:
const pay = IraqPay.fromEnv({
  sandbox: true,
  defaultGateway: 'fib',
});

// Uses default gateway (FIB)
await pay.createPayment({ amount: 5000, orderId: 'auto_001' });

// Or specify per-payment
await pay.createPayment({ gateway: 'zaincash', amount: 5000, orderId: 'zc_002' });
```

## Error Handling

```typescript
import { IraqPayError, GatewayNotConfiguredError, PaymentFailedError } from 'iraqpay';

try {
  await pay.createPayment({ gateway: 'zaincash', amount: 100, orderId: 'test' });
} catch (err) {
  if (err instanceof GatewayNotConfiguredError) {
    console.log('Gateway not configured:', err.gateway);
  } else if (err instanceof PaymentFailedError) {
    console.log('Payment failed:', err.message, err.raw);
  } else if (err instanceof IraqPayError) {
    console.log('IraqPay error:', err.code, err.message);
  }
}
```

## Gateway Comparison

| Feature | ZainCash | FIB | QiCard | NassPay | COD |
|---------|----------|-----|--------|---------|-----|
| Payment redirect | Yes | No | Yes (3DS) | Yes (3DS) | No |
| QR code | No | Yes | No | No | No |
| Mobile deep links | No | Yes | No | No | No |
| Webhooks | No | Yes (POST) | Yes (POST) | Yes (POST) | No |
| Refund API | No | Yes | Yes | No | No |
| Cancel API | Limited | Yes | Yes | No | Yes |
| USD support | No | Yes | No | No | N/A |
| Sandbox | Yes | Yes | Yes | Yes | N/A |

## Testing

```bash
# Unit tests (no network required)
npm test

# Integration tests with live sandbox
ZAINCASH_LIVE=1 npm test
```

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT

## Contributing

Pull requests welcome. For major changes, please open an issue first.

## Docs

- [README-AR.md](README-AR.md) — full Arabic documentation
- [Testing Guide (English)](docs/TESTING-GUIDE.md) — how to test locally
- [Testing Guide (Arabic)](docs/TESTING-GUIDE-AR.md) — how to test locally

## Links

- [GitHub](https://github.com/Balghanimi/iraqpay)
- [ZainCash API](https://docs.zaincash.iq)
- [FIB Developer Portal](https://fib.iq/fib-payment-gateway)
- [QiCard Developer Portal](https://developers-gate.qi.iq)
- [Iraqi Payments Docs](https://www.iraqpayments.com)
