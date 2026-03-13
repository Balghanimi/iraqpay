/**
 * IraqPay Circuit Breaker
 *
 * Per-gateway health tracking with automatic failure detection and recovery.
 * Prevents cascading failures by fast-failing requests to unhealthy gateways.
 */

import { GatewayName, IraqPayError } from './types';
import { Analytics } from './analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerConfig {
  /** Enable circuit breaker. Default: true */
  enabled?: boolean;
  /** Number of consecutive failures before opening circuit. Default: 5 */
  failureThreshold?: number;
  /** Time in ms before trying to recover (move to half_open). Default: 30000 */
  resetTimeoutMs?: number;
  /** Max test requests in half_open state before deciding. Default: 2 */
  halfOpenMaxAttempts?: number;
  /** Per-gateway overrides */
  overrides?: Partial<Record<GatewayName, Partial<CircuitBreakerPerGateway>>>;
}

interface CircuitBreakerPerGateway {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxAttempts: number;
}

export interface CircuitStatus {
  gateway: GatewayName;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  nextRetryAt: number | null;
}

// ─── Circuit Breaker ──────────────────────────────────────────────────────────

interface GatewayCircuit {
  state: CircuitState;
  consecutiveFailures: number;
  halfOpenSuccesses: number;
  lastFailureAt: number | null;
  lastStateChangeAt: number;
  config: CircuitBreakerPerGateway;
}

export class CircuitBreaker {
  private enabled: boolean;
  private circuits: Map<GatewayName, GatewayCircuit> = new Map();
  private defaults: CircuitBreakerPerGateway;
  private overrides: Partial<Record<GatewayName, Partial<CircuitBreakerPerGateway>>>;
  private analytics?: Analytics;

  constructor(config?: CircuitBreakerConfig, analytics?: Analytics) {
    this.enabled = config?.enabled ?? true;
    this.defaults = {
      failureThreshold: config?.failureThreshold ?? 5,
      resetTimeoutMs: config?.resetTimeoutMs ?? 30000,
      halfOpenMaxAttempts: config?.halfOpenMaxAttempts ?? 2,
    };
    this.overrides = config?.overrides ?? {};
    this.analytics = analytics;
  }

  /** Check if a gateway is available (returns true if request should proceed) */
  isAvailable(gateway: GatewayName): boolean {
    if (!this.enabled) return true;
    const circuit = this.getOrCreate(gateway);

    if (circuit.state === 'closed') return true;

    if (circuit.state === 'open') {
      // Check if reset timeout has elapsed
      const elapsed = Date.now() - circuit.lastStateChangeAt;
      if (elapsed >= circuit.config.resetTimeoutMs) {
        this.transition(gateway, circuit, 'half_open');
        return true;
      }
      return false;
    }

    // half_open — allow limited requests
    return circuit.halfOpenSuccesses < circuit.config.halfOpenMaxAttempts;
  }

  /** Record a successful request */
  recordSuccess(gateway: GatewayName): void {
    if (!this.enabled) return;
    const circuit = this.getOrCreate(gateway);

    if (circuit.state === 'half_open') {
      circuit.halfOpenSuccesses++;
      if (circuit.halfOpenSuccesses >= circuit.config.halfOpenMaxAttempts) {
        this.transition(gateway, circuit, 'closed');
      }
    } else if (circuit.state === 'closed') {
      circuit.consecutiveFailures = 0;
    }
  }

  /** Record a failed request */
  recordFailure(gateway: GatewayName): void {
    if (!this.enabled) return;
    const circuit = this.getOrCreate(gateway);
    circuit.consecutiveFailures++;
    circuit.lastFailureAt = Date.now();

    if (circuit.state === 'half_open') {
      // Any failure in half_open immediately reopens
      this.transition(gateway, circuit, 'open');
    } else if (circuit.state === 'closed') {
      if (circuit.consecutiveFailures >= circuit.config.failureThreshold) {
        this.transition(gateway, circuit, 'open');
      }
    }
  }

  /** Get status of a specific gateway's circuit */
  getStatus(gateway: GatewayName): CircuitStatus {
    const circuit = this.circuits.get(gateway);
    if (!circuit) {
      return {
        gateway, state: 'closed', failures: 0, successes: 0,
        lastFailureAt: null, lastStateChangeAt: Date.now(), nextRetryAt: null,
      };
    }
    return {
      gateway,
      state: circuit.state,
      failures: circuit.consecutiveFailures,
      successes: circuit.halfOpenSuccesses,
      lastFailureAt: circuit.lastFailureAt,
      lastStateChangeAt: circuit.lastStateChangeAt,
      nextRetryAt: circuit.state === 'open'
        ? circuit.lastStateChangeAt + circuit.config.resetTimeoutMs
        : null,
    };
  }

  /** Get status of all tracked gateways */
  getAllStatus(): CircuitStatus[] {
    const gateways: GatewayName[] = ['zaincash', 'fib', 'qicard', 'nasspay', 'cod'];
    return gateways.map((g) => this.getStatus(g));
  }

  /** Manually reset a gateway's circuit to closed */
  reset(gateway: GatewayName): void {
    this.circuits.delete(gateway);
  }

  /** Reset all circuits */
  resetAll(): void {
    this.circuits.clear();
  }

  /** Throw if gateway circuit is open */
  guard(gateway: GatewayName): void {
    if (!this.isAvailable(gateway)) {
      const status = this.getStatus(gateway);
      throw new IraqPayError(
        `Gateway "${gateway}" circuit is open (${status.failures} consecutive failures). ` +
        `Next retry at ${new Date(status.nextRetryAt!).toISOString()}.`,
        gateway,
        'CIRCUIT_OPEN',
      );
    }
  }

  private getOrCreate(gateway: GatewayName): GatewayCircuit {
    let circuit = this.circuits.get(gateway);
    if (!circuit) {
      const overrides = this.overrides[gateway] ?? {};
      circuit = {
        state: 'closed',
        consecutiveFailures: 0,
        halfOpenSuccesses: 0,
        lastFailureAt: null,
        lastStateChangeAt: Date.now(),
        config: { ...this.defaults, ...overrides },
      };
      this.circuits.set(gateway, circuit);
    }
    return circuit;
  }

  private transition(gateway: GatewayName, circuit: GatewayCircuit, newState: CircuitState): void {
    const oldState = circuit.state;
    circuit.state = newState;
    circuit.lastStateChangeAt = Date.now();

    if (newState === 'closed') {
      circuit.consecutiveFailures = 0;
      circuit.halfOpenSuccesses = 0;
    } else if (newState === 'half_open') {
      circuit.halfOpenSuccesses = 0;
    }

    // Emit analytics events
    if (this.analytics) {
      const eventType = newState === 'open' ? 'circuit.opened'
        : newState === 'closed' ? 'circuit.closed'
        : 'circuit.half_open';
      this.analytics.emitEvent(eventType as any, gateway, {
        fromState: oldState,
        toState: newState,
        consecutiveFailures: circuit.consecutiveFailures,
      });
    }
  }
}
