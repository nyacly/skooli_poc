import { Hono } from 'hono';
import { Bindings, OrderSchema } from '../types';
import { getUserFromToken, generateOrderNumber } from '../utils/auth';

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
    const cart = await c.env.DB.prepare(
      'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(user.id).first();
    
    if (!cart || !cart.items) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    const items = JSON.parse(cart.items as string);
    if (items.length === 0) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    // Calculate totals
    const subtotal = parseFloat(cart.total_amount as string);
    const taxAmount = subtotal * 0.18; // 18% VAT
    const shippingFee = 15000; // Fixed shipping fee
    const totalAmount = subtotal + taxAmount + shippingFee;
    
    // Create order
    const orderNumber = generateOrderNumber();
    
    const result = await c.env.DB.prepare(
      `INSERT INTO orders (
        order_number, user_id, student_id, school_id, school_list_id,
        status, payment_status, subtotal, tax_amount, shipping_fee,
        total_amount, shipping_address, billing_address, delivery_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderNumber,
      user.id,
      studentId || null,
      schoolId || null,
      schoolListId || null,
      'pending',
      'pending',
      subtotal,
      taxAmount,
      shippingFee,
      totalAmount,
      JSON.stringify(shippingAddress),
      JSON.stringify(billingAddress || shippingAddress),
      deliveryNotes || null
    ).run();
    
    const orderId = result.meta.last_row_id;
    
    // Create order items
    for (const item of items) {
      await c.env.DB.prepare(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(
        orderId,
        item.productId,
        item.quantity,
        item.price,
        item.price * item.quantity
      ).run();
      
      // Update product stock
      await c.env.DB.prepare(
        'UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ?'
      ).bind(item.quantity, item.productId).run();
    }
    
    // Clear cart
    await c.env.DB.prepare('DELETE FROM carts WHERE id = ?').bind(cart.id).run();
    
    return c.json({
      success: true,
      order: {
        id: orderId,
        orderNumber,
        status: 'pending',
        paymentStatus: 'pending',
        subtotal,
        taxAmount,
        shippingFee,
        totalAmount,
        items,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get user orders
orderRoutes.get('/my-orders', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const orders = await c.env.DB.prepare(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC`
    ).bind(user.id).all();
    
    return c.json(orders.results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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
    
    // Get order
    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).bind(orderId, user.id).first();
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    // Get order items
    const items = await c.env.DB.prepare(
      `SELECT oi.*, p.name, p.sku, p.image_url
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = ?`
    ).bind(orderId).all();
    
    // Get payment info
    const payment = await c.env.DB.prepare(
      'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC LIMIT 1'
    ).bind(orderId).first();
    
    return c.json({
      ...order,
      items: items.results,
      payment,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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
    
    // Get order
    const order = await c.env.DB.prepare(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?'
    ).bind(orderId, user.id).first();
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    if (order.status !== 'pending' && order.status !== 'processing') {
      return c.json({ error: 'Order cannot be cancelled' }, 400);
    }
    
    // Update order status
    await c.env.DB.prepare(
      'UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind('cancelled', orderId).run();
    
    // Restore product stock
    const items = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(orderId).all();
    
    for (const item of items.results) {
      await c.env.DB.prepare(
        'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?'
      ).bind(item.quantity, item.product_id).run();
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Track order
orderRoutes.get('/:orderNumber/track', async (c) => {
  try {
    const orderNumber = c.req.param('orderNumber');
    
    const order = await c.env.DB.prepare(
      'SELECT id, order_number, status, payment_status, tracking_number, delivery_date, created_at FROM orders WHERE order_number = ?'
    ).bind(orderNumber).first();
    
    if (!order) {
      return c.json({ error: 'Order not found' }, 404);
    }
    
    return c.json(order);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default orderRoutes;