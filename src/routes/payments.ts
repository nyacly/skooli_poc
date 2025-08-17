import { Hono } from 'hono';
import { Bindings, PaymentRequestSchema } from '../types';
import { getUserFromToken } from '../utils/auth';
import { MoMoPaymentService } from '../utils/momo';

const paymentRoutes = new Hono<{ Bindings: Bindings }>();

// Initiate payment
paymentRoutes.post('/initiate', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const body = await c.req.json();
    const { orderId, phoneNumber, paymentMethod = 'momo' } = PaymentRequestSchema.parse(body);
    
    // Get order
    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).bind(orderId, user.id).first();
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    if (order.payment_status === 'paid') {
      return c.json({ error: 'Order already paid' }, 400);
    }
    
    // Initialize MoMo payment service
    const momoService = new MoMoPaymentService({
      apiKey: c.env.MOMO_API_KEY || 'test-api-key',
      apiSecret: c.env.MOMO_API_SECRET || 'test-api-secret',
      apiUrl: c.env.MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com',
      environment: c.env.MOMO_API_KEY ? 'production' : 'sandbox',
    });
    
    // Request payment
    const paymentResponse = await momoService.requestPayment(
      order.order_number as string,
      phoneNumber,
      order.total_amount as number,
      'UGX',
      `Payment for Skooli order ${order.order_number}`
    );
    
    // Save payment record
    const paymentResult = await c.env.DB.prepare(
      `INSERT INTO payments (order_id, transaction_id, payment_method, amount, currency, status, provider_response, momo_number)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId,
      paymentResponse.financialTransactionId || `PENDING-${Date.now()}`,
      paymentMethod,
      order.total_amount,
      'UGX',
      paymentResponse.status === 'SUCCESSFUL' ? 'success' : 'pending',
      JSON.stringify(paymentResponse),
      phoneNumber
    ).run();
    
    // Update order payment status if successful
    if (paymentResponse.status === 'SUCCESSFUL') {
      await c.env.DB.prepare(
        'UPDATE orders SET payment_status = ?, payment_method = ?, payment_reference = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind('paid', paymentMethod, paymentResponse.financialTransactionId, 'processing', orderId).run();
    }
    
    return c.json({
      success: true,
      paymentId: paymentResult.meta.last_row_id,
      status: paymentResponse.status,
      transactionId: paymentResponse.financialTransactionId,
      message: paymentResponse.status === 'SUCCESSFUL' 
        ? 'Payment successful' 
        : 'Payment initiated. Please approve on your phone.',
    });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return c.json({ error: 'Invalid input', details: error.errors }, 400);
    }
    return c.json({ error: error.message }, 500);
  }
});

// Check payment status
paymentRoutes.get('/status/:paymentId', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const paymentId = c.req.param('paymentId');
    
    // Get payment record
    const payment = await c.env.DB.prepare(
      `SELECT p.*, o.user_id 
       FROM payments p 
       JOIN orders o ON p.order_id = o.id 
       WHERE p.id = ? AND o.user_id = ?`
    ).bind(paymentId, user.id).first();
    
    if (!payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }
    
    // If payment is still pending, check with MoMo API
    if (payment.status === 'pending') {
      const momoService = new MoMoPaymentService({
        apiKey: c.env.MOMO_API_KEY || 'test-api-key',
        apiSecret: c.env.MOMO_API_SECRET || 'test-api-secret',
        apiUrl: c.env.MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com',
        environment: c.env.MOMO_API_KEY ? 'production' : 'sandbox',
      });
      
      const statusResponse = await momoService.checkPaymentStatus(payment.transaction_id as string);
      
      // Update payment status
      if (statusResponse.status !== payment.status) {
        await c.env.DB.prepare(
          'UPDATE payments SET status = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(
          statusResponse.status === 'SUCCESSFUL' ? 'success' : statusResponse.status === 'FAILED' ? 'failed' : 'pending',
          JSON.stringify(statusResponse),
          paymentId
        ).run();
        
        // Update order if payment successful
        if (statusResponse.status === 'SUCCESSFUL') {
          await c.env.DB.prepare(
            'UPDATE orders SET payment_status = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
          ).bind('paid', 'processing', payment.order_id).run();
        }
      }
      
      return c.json({
        id: payment.id,
        status: statusResponse.status,
        amount: payment.amount,
        currency: payment.currency,
        transactionId: payment.transaction_id,
      });
    }
    
    return c.json({
      id: payment.id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      transactionId: payment.transaction_id,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Webhook for payment notifications (MoMo callback)
paymentRoutes.post('/webhook/momo', async (c) => {
  try {
    const body = await c.req.json();
    
    // Verify webhook signature (in production)
    // const signature = c.req.header('X-Callback-Signature');
    // if (!verifyWebhookSignature(body, signature)) {
    //   return c.json({ error: 'Invalid signature' }, 401);
    // }
    
    const { externalId, financialTransactionId, status } = body;
    
    // Find payment by order number
    const order = await c.env.DB.prepare(
      'SELECT id FROM orders WHERE order_number = ?'
    ).bind(externalId).first();
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Update payment status
    await c.env.DB.prepare(
      'UPDATE payments SET status = ?, provider_response = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ? AND transaction_id = ?'
    ).bind(
      status === 'SUCCESSFUL' ? 'success' : status === 'FAILED' ? 'failed' : 'pending',
      JSON.stringify(body),
      order.id,
      financialTransactionId
    ).run();
    
    // Update order status if payment successful
    if (status === 'SUCCESSFUL') {
      await c.env.DB.prepare(
        'UPDATE orders SET payment_status = ?, status = ?, payment_reference = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind('paid', 'processing', financialTransactionId, order.id).run();
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get payment methods
paymentRoutes.get('/methods', (c) => {
  return c.json([
    {
      id: 'momo',
      name: 'MTN Mobile Money',
      description: 'Pay with MTN MoMo',
      icon: '/static/momo-icon.png',
      active: true,
    },
    {
      id: 'airtel',
      name: 'Airtel Money',
      description: 'Pay with Airtel Money',
      icon: '/static/airtel-icon.png',
      active: false,
    },
    {
      id: 'card',
      name: 'Credit/Debit Card',
      description: 'Pay with Visa or Mastercard',
      icon: '/static/card-icon.png',
      active: false,
    },
  ]);
});

export default paymentRoutes;