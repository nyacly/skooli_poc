import { Hono } from 'hono';
// Import Supabase client for payment operations. Include .js extension for Node ESM
import { supabase } from '../../lib/supabase.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const payments = new Hono();

// Middleware to get user from token
async function getUserFromToken(authorization: string | undefined) {
  if (!authorization) return null;
  
  const token = authorization.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

// Payment initialization schema
const initPaymentSchema = z.object({
  orderId: z.string().uuid(),
  method: z.enum(['momo', 'stripe', 'paypal']),
  returnUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional()
});

// Initialize payment
payments.post('/initialize', zValidator('json', initPaymentSchema), async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { orderId, method, returnUrl, cancelUrl } = c.req.valid('json');

    // Get order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    if (order.status !== 'pending') {
      return c.json({ error: 'Order is not pending payment' }, 400);
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        amount: order.total,
        currency: 'USD',
        method,
        status: 'pending',
        metadata: {
          returnUrl,
          cancelUrl
        }
      })
      .select()
      .single();

    if (paymentError || !payment) {
      console.error('Payment creation error:', paymentError);
      return c.json({ error: 'Failed to initialize payment' }, 500);
    }

    // Handle different payment methods
    let paymentData: any = {
      paymentId: payment.id,
      amount: payment.amount,
      currency: payment.currency
    };

    switch (method) {
      case 'momo':
        // Mock MoMo Pay integration
        paymentData = {
          ...paymentData,
          momoUrl: `https://momo.sandbox.com/pay?ref=${payment.id}&amount=${payment.amount}`,
          reference: `MOMO-${payment.id.substring(0, 8).toUpperCase()}`,
          instructions: 'Dial *126# and enter the reference number to complete payment'
        };
        break;

      case 'stripe':
        // Mock Stripe integration
        // In production, you would create a Stripe PaymentIntent here
        paymentData = {
          ...paymentData,
          clientSecret: `pi_mock_${payment.id}_secret_${Math.random().toString(36).substring(7)}`,
          publishableKey: 'pk_test_mock_key',
          paymentIntentId: `pi_mock_${payment.id}`
        };
        break;

      case 'paypal':
        // Mock PayPal integration
        paymentData = {
          ...paymentData,
          approvalUrl: `https://paypal.sandbox.com/checkout?token=${payment.id}`,
          paypalOrderId: `PAYPAL-${payment.id.substring(0, 8).toUpperCase()}`
        };
        break;
    }

    return c.json({
      message: 'Payment initialized',
      payment: paymentData
    });
  } catch (error) {
    console.error('Initialize payment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Confirm payment
const confirmPaymentSchema = z.object({
  paymentId: z.string().uuid(),
  transactionId: z.string().optional(),
  paymentDetails: z.record(z.any()).optional()
});

payments.post('/confirm', zValidator('json', confirmPaymentSchema), async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { paymentId, transactionId, paymentDetails } = c.req.valid('json');

    // Get payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, orders(*)')
      .eq('id', paymentId)
      .single();

    if (paymentError || !payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    if (payment.orders.user_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (payment.status !== 'pending') {
      return c.json({ error: 'Payment is not pending' }, 400);
    }

    // Mock payment verification
    // In production, you would verify with the actual payment provider
    const isPaymentValid = true; // Mock validation

    if (!isPaymentValid) {
      // Update payment as failed
      await supabase
        .from('payments')
        .update({
          status: 'failed',
          failed_at: new Date().toISOString(),
          transaction_id: transactionId,
          metadata: { ...payment.metadata, ...paymentDetails }
        })
        .eq('id', paymentId);

      return c.json({ error: 'Payment verification failed' }, 400);
    }

    // Update payment as completed
    const { error: updatePaymentError } = await supabase
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        transaction_id: transactionId,
        metadata: { ...payment.metadata, ...paymentDetails }
      })
      .eq('id', paymentId);

    if (updatePaymentError) {
      console.error('Payment update error:', updatePaymentError);
      return c.json({ error: 'Failed to update payment' }, 500);
    }

    // Update order status
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({
        status: 'processing',
        paid_at: new Date().toISOString()
      })
      .eq('id', payment.order_id);

    if (updateOrderError) {
      console.error('Order update error:', updateOrderError);
    }

    return c.json({
      message: 'Payment confirmed successfully',
      payment: {
        id: paymentId,
        status: 'completed',
        orderId: payment.order_id,
        amount: payment.amount
      }
    });
  } catch (error) {
    console.error('Confirm payment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get payment status
payments.get('/:paymentId/status', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const paymentId = c.req.param('paymentId');

    const { data: payment, error } = await supabase
      .from('payments')
      .select('*, orders(user_id, order_number)')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    if (payment.orders.user_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    return c.json({
      payment: {
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        transactionId: payment.transaction_id,
        orderNumber: payment.orders.order_number,
        createdAt: payment.created_at,
        paidAt: payment.paid_at,
        failedAt: payment.failed_at
      }
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Cancel payment
payments.post('/:paymentId/cancel', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const paymentId = c.req.param('paymentId');

    const { data: payment, error: fetchError } = await supabase
      .from('payments')
      .select('*, orders(user_id)')
      .eq('id', paymentId)
      .single();

    if (fetchError || !payment) {
      return c.json({ error: 'Payment not found' }, 404);
    }

    if (payment.orders.user_id !== user.id) {
      return c.json({ error: 'Unauthorized' }, 403);
    }

    if (payment.status !== 'pending') {
      return c.json({ error: 'Only pending payments can be cancelled' }, 400);
    }

    // Update payment as cancelled
    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', paymentId);

    if (updateError) {
      console.error('Payment cancel error:', updateError);
      return c.json({ error: 'Failed to cancel payment' }, 500);
    }

    return c.json({
      message: 'Payment cancelled successfully',
      payment: {
        id: paymentId,
        status: 'cancelled'
      }
    });
  } catch (error) {
    console.error('Cancel payment error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Webhook endpoint for payment providers
payments.post('/webhook/:provider', async (c) => {
  try {
    const provider = c.req.param('provider');
    const webhookData = await c.req.json();

    // Verify webhook signature based on provider
    // This is mock implementation - in production, verify signatures properly
    
    console.log(`Webhook received from ${provider}:`, webhookData);

    // Process webhook based on provider
    switch (provider) {
      case 'momo':
        // Process MoMo webhook
        if (webhookData.status === 'SUCCESS') {
          await supabase
            .from('payments')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              transaction_id: webhookData.transactionId
            })
            .eq('metadata->momoReference', webhookData.reference);
        }
        break;

      case 'stripe':
        // Process Stripe webhook
        if (webhookData.type === 'payment_intent.succeeded') {
          await supabase
            .from('payments')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              transaction_id: webhookData.data.object.id
            })
            .eq('metadata->paymentIntentId', webhookData.data.object.id);
        }
        break;

      case 'paypal':
        // Process PayPal webhook
        if (webhookData.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
          await supabase
            .from('payments')
            .update({
              status: 'completed',
              paid_at: new Date().toISOString(),
              transaction_id: webhookData.resource.id
            })
            .eq('metadata->paypalOrderId', webhookData.resource.order_id);
        }
        break;

      default:
        return c.json({ error: 'Unknown provider' }, 400);
    }

    return c.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return c.json({ error: 'Webhook processing failed' }, 500);
  }
});

export default payments;