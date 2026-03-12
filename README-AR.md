<div dir="rtl">

# IraqPay — حزمة دفع موحّدة للعراق

حزمة SDK وحدة لـ **كل** بوابات الدفع العراقية. بدل ما تكتب كود منفصل لكل بوابة، استخدم واجهة وحدة موحّدة.

| البوابة | المصادقة | طريقة الدفع | الاسترداد | الحالة |
|---------|----------|-------------|-----------|--------|
| **زين كاش** | JWT (HS256) | إعادة توجيه | يدوي | جاهزة |
| **FIB** (المصرف العراقي الأول) | OAuth2 | QR كود + روابط التطبيق | API | جاهزة |
| **كي كارد** | Basic Auth | 3DS إعادة توجيه | API | جاهزة |
| **ناس باي** | Bearer token | 3DS إعادة توجيه | يدوي | جاهزة |
| **الدفع عند الاستلام** | بدون | تتبع فقط | يدوي | جاهزة |

---

## التنصيب

</div>

```bash
npm install iraqpay
```

<div dir="rtl">

---

## البداية السريعة

</div>

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
  sandbox: true,       // بيئة التجربة
  language: 'ar',      // 'ar' | 'en' | 'ku'
});

// أنشئ دفعة — نفس الواجهة لكل البوابات
const payment = await pay.createPayment({
  gateway: 'zaincash',
  amount: 25000,       // دينار عراقي (عدد صحيح، بدون فاصلة عشرية)
  orderId: 'order_123',
  description: 'شراء منتج',
  callbackUrl: 'https://myapp.com/payment/callback',
});

// كل بوابة ترجع اللي تدعمه:
console.log(payment.redirectUrl); // زين كاش، كي كارد، ناس باي
console.log(payment.qrCode);     // FIB (صورة base64)
console.log(payment.deepLinks);  // FIB (شخصي/أعمال/شركات)
```

<div dir="rtl">

---

## فحص حالة الدفعة

</div>

```typescript
const status = await pay.getStatus(payment.id, 'zaincash');

if (status.status === 'paid') {
  console.log('الدفعة وصلت!');
}
```

<div dir="rtl">

---

## معالجة الـ Callbacks

</div>

```typescript
// مثال Express.js
app.get('/payment/callback', async (req, res) => {
  // زين كاش يرسل JWT token كمعامل بالرابط
  const event = await pay.verifyCallback(req.query.token, 'zaincash');

  if (event.status === 'paid') {
    // حدّث طلبك
  }
});

app.post('/payment/webhook', async (req, res) => {
  // FIB يرسل POST بـ { id, status }
  const event = await pay.verifyCallback(req.body, 'fib');

  if (event.status === 'paid') {
    // حدّث طلبك
  }
  res.sendStatus(200);
});
```

<div dir="rtl">

---

## كل البوابات بالتفصيل

### زين كاش

</div>

```typescript
const pay = new IraqPay({
  gateways: {
    zaincash: {
      msisdn: '9647XXXXXXXXX',     // رقم محفظة التاجر
      merchantId: 'your_id',        // من زين كاش
      secret: 'your_secret',        // من زين كاش
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

// وجّه المستخدم لصفحة الدفع
res.redirect(payment.redirectUrl);
```

<div dir="rtl">

### FIB — المصرف العراقي الأول

</div>

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
  currency: 'IQD',    // يدعم أيضاً 'USD'
  orderId: 'fib_001',
  description: 'دفع طلب',
  callbackUrl: 'https://myapp.com/webhook',
});

// اعرض QR كود للمستخدم
console.log(payment.qrCode);       // صورة base64
console.log(payment.readableCode); // كود إدخال يدوي

// أو وجّهه لتطبيق FIB
console.log(payment.deepLinks?.personal); // fib://...

// استرداد (FIB يدعم هذا)
await pay.refund(payment.id, 'fib');
```

<div dir="rtl">

### كي كارد

</div>

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
    firstName: 'أحمد',
    lastName: 'علي',
    phone: '9647XXXXXXXXX',
    email: 'ahmed@example.com',
  },
});

// وجّه لصفحة الدفع 3DS
res.redirect(payment.redirectUrl);
```

<div dir="rtl">

### ناس باي

</div>

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
  description: 'شراء إلكترونيات',
  successUrl: 'https://myapp.com/success',
  callbackUrl: 'https://myapp.com/notify',
});

// وجّه لصفحة 3DS
res.redirect(payment.redirectUrl);
```

<div dir="rtl">

### الدفع عند الاستلام (COD)

</div>

```typescript
const pay = new IraqPay({
  gateways: { cod: {} },
});

const payment = await pay.createPayment({
  gateway: 'cod',
  amount: 30000,
  orderId: 'cod_001',
});

// لمن السائق يستلم الفلوس:
const codGateway = pay.getGateway('cod');
await codGateway.markPaid(payment.id);
```

<div dir="rtl">

---

## إعداد بوابات متعددة

</div>

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
  defaultGateway: 'fib',  // البوابة الافتراضية
});

// يستخدم البوابة الافتراضية (FIB)
await pay.createPayment({ amount: 5000, orderId: 'auto_001' });

// أو حدد بوابة لكل دفعة
await pay.createPayment({ gateway: 'zaincash', amount: 5000, orderId: 'zc_002' });
```

<div dir="rtl">

---

## ميدلوير Express.js

IraqPay يوفر ميدلوير جاهز لـ Express.js يتعامل مع webhooks و checkout تلقائياً.

### معالج Webhooks

</div>

```typescript
import express from 'express';
import { IraqPay, createWebhookHandler } from 'iraqpay';

const app = express();
const pay = new IraqPay({ /* إعداداتك */ });

app.use('/webhooks', createWebhookHandler(pay, {
  onEvent: async (event) => {
    console.log(`دفعة ${event.id} حالتها ${event.status}`);

    if (event.status === 'paid') {
      // حدّث الطلب بقاعدة البيانات
      await db.orders.update(event.orderId, { paymentStatus: 'paid' });
    }
  },
  onError: (error, req, res) => {
    console.error('خطأ بالويبهوك:', error);
  },
}));
```

<div dir="rtl">

هذا الميدلوير يوجّه الويبهوكات تلقائياً:
- `GET /webhooks/zaincash` — callback زين كاش
- `POST /webhooks/fib` — webhook المصرف العراقي الأول
- `POST /webhooks/qicard` — إشعار كي كارد
- `POST /webhooks/nasspay` — callback ناس باي

### معالج Checkout

</div>

```typescript
import { createCheckoutHandler } from 'iraqpay';

app.post('/api/checkout', createCheckoutHandler(pay));
```

<div dir="rtl">

يقبل JSON بالشكل التالي:

</div>

```json
{
  "gateway": "zaincash",
  "amount": 25000,
  "currency": "IQD",
  "orderId": "order_123",
  "description": "شراء منتج",
  "callbackUrl": "https://myapp.com/callback",
  "successUrl": "https://myapp.com/success",
  "customerInfo": {
    "firstName": "أحمد",
    "email": "ahmed@example.com"
  }
}
```

<div dir="rtl">

ويرجع:

</div>

```json
{
  "success": true,
  "payment": {
    "id": "69b28...",
    "gateway": "zaincash",
    "status": "pending",
    "amount": 25000,
    "currency": "IQD",
    "redirectUrl": "https://test.zaincash.iq/transaction/pay?id=69b28..."
  }
}
```

<div dir="rtl">

---

## معالجة الأخطاء

</div>

```typescript
import { IraqPayError, GatewayNotConfiguredError, PaymentFailedError } from 'iraqpay';

try {
  await pay.createPayment({ gateway: 'zaincash', amount: 100, orderId: 'test' });
} catch (err) {
  if (err instanceof GatewayNotConfiguredError) {
    // البوابة ما مضبوطة بالإعدادات
    console.log('البوابة غير مضبوطة:', err.gateway);
  } else if (err instanceof PaymentFailedError) {
    // طلب الدفع فشل
    console.log('الدفعة فشلت:', err.message, err.raw);
  } else if (err instanceof IraqPayError) {
    // خطأ عام من IraqPay
    console.log('خطأ:', err.code, err.message);
  }
}
```

<div dir="rtl">

---

## مقارنة البوابات

| الميزة | زين كاش | FIB | كي كارد | ناس باي | COD |
|--------|---------|-----|---------|---------|-----|
| إعادة توجيه | نعم | لا | نعم (3DS) | نعم (3DS) | لا |
| QR كود | لا | نعم | لا | لا | لا |
| روابط تطبيق موبايل | لا | نعم | لا | لا | لا |
| Webhooks | لا | نعم (POST) | نعم (POST) | نعم (POST) | لا |
| استرداد API | لا | نعم | نعم | لا | لا |
| إلغاء API | محدود | نعم | نعم | لا | نعم |
| دعم الدولار | لا | نعم | لا | لا | — |
| بيئة تجربة | نعم | نعم | نعم | نعم | — |

---

## أنواع TypeScript

IraqPay مكتوب بالكامل بـ TypeScript ويصدّر كل الأنواع:

</div>

```typescript
import type {
  GatewayName,            // 'zaincash' | 'fib' | 'qicard' | 'nasspay' | 'cod'
  IraqPayConfig,          // إعدادات SDK الرئيسية
  CreatePaymentParams,    // معاملات إنشاء الدفعة
  PaymentResult,          // نتيجة الدفعة
  PaymentStatus,          // 'pending' | 'paid' | 'declined' | 'cancelled' | 'refunded' | 'expired'
  PaymentStatusResult,    // نتيجة فحص الحالة
  WebhookEvent,           // حدث الـ callback
  CustomerInfo,           // معلومات الزبون
  Currency,               // 'IQD' | 'USD'
  PaymentGateway,         // واجهة البوابة (لمن تبني بوابة جديدة)
} from 'iraqpay';
```

<div dir="rtl">

### الأنواع الرئيسية

#### إعدادات SDK

</div>

```typescript
interface IraqPayConfig {
  gateways: GatewayConfigs;          // البوابات المفعّلة
  sandbox?: boolean;                 // بيئة التجربة (افتراضي: true)
  language?: 'ar' | 'en' | 'ku';     // لغة صفحة الدفع
  defaultGateway?: GatewayName;      // البوابة الافتراضية
}
```

<div dir="rtl">

#### معاملات إنشاء الدفعة

</div>

```typescript
interface CreatePaymentParams {
  gateway?: GatewayName;             // أي بوابة تستخدم
  amount: number;                    // المبلغ (أصغر وحدة — فلوس للدينار)
  currency?: Currency;               // افتراضي: 'IQD'
  orderId: string;                   // رقم طلبك الداخلي
  description?: string;              // وصف الدفعة
  callbackUrl?: string;              // رابط الإشعار
  successUrl?: string;               // توجيه عند النجاح (3DS)
  failureUrl?: string;               // توجيه عند الفشل
  customerInfo?: CustomerInfo;       // معلومات الزبون (اختياري)
}
```

<div dir="rtl">

#### نتيجة الدفعة

</div>

```typescript
interface PaymentResult {
  id: string;                        // رقم المعاملة من البوابة
  gateway: GatewayName;              // أي بوابة عالجت الدفعة
  status: PaymentStatus;             // الحالة الحالية
  amount: number;                    // المبلغ
  currency: Currency;                // العملة
  orderId: string;                   // رقم طلبك
  redirectUrl?: string;              // لزين كاش، كي كارد، ناس باي
  qrCode?: string;                   // صورة Base64 (FIB فقط)
  readableCode?: string;             // كود إدخال يدوي (FIB فقط)
  deepLinks?: {                      // روابط التطبيق (FIB فقط)
    personal?: string;
    business?: string;
    corporate?: string;
  };
  expiresAt?: string;                // وقت انتهاء الصلاحية
  raw: unknown;                      // الرد الخام من البوابة
}
```

<div dir="rtl">

---

## الفحوصات

</div>

```bash
# فحوصات بدون إنترنت (فورية)
npm test

# مع فحص زين كاش الحي (يحتاج إنترنت)
ZAINCASH_LIVE=1 npm test
```

<div dir="rtl">

55 فحص — كلهم لازم ينجحون.

---

## بيانات الساندبوكس

### زين كاش (مدمجة — تشتغل فوراً)

| الحقل | القيمة |
|-------|--------|
| MSISDN | `9647835077893` |
| Merchant ID | `5ffacf6612b5777c6d44266f` |
| Secret | `$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS` |

### كي كارد (يحتاج تسجيل)
سجّل بـ [بوابة مطوري كي كارد](https://developers-gate.qi.iq) وخذ بيانات ساندبوكس.

### FIB (يحتاج تسجيل)
سجّل بـ [بوابة مطوري FIB](https://fib.iq/fib-payment-gateway) وخذ `clientId` و `clientSecret`.

### ناس باي (يحتاج تسجيل)
تواصل مع ناس باي للحصول على بيانات ساندبوكس.

---

## الرخصة

MIT

---

## المساهمة

نرحب بطلبات السحب (Pull Requests). للتغييرات الكبيرة، افتح issue أولاً.

---

## التوثيق

- [README (English)](README.md) — التوثيق الرئيسي بالإنجليزي
- [دليل التجربة (عربي)](docs/TESTING-GUIDE-AR.md) — شلون تجرّب محلياً
- [Testing Guide (English)](docs/TESTING-GUIDE.md) — how to test locally

## الروابط

- [GitHub](https://github.com/Balghanimi/iraqpay)
- [ZainCash API](https://docs.zaincash.iq)
- [FIB Developer Portal](https://fib.iq/fib-payment-gateway)
- [QiCard Developer Portal](https://developers-gate.qi.iq)

</div>
