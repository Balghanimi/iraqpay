/**
 * IraqPay Smart Gateway Router
 *
 * Intelligent gateway selection with fallback chains, health-aware routing,
 * and latency-based optimization.
 */

import { GatewayName, CreatePaymentParams, IraqPayError } from './types';
import { CircuitBreaker } from './circuit-breaker';
import { Analytics } from './analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoutingStrategy = 'priority' | 'round-robin' | 'lowest-latency';

export interface GatewayRule {
  /** Min amount this gateway accepts */
  minAmount?: number;
  /** Max amount this gateway accepts */
  maxAmount?: number;
  /** Currencies this gateway supports */
  currencies?: ('IQD' | 'USD')[];
  /** Priority (lower = higher priority). Default: 10 */
  priority?: number;
}

export interface RouterConfig {
  /** Enable smart routing. Default: false (uses gateway param or defaultGateway) */
  enabled?: boolean;
  /** Routing strategy. Default: 'priority' */
  strategy?: RoutingStrategy;
  /** Fallback chain — ordered list of gateways to try on failure */
  fallbackChain?: GatewayName[];
  /** Per-gateway routing rules */
  rules?: Partial<Record<GatewayName, GatewayRule>>;
}

export interface RouteResult {
  gateway: GatewayName;
  reason: string;
  alternativesTried: GatewayName[];
}

// ─── Smart Router ─────────────────────────────────────────────────────────────

export class SmartRouter {
  private enabled: boolean;
  private strategy: RoutingStrategy;
  private fallbackChain: GatewayName[];
  private rules: Partial<Record<GatewayName, GatewayRule>>;
  private roundRobinIndex = 0;
  private circuitBreaker?: CircuitBreaker;
  private analytics?: Analytics;

  constructor(
    config?: RouterConfig,
    circuitBreaker?: CircuitBreaker,
    analytics?: Analytics,
  ) {
    this.enabled = config?.enabled ?? false;
    this.strategy = config?.strategy ?? 'priority';
    this.fallbackChain = config?.fallbackChain ?? [];
    this.rules = config?.rules ?? {};
    this.circuitBreaker = circuitBreaker;
    this.analytics = analytics;
  }

  /**
   * Select the best gateway for a payment request.
   *
   * @param params - Payment parameters (amount, currency)
   * @param configuredGateways - List of gateways that are actually configured
   * @param explicitGateway - Gateway explicitly requested by the caller
   * @returns The selected gateway and reasoning
   */
  route(
    params: CreatePaymentParams,
    configuredGateways: GatewayName[],
    explicitGateway?: GatewayName,
  ): RouteResult {
    // If gateway is explicitly specified, use it (no routing)
    if (explicitGateway) {
      return { gateway: explicitGateway, reason: 'explicit', alternativesTried: [] };
    }

    if (!this.enabled) {
      throw new IraqPayError(
        'No gateway specified and smart routing is not enabled',
        'zaincash',
        'NO_GATEWAY',
      );
    }

    const candidates = this.filterCandidates(params, configuredGateways);

    if (candidates.length === 0) {
      throw new IraqPayError(
        `No gateway available for amount=${params.amount} currency=${params.currency || 'IQD'}`,
        'zaincash',
        'NO_GATEWAY_AVAILABLE',
      );
    }

    switch (this.strategy) {
      case 'priority':
        return this.routeByPriority(candidates);
      case 'round-robin':
        return this.routeByRoundRobin(candidates);
      case 'lowest-latency':
        return this.routeByLowestLatency(candidates);
      default:
        return this.routeByPriority(candidates);
    }
  }

  /**
   * Get the fallback chain for a gateway (what to try if it fails).
   * Returns gateways in order, excluding the failed one and any unavailable ones.
   */
  getFallbacks(
    failedGateway: GatewayName,
    params: CreatePaymentParams,
    configuredGateways: GatewayName[],
  ): GatewayName[] {
    // Use explicit fallback chain if defined
    let chain = this.fallbackChain.length > 0
      ? this.fallbackChain
      : configuredGateways;

    // Remove the failed gateway
    chain = chain.filter((g) => g !== failedGateway);

    // Filter by rules and circuit breaker
    return this.filterCandidates(params, chain);
  }

  private filterCandidates(
    params: CreatePaymentParams,
    gateways: GatewayName[],
  ): GatewayName[] {
    return gateways.filter((g) => {
      // Check circuit breaker
      if (this.circuitBreaker && !this.circuitBreaker.isAvailable(g)) {
        return false;
      }

      // Check rules
      const rule = this.rules[g];
      if (!rule) return true;

      if (rule.minAmount !== undefined && params.amount < rule.minAmount) return false;
      if (rule.maxAmount !== undefined && params.amount > rule.maxAmount) return false;
      if (rule.currencies && params.currency && !rule.currencies.includes(params.currency)) {
        return false;
      }

      return true;
    });
  }

  private routeByPriority(candidates: GatewayName[]): RouteResult {
    const sorted = [...candidates].sort((a, b) => {
      const pa = this.rules[a]?.priority ?? 10;
      const pb = this.rules[b]?.priority ?? 10;
      return pa - pb;
    });
    return { gateway: sorted[0], reason: 'priority', alternativesTried: [] };
  }

  private routeByRoundRobin(candidates: GatewayName[]): RouteResult {
    const idx = this.roundRobinIndex % candidates.length;
    this.roundRobinIndex++;
    return { gateway: candidates[idx], reason: 'round-robin', alternativesTried: [] };
  }

  private routeByLowestLatency(candidates: GatewayName[]): RouteResult {
    if (!this.analytics) {
      // No analytics available, fall back to priority
      return this.routeByPriority(candidates);
    }

    let bestGateway = candidates[0];
    let bestLatency = Infinity;

    for (const g of candidates) {
      const metrics = this.analytics.getGatewayMetrics(g);
      const latency = metrics.totalRequests > 0 ? metrics.p50Ms : Infinity;
      if (latency < bestLatency) {
        bestLatency = latency;
        bestGateway = g;
      }
    }

    return {
      gateway: bestGateway,
      reason: bestLatency === Infinity ? 'priority-fallback' : `lowest-latency (p50=${bestLatency}ms)`,
      alternativesTried: [],
    };
  }
}
