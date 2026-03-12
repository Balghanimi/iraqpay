# دليل تجربة IraqPay محلياً

<div dir="rtl">

شلون تجرّب IraqPay على جهازك قبل ما تنشره على npm.

---

## المتطلبات

- **Node.js** نسخة 18 أو أحدث (تأكد: `node -v`)
- **npm** نسخة 9 أو أحدث (تأكد: `npm -v`)
- **Git** منصّب

---

## 1. حمّل المشروع وابنيه

</div>

```bash
git clone https://github.com/Balghanimi/iraqpay.git
cd iraqpay
npm install
npm run build     # يحوّل TypeScript → JavaScript
npm test          # يشغّل 28 تست (لازم كلهم ينجحون)
```

<div dir="rtl">

---

## 2. شغّل سيرفر المثال

IraqPay يجي وياه سيرفر Express جاهز:

</div>

```bash
npx ts-node examples/express-server.ts
```

<div dir="rtl">

راح تشوف:
```
IraqPay example server running on http://localhost:3000
Configured gateways: zaincash, cod
```

### جرّب زين كاش (ساندبوكس — يشتغل فوراً بدون أي إعدادات)

</div>

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{
    "gateway": "zaincash",
    "amount": 5000,
    "orderId": "test_001",
    "description": "دفعة تجريبية",
    "callbackUrl": "http://localhost:3000/webhooks/zaincash"
  }'
```

<div dir="rtl">

**النتيجة المتوقعة:**
```json
{
  "success": true,
  "payment": {
    "id": "69b28...",
    "gateway": "zaincash",
    "status": "pending",
    "redirectUrl": "https://test.zaincash.iq/transaction/pay?id=69b28..."
  }
}
```

افتح الـ `redirectUrl` بالبراوزر — راح تشوف صفحة الدفع التجريبية لزين كاش.

### جرّب الدفع عند الاستلام (COD)

</div>

```bash
curl -X POST http://localhost:3000/api/checkout \
  -H "Content-Type: application/json" \
  -d '{"gateway": "cod", "amount": 25000, "orderId": "cod_001"}'
```

<div dir="rtl">

---

## 3. استخدم IraqPay بمشروعك (بدون نشر على npm)

</div>

```bash
# الخطوة 1: اربط iraqpay عالمياً
cd D:/iraqpay
npm link

# الخطوة 2: اربطه بمشروعك
cd D:/akel-bait/backend    # أو أي مشروع ثاني
npm link iraqpay

# تأكد إنه يشتغل
node -e "const {IraqPay} = require('iraqpay'); console.log('OK')"
```

<div dir="rtl">

> **ملاحظة:** إذا غيّرت كود IraqPay، لازم تسوي `npm run build` مرة ثانية عشان التغييرات تنطبق.

### طريقة ثانية: تنصيب من مسار محلي

</div>

```bash
cd D:/akel-bait/backend
npm install D:/iraqpay
```

<div dir="rtl">

---

## 4. جرّب مع أكل بيت (تكامل كامل)

### شغّل الباكند

</div>

```bash
cd D:/akel-bait/backend
npm run dev
```

<div dir="rtl">

الباكند يضبط تلقائياً:
- **زين كاش (ساندبوكس)** — يشتغل فوراً (بيانات التجربة مدمجة)
- **الدفع عند الاستلام** — دائماً مفعّل
- **كي كارد** — بس إذا حطيت `QICARD_USERNAME` و `QICARD_PASSWORD` و `QICARD_TERMINAL_ID` بملف `.env`

### شغّل الفرونت

</div>

```bash
cd D:/akel-bait/frontend
npm run dev
```

<div dir="rtl">

### خطوات التجربة

1. افتح `http://localhost:5174` بالبراوزر
2. سجّل دخول كزبون
3. ضيف أطباق للسلة ← روح للكاشير
4. اختار **"زين كاش"** كطريقة دفع
5. اضغط **"الدفع عبر زين كاش"**
6. راح ينقلك لصفحة `test.zaincash.iq` التجريبية
7. كمّل عملية الدفع التجريبية
8. راح يرجعك لصفحة `/payment/callback?orderId=X`
9. حالة الطلب لازم تتحدث لـ PAID

---

## 5. بيانات الساندبوكس لكل بوابة

### زين كاش (مدمجة — ما تحتاج أي إعداد)

| الحقل | القيمة التجريبية |
|-------|-----------------|
| MSISDN | `9647835077893` |
| Merchant ID | `5ffacf6612b5777c6d44266f` |
| Secret | `$2y$10$hBbAZo2GfSSvyqAyV2SaqOfYewgYpfR1O19gIh4SqyGWdmySZYPuS` |
| صفحة التجربة | `https://test.zaincash.iq` |

هاي بيانات ساندبوكس **رسمية** من زين كاش.

### كي كارد 3DS (يحتاج تسجيل)

1. روح لـ [بوابة مطوري كي كارد](https://developers-gate.qi.iq)
2. سجّل حساب ساندبوكس
3. خذ `username` و `password` و `terminalId`
4. ضيفهم بملف `.env`:
   ```
   QICARD_USERNAME=اسم_المستخدم
   QICARD_PASSWORD=كلمة_السر
   QICARD_TERMINAL_ID=رقم_التيرمنال
   ```

### FIB — المصرف العراقي الأول (يحتاج تسجيل)

1. روح لـ [بوابة مطوري FIB](https://fib.iq/fib-payment-gateway)
2. سجّل حساب ساندبوكس
3. خذ `clientId` و `clientSecret`
4. ضيفهم بملف `.env`:
   ```
   FIB_CLIENT_ID=معرف_العميل
   FIB_CLIENT_SECRET=سر_العميل
   ```

### ناس باي (يحتاج تسجيل)

1. تواصل ويا ناس باي للحصول على بيانات ساندبوكس
2. خذ `username` و `password`
3. ضيفهم بملف `.env`:
   ```
   NASSPAY_USERNAME=اسم_المستخدم
   NASSPAY_PASSWORD=كلمة_السر
   ```

---

## 6. شغّل الفحوصات

</div>

```bash
cd D:/iraqpay

# فحوصات بدون إنترنت (فورية)
npm test

# مع فحص زين كاش الحي
ZAINCASH_LIVE=1 npm test
```

<div dir="rtl">

كلهم 28 تست لازم ينجحون. الفحص الحي يسوي دفعة تجريبية حقيقية على زين كاش.

---

## 7. تجربة الويبهوكات محلياً

بوابات الدفع ترسل webhooks لسيرفرك. للتجربة المحلية، استخدم [ngrok](https://ngrok.com/):

</div>

```bash
# تيرمنال 1: شغّل سيرفرك
cd D:/akel-bait/backend && npm run dev

# تيرمنال 2: اعرض بورت 5000 للإنترنت
ngrok http 5000
```

<div dir="rtl">

انسخ رابط ngrok (مثلاً `https://abc123.ngrok.io`) وحطّه بملف `.env`:

```
BACKEND_URL=https://abc123.ngrok.io
```

هسّه webhooks البوابات راح توصل لسيرفرك المحلي.

---

## 8. حل المشاكل الشائعة

| المشكلة | الحل |
|---------|------|
| `Cannot find module 'iraqpay'` | سوّي `npm run build` بمجلد iraqpay أول، بعدين `npm link` أو نصّبه من جديد |
| زين كاش يرجع 401 | تأكد إنك تستخدم بيانات الساندبوكس (الافتراضية تشتغل) |
| كي كارد ما يظهر بالكاشير | حط `QICARD_USERNAME` بملف `.env` — يتفعل بس لمن تحط البيانات |
| الويبهوك ما وصل | استخدم ngrok (قسم 7) — البوابات ما تكدر توصل لـ localhost |
| `ZAINCASH not in PaymentMethod enum` | سوّي `npx prisma migrate dev` بمجلد الباكند |
| الفحوصات فشلت بخطأ شبكة | الفحوصات العادية ما تحتاج إنترنت. الحيّة تحتاج `ZAINCASH_LIVE=1` |

---

## مرجع سريع

| الأمر | شنو يسوي |
|-------|---------|
| `npm test` | يشغّل كل الفحوصات |
| `npm run build` | يبني الكود |
| `npm run lint` | يفحص جودة الكود |
| `npm run dev` | وضع المراقبة (يبني تلقائياً) |
| `npx ts-node examples/express-server.ts` | يشغّل سيرفر المثال |

</div>
