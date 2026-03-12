# IraqPay — Local Testing Guide

How to test the IraqPay SDK locally before publishing to npm.

---

## Prerequisites

- **Node.js** >= 18 (check: `node -v`)
- **npm** >= 9 (check: `npm -v`)
- **Git** installed

---

## 1. Clone & Build IraqPay

```bash
git clone https://github.com/Balghanimi/iraqpay.git
cd iraqpay
npm install
npm run build     # compiles TypeScript → dist/
npm test          # runs 28 tests (should all pass)
```

---

## 2. Run the Example Server

IraqPay ships with a ready-to-run Express server:

```bash
# From the iraqpay directory
npx ts-node examples/express-server.ts
```

You'll see:
```
IraqPay example server running on http://localhost:3000
Configured gateways: zaincash, cod
```

### Test ZainCash (sandbox — works immediately, no credentials needed)

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "zaincash",
    "amount": 5000,
    "orderId": "test_001",
    "description": "Test payment",
    "callbackUrl": "http://localhost:3000/webhooks/zaincash"
  }'
```

**Expected response:**
```json
{
  "success": true,
  "payment": {
    "id": "69b28...",
    "gateway": "zaincash",
    "status": "pending",
    "amount": 5000,
    "currency": "IQD",
    "redirectUrl": "https://test.zaincash.iq/transaction/pay?id=69b28..."
  }
}
```

Open the `redirectUrl` in your browser — you'll see the ZainCash sandbox payment page.

### Test COD (always works, no setup needed)

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "cod",
    "amount": 25000,
    "orderId": "cod_001"
  }'
```

### Check Payment Status

```bash
curl http://localhost:3000/api/payment/zaincash/69b28.../status
```

---

## 3. Test Inside Your Own Project (npm link)

To use IraqPay in another local project (like Akel Bait) without publishing to npm:

```bash
# Step 1: Link iraqpay globally
cd D:/iraqpay
npm link

# Step 2: Link it into your project
cd D:/akel-bait/backend    # (or any project)
npm link iraqpay

# Verify it works
node -e "const {IraqPay} = require('iraqpay'); console.log('OK')"
```

> **Note:** After changing IraqPay source, run `npm run build` again for changes to take effect.

### Alternative: Install from local path

```bash
cd D:/akel-bait/backend
npm install D:/iraqpay
```

---

## 4. Test with Akel Bait (Full Integration)

### Start the backend

```bash
cd D:/akel-bait/backend
npm run dev
```

The backend auto-configures:
- **ZainCash sandbox** — works out of the box (test credentials built in)
- **COD** — always enabled
- **QiCard** — only if you set `QICARD_USERNAME`, `QICARD_PASSWORD`, `QICARD_TERMINAL_ID` in `.env`

### Start the frontend

```bash
cd D:/akel-bait/frontend
npm run dev
```

### Test the flow

1. Open `http://localhost:5174` in your browser
2. Register/login as a customer
3. Add items to cart → go to Checkout
4. Select **"زين كاش"** as payment method
5. Click **"الدفع عبر زين كاش"**
6. You'll be redirected to `test.zaincash.iq` sandbox page
7. Complete the test payment
8. You'll be redirected back to `/payment/callback?orderId=X`
9. The order status should update to PAID

---

## 5. Gateway Sandbox Credentials

### ZainCash (built-in — no setup needed)

| Field | Sandbox Value |
|-------|--------------|
| MSISDN | `9647835077893` |
| Merchant ID | `5ffacf6612b5777c6d44266f` |
| Secret | `$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS` |
| Test page | `https://test.zaincash.iq` |

These are ZainCash's **official** sandbox credentials from their docs.

### QiCard 3DS (requires registration)

1. Go to [QiCard Developer Portal](https://developers-gate.qi.iq)
2. Register for a sandbox account
3. Get your `username`, `password`, and `terminalId`
4. Add to `.env`:
   ```
   QICARD_USERNAME=your_username
   QICARD_PASSWORD=your_password
   QICARD_TERMINAL_ID=your_terminal_id
   ```

### FIB (requires registration)

1. Go to [FIB Developer Portal](https://fib.iq/fib-payment-gateway)
2. Register for sandbox
3. Get `clientId` and `clientSecret`
4. Add to `.env`:
   ```
   FIB_CLIENT_ID=your_client_id
   FIB_CLIENT_SECRET=your_client_secret
   ```

### NassPay (requires registration)

1. Contact NassPay for sandbox access
2. Get `username` and `password`
3. Add to `.env`:
   ```
   NASSPAY_USERNAME=your_username
   NASSPAY_PASSWORD=your_password
   ```

---

## 6. Run the Test Suite

```bash
cd D:/iraqpay

# Unit tests (no network, instant)
npm test

# With live ZainCash sandbox test
ZAINCASH_LIVE=1 npm test
```

All 28 tests should pass. The live test creates a real sandbox payment on ZainCash.

---

## 7. Verify Webhooks Locally

Payment gateways send webhooks to your server. For local testing, use [ngrok](https://ngrok.com/):

```bash
# Terminal 1: Start your server
cd D:/akel-bait/backend && npm run dev

# Terminal 2: Expose port 5000
ngrok http 5000
```

Copy the ngrok URL (e.g., `https://abc123.ngrok.io`) and set it in `.env`:

```
BACKEND_URL=https://abc123.ngrok.io
```

Now gateway webhooks will reach your local server.

---

## 8. Troubleshooting

| Problem | Solution |
|---------|----------|
| `Cannot find module 'iraqpay'` | Run `npm run build` in iraqpay first, then `npm link` or reinstall |
| ZainCash returns 401 | Make sure you're using sandbox credentials (built-in defaults work) |
| QiCard not showing in checkout | Set `QICARD_USERNAME` in backend `.env` — it only enables when credentials exist |
| Webhook not received | Use ngrok (section 7) — gateways can't reach localhost |
| `ZAINCASH not in PaymentMethod enum` | Run `npx prisma migrate dev` in backend to apply schema change |
| Tests fail with network error | Unit tests don't need network. Live tests need `ZAINCASH_LIVE=1` |

---

## Quick Reference

| Command | What it does |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run build` | Compile TypeScript |
| `npm run lint` | Check code quality |
| `npm run dev` | Watch mode (auto-rebuild) |
| `npx ts-node examples/express-server.ts` | Run example server |
