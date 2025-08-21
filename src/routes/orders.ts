import { Hono } from 'hono';
import { Bindings } from '../types';
import { getUserFromToken, generateOrderNumber } from '../utils/auth';
import { supabase } from '../../lib/supabase';

const orderRoutes = new Hono<{ Bindings: Bindings }>();

// Create order
orderRoutes.post('/create', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const body = await c.req.json();
    const { studentId, schoolId, schoolListId, shippingAddress, billingAddress, deliveryNotes } = body;
    
    // Get user's cart
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (cartError || !cart || !cart.items) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    const items = cart.items as any[];
    if (items.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    // Calculate totals
    const subtotal = cart.total_amount;
    const taxAmount = subtotal * 0.18; // 18% VAT
    const shippingFee = 15000; // Fixed shipping fee
    const totalAmount = subtotal + taxAmount + shippingFee;
    
    // In a real app, you'd use a transaction here (e.g., an RPC call in Supabase)
    // For this refactor, we'll perform operations sequentially as in the original code.

    // 1. Create order
    const orderNumber = generateOrderNumber();
    const { data: newOrder, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        student_id: studentId || null,
        school_id: schoolId || null,
        school_list_id: schoolListId || null,
        status: 'pending',
        payment_status: 'pending',
        subtotal,
        tax_amount: taxAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        shipping_address: shippingAddress,
        billing_address: billingAddress || shippingAddress,
        delivery_notes: deliveryNotes || null,
      })
      .select()
      .single();

    if (orderInsertError) throw orderInsertError;

    const orderId = newOrder.id;

    // 2. Create order items
    const orderItemsData = items.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));

    const { error: orderItemsError } = await supabase.from('order_items').insert(orderItemsData);
    if (orderItemsError) throw orderItemsError;

    // 3. Update product stock for each item
    for (const item of items) {
      // This is not ideal and should be in a transaction.
      // Supabase Edge Functions or RPC calls are better for this.
      const { error: stockUpdateError } = await supabase.rpc('decrement_stock', {
        product_id_in: item.productId,
        quantity_in: item.quantity
      });
      if (stockUpdateError) console.error(`Stock update failed for product ${item.productId}:`, stockUpdateError);
    }
    
    // 4. Clear cart
    const { error: deleteCartError } = await supabase.from('carts').delete().eq('id', cart.id);
    if (deleteCartError) throw deleteCartError;
    
    return c.json({
      success: true,
      order: { ...newOrder, items },
    });
  } catch (error: any) {
    console.error("Create order error:", error);
    return c.json({ error: 'Failed to create order', details: error.message }, 500);
  }
});

// Get user orders
orderRoutes.get('/my-orders', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const { data: orders, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    return c.json(orders || []);
  } catch (error: any) {
    console.error("Get my-orders error:", error);
    return c.json({ error: 'Failed to fetch orders', details: error.message }, 500);
  }
});

// Get order details
orderRoutes.get('/:id', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const orderId = c.req.param('id');
    
    const { data: order, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products ( name, sku, image_url )
        ),
        payments ( * )
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (error) throw error;
    if (!order) return c.json({ error: 'Order not found' }, 404);
    
    return c.json(order);
  } catch (error: any) {
    console.error("Get order details error:", error);
    return c.json({ error: 'Failed to fetch order details', details: error.message }, 500);
  }
});

// Cancel order
orderRoutes.post('/:id/cancel', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const orderId = c.req.param('id');
    
    // This should also be a transaction
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    if (order.status !== 'pending' && order.status !== 'processing') {
      return c.json({ error: 'Order cannot be cancelled' }, 400);
    }
    
    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', orderId);

    if (updateError) throw updateError;
    
    // Restore product stock
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (itemsError) throw itemsError;

    for (const item of items) {
      await supabase.rpc('increment_stock', {
        product_id_in: item.product_id,
        quantity_in: item.quantity
      });
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Cancel order error:", error);
    return c.json({ error: 'Failed to cancel order', details: error.message }, 500);
  }
});

// Track order
orderRoutes.get('/:orderNumber/track', async (c) => {
  try {
    const orderNumber = c.req.param('orderNumber');
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status, tracking_number, delivery_date, created_at')
      .eq('order_number', orderNumber)
      .single();
    
    if (error || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    return c.json(order);
  } catch (error: any) {
    console.error("Track order error:", error);
    return c.json({ error: 'Failed to track order', details: error.message }, 500);
  }
});

export default orderRoutes;