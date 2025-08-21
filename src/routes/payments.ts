import { Hono } from 'hono';
import { Bindings, PaymentRequestSchema } from '../types';
import { supabase } from '../../lib/supabase';
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
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
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
    
    const paymentResponse = await momoService.requestPayment(order.order_number, phoneNumber, order.total_amount, 'UGX', `Payment for Skooli order ${order.order_number}`);
    
    // Save payment record
    const { data: newPayment, error: paymentInsertError } = await supabase
      .from('payments')
      .insert({
        order_id: orderId,
        transaction_id: paymentResponse.financialTransactionId || `PENDING-${Date.now()}`,
        payment_method: paymentMethod,
        amount: order.total_amount,
        currency: 'UGX',
        status: paymentResponse.status === 'SUCCESSFUL' ? 'success' : 'pending',
        provider_response: paymentResponse as any,
        momo_number: phoneNumber,
      })
      .select()
      .single();

    if (paymentInsertError) throw paymentInsertError;

    // Update order payment status if successful
    if (paymentResponse.status === 'SUCCESSFUL') {
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_method: paymentMethod,
          payment_reference: paymentResponse.financialTransactionId,
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);
    }
    
    return c.json({
      success: true,
      paymentId: newPayment.id,
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
    console.error("Initiate payment error:", error);
    return c.json({ error: 'Failed to initiate payment', details: error.message }, 500);
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
    
    // Get payment record and verify ownership via order
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select('*, orders!inner(user_id)')
      .eq('id', paymentId)
      .eq('orders.user_id', user.id)
      .single();
    
    if (paymentError || !payment) {
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
      
      if (statusResponse.status !== payment.status) {
        const newStatus = statusResponse.status === 'SUCCESSFUL' ? 'success' : statusResponse.status === 'FAILED' ? 'failed' : 'pending';

        await supabase
          .from('payments')
          .update({ status: newStatus, provider_response: statusResponse as any, updated_at: new Date().toISOString() })
          .eq('id', paymentId);
        
        if (statusResponse.status === 'SUCCESSFUL') {
          await supabase
            .from('orders')
            .update({ payment_status: 'paid', status: 'processing', updated_at: new Date().toISOString() })
            .eq('id', payment.order_id);
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
    console.error("Check payment status error:", error);
    return c.json({ error: 'Failed to check payment status', details: error.message }, 500);
  }
});

// Webhook for payment notifications (MoMo callback)
paymentRoutes.post('/webhook/momo', async (c) => {
  try {
    const body = await c.req.json();
    const { externalId, financialTransactionId, status } = body;
    
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('order_number', externalId)
      .single();
    
    if (orderError || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    const newStatus = status === 'SUCCESSFUL' ? 'success' : status === 'FAILED' ? 'failed' : 'pending';

    await supabase
      .from('payments')
      .update({ status: newStatus, provider_response: body, updated_at: new Date().toISOString() })
      .eq('order_id', order.id)
      .eq('transaction_id', financialTransactionId);

    if (status === 'SUCCESSFUL') {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', status: 'processing', payment_reference: financialTransactionId, updated_at: new Date().toISOString() })
        .eq('id', order.id);
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error("MoMo webhook error:", error);
    return c.json({ error: 'Failed to process webhook', details: error.message }, 500);
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