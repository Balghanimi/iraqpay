# IraqPay — Unified Payment SDK for Iraq

One SDK for **all** Iraqi payment gateways. Stop writing separate integrations for each gateway.

| Gateway | Auth | Payment Flow | Refund | Status |
|---------|------|-------------|--------|--------|
| **ZainCash** | JWT (HS256) | Web redirect | Manual | Ready |
| **FIB** | OAuth2 | QR code + deep links | API | Ready |
| **QiCard** | Basic Auth | 3DS redirect | API | Ready |
| **NassPay** | Bearer token | 3DS redirect | Manual | Ready |
| **COD** | None | Tracking only | Manual | Ready |

## Install

```bash
npm install iraqpay
```

## Quick Start

```typescript
import { IraqPay } from 'iraqpay';

const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: '9647XXXXXXXXX',
      merchantId: 'your_merchant_id',
      secret: 'your_secret',
    },
    fib: {
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret',
    },
  },
  sandbox: true, // Use test environments
  language: 'ar', // 'ar' | 'en' | 'ku'
});

// Create a payment — same interface for every gateway
const payment = await pay.createPayment({
  gateway: 'zaincash',
  amount: 25000, // IQD (integer, no decimals)
  orderId: 'order_123',
  description: 'Product purchase',
  callbackUrl: 'https://myapp.com/payment/callback',
});

// Each gateway returns what it supports:
console.log(payment.redirectUrl); // ZainCash, QiCard, NassPay
console.log(payment.qrCode);     // FIB (base64 image)
console.log(payment.deepLinks);  // FIB (personal/business/corporate)
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
const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: '9647XXXXXXXXX',     // Merchant wallet number
      merchantId: 'your_id',        // From ZainCash
      secret: 'your_secret',        // From ZainCash
    },
  },
  sandbox: true,
});

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
const pay = new IraqPay({
  gateways: {
    fib: {
      clientId: 'your_client_id',
      clientSecret: 'your_client_secret',
    },
  },
  sandbox: true,
});

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
const pay = new IraqPay({
  gateways: {
    qicard: {
      username: 'your_username',
      password: 'your_password',
      terminalId: 'your_terminal_id',
    },
  },
  sandbox: true,
});

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
const pay = new IraqPay({
  gateways: {
    nasspay: {
      username: 'merchant_user',
      password: 'merchant_pass',
    },
  },
  sandbox: true,
});

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
const pay = new IraqPay({
  gateways: {
    zaincash: { /* ... */ },
    fib: { /* ... */ },
    qicard: { /* ... */ },
    nasspay: { /* ... */ },
    cod: {},
  },
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

## License

MIT

## Contributing

Pull requests welcome. For major changes, please open an issue first.

## Links

- [GitHub](https://github.com/Balghanimi/iraqpay)
- [ZainCash API](https://docs.zaincash.iq)
- [FIB Developer Portal](https://fib.iq/fib-payment-gateway)
- [QiCard Developer Portal](https://developers-gate.qi.iq)
- [Iraqi Payments Docs](https://www.iraqpayments.com)
