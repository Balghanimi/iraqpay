/**
 * IraqPay — Unified Payment SDK for Iraq
 *
 * One SDK for all Iraqi payment gateways:
 * ZainCash, FIB, QiCard, NassPay, and Cash-on-Delivery
 *
 * Features:
 * - Unified API across 5 gateways
 * - Smart gateway routing with fallback chains
 * - Circuit breaker for fault tolerance
 * - Per-gateway analytics and metrics
 * - Request tracing with correlation IDs
 * - Benchmark suite for performance comparison
 *
 * @example
 * ```typescript
 * const pay = new IraqPay({
 *   gateways: {
 *     zaincash: { msisdn: '...', merchantId: '...', secret: '...' },
 *     fib: { clientId: '...', clientSecret: '...' },
 *   },
 *   sandbox: true,
 *   analytics: { enabled: true },
 *   circuitBreaker: { failureThreshold: 3 },
 *   router: { enabled: true, strategy: 'priority' },
 * });
 *
 * const payment = await pay.createPayment({
 *   gateway: 'zaincash',
 *   amount: 25000,
 *   orderId: 'order_123',
 *   callbackUrl: 'https://myapp.com/callback',
 * });
 *
 * console.log(payment.redirectUrl); // Redirect user here
 * console.log(pay.analytics.getMetrics()); // Per-gateway metrics
 * ```
 */

import {
  IraqPayConfig,
  GatewayName,
  PaymentGateway,
  CreatePaymentParams,
  PaymentResult,
  PaymentStatusResult,
  WebhookEvent,
  GatewayNotConfiguredError,
  IraqPayError,
} from './types';
import { ZainCashGateway } from './gateways/zaincash';
import { FIBGateway } from './gateways/fib';
import { QiCardGateway } from './gateways/qicard';
import { NassPayGateway } from './gateways/nasspay';
import { CODGateway } from './gateways/cod';
import { Analytics, type AnalyticsConfig } from './analytics';
import { CircuitBreaker, type CircuitBreakerConfig } from './circuit-breaker';
import { SmartRouter, type RouterConfig } from './router';
import { Tracer, TraceContext, type TracingConfig } from './tracing';

export class IraqPay {
  private gateways: Map<GatewayName, PaymentGateway> = new Map();
  private defaultGateway?: GatewayName;

  /** Analytics engine — access metrics, add event listeners */
  readonly analytics: Analytics;
  /** Circuit breaker — check gateway health status */
  readonly circuitBreaker: CircuitBreaker;
  /** Smart router — configure routing strategy */
  readonly router: SmartRouter;
  /** Tracer — structured logging with correlation IDs */
  readonly tracer: Tracer;

  constructor(private config: IraqPayConfig) {
    const sandbox = config.sandbox ?? true;
    const lang = config.language || 'ar';
    const timeout = config.timeout ?? 30000;
    this.defaultGateway = config.defaultGateway;

    // Initialize infrastructure
    this.analytics = new Analytics(config.analytics);
    this.circuitBreaker = new CircuitBreaker(config.circuitBreaker, this.analytics);
    this.router = new SmartRouter(config.router, this.circuitBreaker, this.analytics);
    this.tracer = new Tracer(config.tracing);

    // Initialize configured gateways
    if (config.gateways.zaincash) {
      this.gateways.set(
        'zaincash',
        new ZainCashGateway(config.gateways.zaincash, sandbox, lang, timeout),
      );
    }

    if (config.gateways.fib) {
      this.gateways.set(
        'fib',
        new FIBGateway(config.gateways.fib, sandbox, timeout),
      );
    }

    if (config.gateways.qicard) {
      this.gateways.set(
        'qicard',
        new QiCardGateway(config.gateways.qicard, sandbox, timeout),
      );
    }

    if (config.gateways.nasspay) {
      this.gateways.set(
        'nasspay',
        new NassPayGateway(config.gateways.nasspay, sandbox, timeout),
      );
    }

    if (config.gateways.cod) {
      this.gateways.set('cod', new CODGateway(config.gateways.cod));
    }
  }

  /** Get list of configured gateway names */
  get configuredGateways(): GatewayName[] {
    return Array.from(this.gateways.keys());
  }

  /** Get a specific gateway adapter for direct usage */
  getGateway<T extends PaymentGateway>(name: GatewayName): T {
    const gw = this.gateways.get(name);
    if (!gw) throw new GatewayNotConfiguredError(name);
    return gw as T;
  }

  private resolveGateway(name?: GatewayName): PaymentGateway {
    const gatewayName = name || this.defaultGateway;
    if (!gatewayName) {
      throw new GatewayNotConfiguredError(
        'zaincash' as GatewayName, // placeholder
      );
    }
    const gw = this.gateways.get(gatewayName);
    if (!gw) throw new GatewayNotConfiguredError(gatewayName);
    return gw;
  }

  /**
   * Create a payment — works the same regardless of gateway.
   *
   * With smart routing enabled, omitting the `gateway` param will auto-select
   * the best gateway. On failure, fallback gateways are tried automatically.
   *
   * @example
   * ```typescript
   * const payment = await pay.createPayment({
   *   gateway: 'fib',
   *   amount: 10000,
   *   orderId: 'order_456',
   *   callbackUrl: 'https://myapp.com/webhook',
   * });
   * ```
   */
  async createPayment(params: CreatePaymentParams): Promise<PaymentResult> {
    if (!params.orderId) {
      throw new IraqPayError(
        'orderId is required',
        (params.gateway || this.defaultGateway || 'zaincash') as GatewayName,
        'VALIDATION_ERROR',
      );
    }
    if (typeof params.amount !== 'number' || params.amount <= 0) {
      throw new IraqPayError(
        'amount must be a positive number',
        (params.gateway || this.defaultGateway || 'zaincash') as GatewayName,
        'VALIDATION_ERROR',
      );
    }

    // Smart routing or explicit gateway
    let gatewayName: GatewayName;
    let alternativesTried: GatewayName[] = [];

    if (params.gateway || !this.config.router?.enabled) {
      gatewayName = params.gateway || this.defaultGateway!;
    } else {
      const route = this.router.route(params, this.configuredGateways, params.gateway);
      gatewayName = route.gateway;
    }

    // Verify primary gateway exists
    if (!this.gateways.has(gatewayName)) {
      throw new GatewayNotConfiguredError(gatewayName);
    }

    // Try primary gateway, then fallbacks
    const gatewaysToTry = [gatewayName];
    if (this.config.router?.enabled) {
      const fallbacks = this.router.getFallbacks(gatewayName, params, this.configuredGateways);
      gatewaysToTry.push(...fallbacks);
    }

    let lastError: Error | null = null;

    for (const gwName of gatewaysToTry) {
      const gw = this.gateways.get(gwName);
      if (!gw) continue;

      // Circuit breaker check
      if (!this.circuitBreaker.isAvailable(gwName)) {
        alternativesTried.push(gwName);
        continue;
      }

      const trace = this.tracer.startTrace('createPayment', gwName);
      const t0 = Date.now();

      try {
        const result = await gw.createPayment(params);
        const duration = Date.now() - t0;

        this.circuitBreaker.recordSuccess(gwName);
        this.analytics.recordSuccess('payment.created', gwName, duration, {
          orderId: params.orderId, amount: params.amount,
        }, trace.traceId);
        this.tracer.info(`Payment created: ${result.id}`, trace, {
          paymentId: result.id, status: result.status,
        });

        // Attach trace ID to result
        (result as any).traceId = trace.traceId;

        if (alternativesTried.length > 0) {
          this.analytics.emitEvent('router.fallback', gwName, {
            tried: alternativesTried, selectedGateway: gwName,
          }, trace.traceId);
        }

        return result;
      } catch (err: any) {
        const duration = Date.now() - t0;
        lastError = err;

        this.circuitBreaker.recordFailure(gwName);
        this.analytics.recordFailure(
          'payment.failed', gwName, duration,
          err.code || 'UNKNOWN', err.message,
          { orderId: params.orderId, amount: params.amount },
          trace.traceId,
        );
        this.tracer.error(`Payment failed: ${err.message}`, trace, {
          errorCode: err.code, error: err.message,
        });

        alternativesTried.push(gwName);
        // Continue to next fallback
      }
    }

    // All gateways failed
    throw lastError || new IraqPayError(
      'All gateways failed',
      gatewayName,
      'ALL_GATEWAYS_FAILED',
    );
  }

  /**
   * Check payment status
   *
   * @param paymentId - The payment/transaction ID returned by createPayment
   * @param gateway - Which gateway to check (required if not using defaultGateway)
   */
  async getStatus(
    paymentId: string,
    gateway?: GatewayName,
  ): Promise<PaymentStatusResult> {
    const gwName = gateway || this.defaultGateway;
    if (!gwName) throw new GatewayNotConfiguredError('zaincash' as GatewayName);

    const gw = this.resolveGateway(gwName);
    const trace = this.tracer.startTrace('getStatus', gwName);
    const t0 = Date.now();

    try {
      const result = await gw.getStatus(paymentId);
      const duration = Date.now() - t0;
      this.analytics.recordSuccess('status.checked', gwName, duration, { paymentId }, trace.traceId);
      this.tracer.info(`Status: ${result.status}`, trace, { paymentId, status: result.status });
      return result;
    } catch (err: any) {
      const duration = Date.now() - t0;
      this.analytics.recordFailure(
        'status.failed', gwName, duration,
        err.code || 'UNKNOWN', err.message, { paymentId }, trace.traceId,
      );
      this.tracer.error(`Status check failed: ${err.message}`, trace);
      throw err;
    }
  }

  /**
   * Cancel a pending payment
   *
   * @param amount - Optional amount for partial cancellation (QiCard). Omit for full cancel.
   * @returns true if cancelled successfully
   * @throws IraqPayError if gateway doesn't support cancellation
   */
  async cancel(paymentId: string, gateway?: GatewayName, amount?: number): Promise<boolean> {
    const gwName = gateway || this.defaultGateway;
    if (!gwName) throw new GatewayNotConfiguredError('zaincash' as GatewayName);

    const gw = this.resolveGateway(gwName);
    const trace = this.tracer.startTrace('cancel', gwName);
    const t0 = Date.now();

    try {
      const result = await gw.cancel(paymentId, amount);
      const duration = Date.now() - t0;
      this.analytics.recordSuccess('payment.cancelled', gwName, duration, { paymentId }, trace.traceId);
      this.tracer.info(`Payment cancelled: ${paymentId}`, trace);
      return result;
    } catch (err: any) {
      const duration = Date.now() - t0;
      this.analytics.recordFailure(
        'payment.cancelled', gwName, duration,
        err.code || 'UNKNOWN', err.message, { paymentId }, trace.traceId,
      );
      this.tracer.error(`Cancel failed: ${err.message}`, trace);
      throw err;
    }
  }

  /**
   * Refund a completed payment
   *
   * @param amount - Optional amount for partial refund (QiCard, FIB). Omit for full refund.
   * @returns true if refund initiated successfully
   * @throws IraqPayError if gateway doesn't support refunds (ZainCash, NassPay)
   */
  async refund(paymentId: string, gateway?: GatewayName, amount?: number): Promise<boolean> {
    const gwName = gateway || this.defaultGateway;
    if (!gwName) throw new GatewayNotConfiguredError('zaincash' as GatewayName);

    const gw = this.resolveGateway(gwName);
    const trace = this.tracer.startTrace('refund', gwName);
    const t0 = Date.now();

    try {
      const result = await gw.refund(paymentId, amount);
      const duration = Date.now() - t0;
      this.analytics.recordSuccess('payment.refunded', gwName, duration, { paymentId }, trace.traceId);
      this.tracer.info(`Payment refunded: ${paymentId}`, trace);
      return result;
    } catch (err: any) {
      const duration = Date.now() - t0;
      this.analytics.recordFailure(
        'payment.refunded', gwName, duration,
        err.code || 'UNKNOWN', err.message, { paymentId }, trace.traceId,
      );
      this.tracer.error(`Refund failed: ${err.message}`, trace);
      throw err;
    }
  }

  /**
   * Verify and parse a webhook/callback from a gateway
   *
   * @param payload - For ZainCash: the JWT token string from ?token= query param
   *                  For FIB: the POST body { id, status }
   *                  For QiCard: the POST notification body
   *                  For NassPay: the POST callback body
   * @param gateway - Which gateway sent the callback
   */
  async verifyCallback(
    payload: unknown,
    gateway: GatewayName,
  ): Promise<WebhookEvent> {
    const gw = this.resolveGateway(gateway);
    const trace = this.tracer.startTrace('verifyCallback', gateway);
    const t0 = Date.now();

    try {
      const result = await gw.verifyCallback(payload);
      const duration = Date.now() - t0;
      this.analytics.recordSuccess('callback.verified', gateway, duration, {
        paymentId: result.id, status: result.status,
      }, trace.traceId);
      this.tracer.info(`Callback verified: ${result.id} → ${result.status}`, trace);
      return result;
    } catch (err: any) {
      const duration = Date.now() - t0;
      this.analytics.recordFailure(
        'callback.failed', gateway, duration,
        err.code || 'UNKNOWN', err.message, {}, trace.traceId,
      );
      this.tracer.error(`Callback verification failed: ${err.message}`, trace);
      throw err;
    }
  }
}
