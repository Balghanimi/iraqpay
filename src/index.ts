/**
 * IraqPay — Unified Payment SDK for Iraq
 *
 * One SDK for ZainCash, FIB, QiCard, NassPay, and Cash-on-Delivery
 *
 * @example
 * ```typescript
 * import { IraqPay } from 'iraqpay';
 *
 * const pay = new IraqPay({
 *   gateways: {
 *     zaincash: { msisdn: '...', merchantId: '...', secret: '...' },
 *     fib: { clientId: '...', clientSecret: '...' },
 *   },
 *   sandbox: true,
 *   analytics: { enabled: true },
 *   circuitBreaker: { failureThreshold: 3 },
 *   router: { enabled: true, strategy: 'lowest-latency' },
 * });
 *
 * const payment = await pay.createPayment({
 *   gateway: 'zaincash',
 *   amount: 25000,
 *   orderId: 'order_123',
 *   callbackUrl: 'https://myapp.com/callback',
 * });
 *
 * // Access metrics
 * console.log(pay.analytics.getMetrics());
 * ```
 *
 * @packageDocumentation
 */

export { IraqPay } from './iraqpay';

// Types
export type {
  GatewayName,
  IraqPayConfig,
  GatewayConfigs,
  ZainCashConfig,
  FIBConfig,
  QiCardConfig,
  NassPayConfig,
  CODConfig,
  CODStore,
  CODOrderData,
  Currency,
  CreatePaymentParams,
  CustomerInfo,
  PaymentStatus,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  PaymentGateway,
} from './types';

// Errors
export {
  IraqPayError,
  GatewayNotConfiguredError,
  PaymentFailedError,
} from './types';

// Individual gateways (for advanced usage)
export { ZainCashGateway } from './gateways/zaincash';
export { FIBGateway } from './gateways/fib';
export { QiCardGateway } from './gateways/qicard';
export { NassPayGateway } from './gateways/nasspay';
export { CODGateway } from './gateways/cod';

// Express.js middleware
export {
  createWebhookHandler,
  createCheckoutHandler,
} from './middleware/express';
export type {
  WebhookHandlerOptions,
  CheckoutHandlerOptions,
} from './middleware/express';

// Analytics & Metrics
export { Analytics } from './analytics';
export type {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsEventType,
  AnalyticsListener,
  GatewayMetrics,
  AggregateMetrics,
} from './analytics';

// Circuit Breaker
export { CircuitBreaker } from './circuit-breaker';
export type {
  CircuitBreakerConfig,
  CircuitState,
  CircuitStatus,
} from './circuit-breaker';

// Smart Router
export { SmartRouter } from './router';
export type {
  RouterConfig,
  RoutingStrategy,
  GatewayRule,
  RouteResult,
} from './router';

// Request Tracing
export { Tracer, TraceContext, ConsoleLogger } from './tracing';
export type {
  TracingConfig,
  LogLevel,
  LogEntry,
  Logger,
} from './tracing';

// Benchmark Suite
export { BenchmarkRunner } from './benchmark';
export type {
  BenchmarkConfig,
  BenchmarkProgress,
  BenchmarkReport,
  GatewayBenchmarkResult,
  LatencyStats,
  ComparisonTable,
  RawBenchmarkEntry,
} from './benchmark';
