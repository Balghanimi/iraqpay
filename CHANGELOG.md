# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-03-12

### Added
- **ZainCash** gateway — JWT (HS256) auth, web redirect flow, sandbox support
- **FIB** (First Iraqi Bank) gateway — OAuth2 auth, QR code + deep links, refund/cancel API
- **QiCard** gateway — Basic Auth + 3DS redirect, refund/cancel API
- **NassPay** gateway — Bearer token auth, 3DS redirect, auto token refresh with 401 retry
- **COD** (Cash-on-Delivery) tracker — pluggable storage adapter, markPaid/cancel
- Unified `IraqPay` orchestrator class with consistent API across all gateways
- Express.js middleware: `createWebhookHandler()` and `createCheckoutHandler()`
- Full TypeScript types with declaration files
- Error hierarchy: `IraqPayError`, `GatewayNotConfiguredError`, `PaymentFailedError`
- Multi-gateway configuration with `defaultGateway` option
- Language support: Arabic, English, Kurdish
- CI workflow: GitHub Actions testing on Node 18, 20, 22
- Test suite: unit tests for all gateways + Express middleware
- ZainCash live sandbox test (opt-in via `ZAINCASH_LIVE=1`)
- Documentation: README (English + Arabic), Testing Guides (English + Arabic)
- Example server with checkout + webhook endpoints
- Quick test script (`examples/test-local.js`)
- npm publish configuration with `prepublishOnly` build hook

[0.1.0]: https://github.com/Balghanimi/iraqpay/releases/tag/v0.1.0
