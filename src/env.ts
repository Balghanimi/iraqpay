/**
 * Environment variable resolution for IraqPay gateway credentials.
 *
 * Priority: explicit config > environment variable > throw error
 */

import type {
  GatewayConfigs,
  ZainCashConfig,
  FIBConfig,
  QiCardConfig,
  NassPayConfig,
} from './types';

const ENV_MAP = {
  zaincash: {
    msisdn: 'IRAQPAY_ZAINCASH_MSISDN',
    merchantId: 'IRAQPAY_ZAINCASH_MERCHANT_ID',
    secret: 'IRAQPAY_ZAINCASH_SECRET',
  },
  fib: {
    clientId: 'IRAQPAY_FIB_CLIENT_ID',
    clientSecret: 'IRAQPAY_FIB_CLIENT_SECRET',
  },
  qicard: {
    username: 'IRAQPAY_QICARD_USERNAME',
    password: 'IRAQPAY_QICARD_PASSWORD',
    terminalId: 'IRAQPAY_QICARD_TERMINAL_ID',
  },
  nasspay: {
    username: 'IRAQPAY_NASSPAY_USERNAME',
    password: 'IRAQPAY_NASSPAY_PASSWORD',
  },
} as const;

type GatewayWithCreds = keyof typeof ENV_MAP;

function isDevMode(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/**
 * Resolve a single credential field: explicit value > env var > error.
 * In dev mode, warns if the value appears hardcoded (env var not set but value provided).
 */
function resolveField(
  gateway: string,
  field: string,
  envVar: string,
  explicitValue: string | undefined,
): string {
  const envValue = process.env[envVar];

  if (explicitValue) {
    // Warn if the env var is NOT set but a value was passed — likely hardcoded
    if (!envValue && isDevMode()) {
      console.warn(
        `[iraqpay] Warning: ${gateway}.${field} appears to be hardcoded. ` +
        `Use environment variables instead. Set ${envVar} in your .env file.`,
      );
    }
    return explicitValue;
  }

  if (envValue) {
    return envValue;
  }

  throw new Error(
    `Missing ${envVar}. Set it in your .env file. ` +
    `Never hardcode credentials in source code.`,
  );
}

/** Resolve ZainCash config from explicit values + env vars */
export function resolveZainCashConfig(
  config: Partial<ZainCashConfig> | undefined,
): ZainCashConfig {
  const c = config ?? {};
  const map = ENV_MAP.zaincash;
  return {
    msisdn: resolveField('zaincash', 'msisdn', map.msisdn, c.msisdn),
    merchantId: resolveField('zaincash', 'merchantId', map.merchantId, c.merchantId),
    secret: resolveField('zaincash', 'secret', map.secret, c.secret),
  };
}

/** Resolve FIB config from explicit values + env vars */
export function resolveFIBConfig(
  config: Partial<FIBConfig> | undefined,
): FIBConfig {
  const c = config ?? {};
  const map = ENV_MAP.fib;
  return {
    clientId: resolveField('fib', 'clientId', map.clientId, c.clientId),
    clientSecret: resolveField('fib', 'clientSecret', map.clientSecret, c.clientSecret),
  };
}

/** Resolve QiCard config from explicit values + env vars */
export function resolveQiCardConfig(
  config: Partial<QiCardConfig> | undefined,
): QiCardConfig {
  const c = config ?? {};
  const map = ENV_MAP.qicard;
  return {
    username: resolveField('qicard', 'username', map.username, c.username),
    password: resolveField('qicard', 'password', map.password, c.password),
    terminalId: resolveField('qicard', 'terminalId', map.terminalId, c.terminalId),
  };
}

/** Resolve NassPay config from explicit values + env vars */
export function resolveNassPayConfig(
  config: Partial<NassPayConfig> | undefined,
): NassPayConfig {
  const c = config ?? {};
  const map = ENV_MAP.nasspay;
  return {
    username: resolveField('nasspay', 'username', map.username, c.username),
    password: resolveField('nasspay', 'password', map.password, c.password),
  };
}

/**
 * Resolve all gateway configs from explicit values + env vars.
 * Only resolves gateways that are present in the config object.
 */
export function resolveGatewayConfigs(gateways: GatewayConfigs): {
  zaincash?: ZainCashConfig;
  fib?: FIBConfig;
  qicard?: QiCardConfig;
  nasspay?: NassPayConfig;
  cod?: GatewayConfigs['cod'];
} {
  const resolved: Record<string, unknown> = {};

  if (gateways.zaincash !== undefined) {
    resolved.zaincash = resolveZainCashConfig(
      gateways.zaincash as Partial<ZainCashConfig>,
    );
  }
  if (gateways.fib !== undefined) {
    resolved.fib = resolveFIBConfig(
      gateways.fib as Partial<FIBConfig>,
    );
  }
  if (gateways.qicard !== undefined) {
    resolved.qicard = resolveQiCardConfig(
      gateways.qicard as Partial<QiCardConfig>,
    );
  }
  if (gateways.nasspay !== undefined) {
    resolved.nasspay = resolveNassPayConfig(
      gateways.nasspay as Partial<NassPayConfig>,
    );
  }
  if (gateways.cod !== undefined) {
    resolved.cod = gateways.cod;
  }

  return resolved as ReturnType<typeof resolveGatewayConfigs>;
}

/** Env var names for each gateway, exported for documentation/tooling */
export const IRAQPAY_ENV_VARS = ENV_MAP;
