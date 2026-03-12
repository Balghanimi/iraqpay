import { IraqPay } from '../index';
import { createWebhookHandler, createCheckoutHandler } from '../middleware/express';

// Mock Express req/res/next
function mockReq(overrides: Record<string, unknown> = {}): any {
  return {
    path: '/',
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  return res;
}

const mockNext = jest.fn();

describe('Express Middleware', () => {
  let pay: IraqPay;

  beforeEach(() => {
    pay = new IraqPay({
      gateways: {
        fib: { clientId: 'test', clientSecret: 'test' },
        cod: {},
      },
      sandbox: true,
    });
  });

  describe('createWebhookHandler', () => {
    it('should handle FIB webhook (POST /fib)', async () => {
      const onEvent = jest.fn();
      const handler = createWebhookHandler(pay, { onEvent });

      const req = mockReq({
        path: '/fib',
        body: { id: 'pay_123', status: 'PAID' },
      });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(onEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pay_123',
          gateway: 'fib',
          status: 'paid',
        }),
        req,
      );
      expect(res.sendStatus).toHaveBeenCalledWith(200);
    });

    it('should return 404 for unknown gateway path', async () => {
      const handler = createWebhookHandler(pay, jest.fn());

      const req = mockReq({ path: '/unknown' });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    it('should call onError when verification fails', async () => {
      const onError = jest.fn();
      const handler = createWebhookHandler(pay, {
        onEvent: jest.fn(),
        onError,
      });

      const req = mockReq({
        path: '/fib',
        body: {}, // Invalid — missing id and status
      });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(onError).toHaveBeenCalled();
    });
  });

  describe('createCheckoutHandler', () => {
    it('should create a COD payment from request body', async () => {
      const handler = createCheckoutHandler(pay);

      const req = mockReq({
        body: {
          gateway: 'cod',
          amount: 25000,
          orderId: 'express_test_1',
          description: 'Test from Express',
        },
      });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          payment: expect.objectContaining({
            gateway: 'cod',
            status: 'pending',
            amount: 25000,
          }),
        }),
      );
    });

    it('should return 400 on error', async () => {
      const handler = createCheckoutHandler(pay);

      const req = mockReq({
        body: {
          gateway: 'nasspay', // Not configured
          amount: 1000,
          orderId: 'fail_test',
        },
      });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    it('should support custom transformParams', async () => {
      const handler = createCheckoutHandler(pay, {
        transformParams: (body) => ({
          gateway: 'cod',
          amount: (body.price as number) * 1000, // Convert to IQD
          orderId: `order_${body.itemId}`,
        }),
      });

      const req = mockReq({
        body: { price: 25, itemId: 'abc123' },
      });
      const res = mockRes();

      await handler(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          payment: expect.objectContaining({
            amount: 25000,
          }),
        }),
      );
    });
  });
});
