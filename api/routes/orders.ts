import { Hono } from 'hono';
import { supabase } from '../../lib/supabase';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const orders = new Hono();

// Middleware to get user from token
async function getUserFromToken(authorization: string | undefined) {
  if (!authorization) return null;
  
  const token = authorization.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

// Create order schema
const createOrderSchema = z.object({
  shippingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1),
    country: z.string().default('US')
  }),
  billingAddress: z.object({
    street: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    zipCode: z.string().min(1),
    country: z.string().default('US')
  }).optional(),
  paymentMethod: z.enum(['momo', 'stripe', 'paypal']),
  couponCode: z.string().optional(),
  notes: z.string().optional()
});

// Create new order from cart
orders.post('/create', zValidator('json', createOrderSchema), async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderData = c.req.valid('json');

    // Get cart items
    const { data: cartItems, error: cartError } = await supabase
      .from('cart_items')
      .select(`
        *,
        products (
          id,
          name,
          price,
          quantity as stock_quantity
        )
      `)
      .eq('user_id', user.id);

    if (cartError || !cartItems || cartItems.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }

    // Validate stock availability
    for (const item of cartItems) {
      if (!item.products) {
        return c.json({ error: `Product not found` }, 400);
      }
      if (item.products.stock_quantity < item.quantity) {
        return c.json({ 
          error: `${item.products.name} has only ${item.products.stock_quantity} items in stock` 
        }, 400);
      }
    }

    // Calculate totals
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.products?.price || 0) * item.quantity;
    }, 0);

    const tax = subtotal * 0.15;
    const shipping = subtotal > 50 ? 0 : 10;
    let discount = 0;

    // Apply coupon if provided
    if (orderData.couponCode) {
      const validCoupons: Record<string, { discount: number, type: string }> = {
        'WELCOME10': { discount: 0.1, type: 'percentage' },
        'SAVE20': { discount: 0.2, type: 'percentage' },
        'SHIP5': { discount: 5, type: 'fixed' }
      };

      const coupon = validCoupons[orderData.couponCode];
      if (coupon) {
        discount = coupon.type === 'percentage' 
          ? subtotal * coupon.discount 
          : coupon.discount;
      }
    }

    const total = subtotal + tax + shipping - discount;

    // Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: user.id,
        order_number: `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        status: 'pending',
        subtotal,
        tax,
        shipping,
        discount,
        total,
        payment_method: orderData.paymentMethod,
        shipping_address: orderData.shippingAddress,
        billing_address: orderData.billingAddress || orderData.shippingAddress,
        notes: orderData.notes
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Order creation error:', orderError);
      return c.json({ error: 'Failed to create order' }, 500);
    }

    // Create order items
    const orderItems = cartItems.map(item => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      price: item.products?.price || 0,
      subtotal: (item.products?.price || 0) * item.quantity
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('Order items error:', itemsError);
      // Order created but items failed - should handle this better in production
    }

    // Update product stock
    for (const item of cartItems) {
      const newQuantity = (item.products?.stock_quantity || 0) - item.quantity;
      await supabase
        .from('products')
        .update({ quantity: newQuantity })
        .eq('id', item.product_id);
    }

    // Clear cart
    await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    return c.json({ 
      message: 'Order created successfully',
      order: {
        id: order.id,
        orderNumber: order.order_number,
        total: order.total,
        status: order.status
      }
    }, 201);
  } catch (error) {
    console.error('Create order error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get user's orders
orders.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { searchParams } = new URL(c.req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    // Build query
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    // Apply pagination
    const start = (page - 1) * limit;
    query = query.range(start, start + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Orders fetch error:', error);
      return c.json({ error: 'Failed to fetch orders' }, 500);
    }

    return c.json({
      orders: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single order details
orders.get('/:orderId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('orderId');

    // Get order with items
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          *,
          products (
            id,
            name,
            image_url,
            sku
          )
        )
      `)
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderError || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Get payment details if exists
    const { data: payment } = await supabase
      .from('payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    return c.json({
      order,
      payment
    });
  } catch (error) {
    console.error('Get order error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Cancel order
orders.post('/:orderId/cancel', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const orderId = c.req.param('orderId');

    // Get order
    const { data: order, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Check if order can be cancelled
    if (!['pending', 'processing'].includes(order.status)) {
      return c.json({ 
        error: `Cannot cancel order with status: ${order.status}` 
      }, 400);
    }

    // Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'cancelled',
        cancelled_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error('Order cancel error:', updateError);
      return c.json({ error: 'Failed to cancel order' }, 500);
    }

    // Restore product stock
    const { data: orderItems } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', orderId);

    if (orderItems) {
      for (const item of orderItems) {
        const { data: product } = await supabase
          .from('products')
          .select('quantity')
          .eq('id', item.product_id)
          .single();

        if (product) {
          await supabase
            .from('products')
            .update({ quantity: product.quantity + item.quantity })
            .eq('id', item.product_id);
        }
      }
    }

    return c.json({ 
      message: 'Order cancelled successfully',
      order: { ...order, status: 'cancelled' }
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Track order
orders.get('/:orderId/track', async (c) => {
  try {
    const orderId = c.req.param('orderId');

    // Get order with limited info for tracking
    const { data: order, error } = await supabase
      .from('orders')
      .select('id, order_number, status, created_at, estimated_delivery')
      .eq('id', orderId)
      .single();

    if (error || !order) {
      return c.json({ error: 'Order not found' }, 404);
    }

    // Mock tracking events
    const trackingEvents = [
      {
        status: 'Order Placed',
        timestamp: order.created_at,
        description: 'Your order has been received'
      }
    ];

    if (['processing', 'shipped', 'delivered'].includes(order.status)) {
      trackingEvents.push({
        status: 'Processing',
        timestamp: new Date(new Date(order.created_at).getTime() + 3600000).toISOString(),
        description: 'Your order is being prepared'
      });
    }

    if (['shipped', 'delivered'].includes(order.status)) {
      trackingEvents.push({
        status: 'Shipped',
        timestamp: new Date(new Date(order.created_at).getTime() + 86400000).toISOString(),
        description: 'Your order has been shipped'
      });
    }

    if (order.status === 'delivered') {
      trackingEvents.push({
        status: 'Delivered',
        timestamp: new Date(new Date(order.created_at).getTime() + 259200000).toISOString(),
        description: 'Your order has been delivered'
      });
    }

    return c.json({
      order: {
        orderNumber: order.order_number,
        status: order.status,
        estimatedDelivery: order.estimated_delivery || 
          new Date(new Date(order.created_at).getTime() + 345600000).toISOString()
      },
      tracking: trackingEvents
    });
  } catch (error) {
    console.error('Track order error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default orders;