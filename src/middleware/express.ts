/**
 * Express.js middleware for IraqPay
 *
 * Handles webhook/callback verification for all gateways
 * and provides checkout session helpers.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { IraqPay } from '@iraqpay/sdk';
 * import { createWebhookHandler, createCheckoutHandler } from '@iraqpay/sdk/middleware/express';
 *
 * const app = express();
 * const pay = new IraqPay({ ... });
 *
 * // Auto-handle webhooks from all gateways
 * app.use('/webhooks', createWebhookHandler(pay, async (event) => {
 *   console.log(`Payment ${event.id} is ${event.status}`);
 *   // Update your database
 * }));
 *
 * // Quick checkout endpoint
 * app.post('/checkout', createCheckoutHandler(pay));
 * ```
 */

import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { IraqPay } from '../iraqpay';
import { GatewayName, WebhookEvent, CreatePaymentParams } from '../types';

// ─── Webhook Handler ────────────────────────────────────────────────────────

export interface WebhookHandlerOptions {
  /** Called when a webhook is verified successfully */
  onEvent: (event: WebhookEvent, req: Request) => Promise<void> | void;
  /** Called on verification error (default: sends 400) */
  onError?: (error: Error, req: Request, res: Response) => void;
}

/**
 * Creates Express middleware that handles webhooks from all Iraqi gateways.
 *
 * Routes:
 * - GET  /zaincash  — ZainCash redirect callback (?token=JWT)
 * - POST /fib       — FIB webhook (JSON body)
 * - POST /qicard    — QiCard notification (JSON body)
 * - POST /nasspay   — NassPay callback (JSON body)
 *
 * @example
 * ```typescript
 * app.use('/webhooks', createWebhookHandler(pay, {
 *   onEvent: async (event) => {
 *     await db.orders.update(event.orderId, { status: event.status });
 *   },
 * }));
 * ```
 */
export function createWebhookHandler(
  pay: IraqPay,
  optionsOrCallback:
    | WebhookHandlerOptions
    | WebhookHandlerOptions['onEvent'],
): RequestHandler {
  const options: WebhookHandlerOptions =
    typeof optionsOrCallback === 'function'
      ? { onEvent: optionsOrCallback }
      : optionsOrCallback;

  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      // Determine gateway from URL path
      const path = req.path.replace(/^\//, '').toLowerCase();
      let gateway: GatewayName;
      let payload: unknown;

      switch (path) {
        case 'zaincash':
          gateway = 'zaincash';
          // ZainCash sends JWT as ?token= query param (GET redirect)
          payload = req.query.token as string;
          break;

        case 'fib':
          gateway = 'fib';
          // FIB sends POST with { id, status }
          payload = req.body;
          break;

        case 'qicard':
          gateway = 'qicard';
          payload = req.body;
          break;

        case 'nasspay':
          gateway = 'nasspay';
          payload = req.body;
          break;

        default:
          res.status(404).json({ error: `Unknown gateway path: ${path}` });
          return;
      }

      const event = await pay.verifyCallback(payload, gateway);
      await options.onEvent(event, req);

      // ZainCash is a redirect — we might want to redirect the user
      if (gateway === 'zaincash') {
        res.json({ status: event.status, orderId: event.orderId });
      } else {
        res.sendStatus(200);
      }
    } catch (error) {
      if (options.onError) {
        options.onError(error as Error, req, res);
      } else {
        res.status(400).json({
          error: 'Webhook verification failed',
          message: (error as Error).message,
        });
      }
    }
  };
}

// ─── Checkout Handler ───────────────────────────────────────────────────────

export interface CheckoutHandlerOptions {
  /** Override or extend the payment params from the request body */
  transformParams?: (
    body: Record<string, unknown>,
    req: Request,
  ) => CreatePaymentParams;
}

/**
 * Creates an Express POST handler for creating payments.
 *
 * Expects JSON body with CreatePaymentParams fields.
 * Returns PaymentResult as JSON.
 *
 * @example
 * ```typescript
 * app.post('/api/checkout', createCheckoutHandler(pay));
 *
 * // Client sends:
 * // POST /api/checkout
 * // { "gateway": "zaincash", "amount": 25000, "orderId": "o_123" }
 *
 * // Server responds with PaymentResult (id, redirectUrl, qrCode, etc.)
 * ```
 */
export function createCheckoutHandler(
  pay: IraqPay,
  options?: CheckoutHandlerOptions,
): RequestHandler {
  return async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const params: CreatePaymentParams = options?.transformParams
        ? options.transformParams(req.body, req)
        : {
            gateway: req.body.gateway,
            amount: req.body.amount,
            currency: req.body.currency,
            orderId: req.body.orderId,
            description: req.body.description,
            callbackUrl: req.body.callbackUrl,
            successUrl: req.body.successUrl,
            failureUrl: req.body.failureUrl,
            customerInfo: req.body.customerInfo,
          };

      const result = await pay.createPayment(params);

      res.json({
        success: true,
        payment: {
          id: result.id,
          gateway: result.gateway,
          status: result.status,
          amount: result.amount,
          currency: result.currency,
          redirectUrl: result.redirectUrl,
          qrCode: result.qrCode,
          readableCode: result.readableCode,
          deepLinks: result.deepLinks,
          expiresAt: result.expiresAt,
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: (error as Error).message,
      });
    }
  };
}
