import { Hono } from 'hono';
import { Bindings } from '../types';
import { getUserFromToken } from '../utils/auth';

const adminRoutes = new Hono<{ Bindings: Bindings }>();

// Middleware to check admin access
async function requireAdmin(c: any, next: any) {
  const user = await getUserFromToken(c);
  if (!user || user.user_type !== 'admin') {
    return c.json({ error: 'Admin access required' }, 403);
  }
  c.set('user', user);
  await next();
}

// Dashboard stats
adminRoutes.get('/dashboard', requireAdmin, async (c) => {
  try {
    // Get stats
    const stats = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as count FROM orders').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM users WHERE user_type = "parent"').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM products WHERE is_active = 1').first(),
      c.env.DB.prepare('SELECT SUM(total_amount) as total FROM orders WHERE payment_status = "paid"').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE status = "pending"').first(),
      c.env.DB.prepare('SELECT COUNT(*) as count FROM orders WHERE created_at >= datetime("now", "-7 days")').first(),
    ]);
    
    return c.json({
      totalOrders: stats[0]?.count || 0,
      totalCustomers: stats[1]?.count || 0,
      totalProducts: stats[2]?.count || 0,
      totalRevenue: stats[3]?.total || 0,
      pendingOrders: stats[4]?.count || 0,
      weeklyOrders: stats[5]?.count || 0,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all orders
adminRoutes.get('/orders', requireAdmin, async (c) => {
  try {
    const status = c.req.query('status');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT o.*, u.email, u.first_name, u.last_name 
      FROM orders o 
      JOIN users u ON o.user_id = u.id
    `;
    
    const params: any[] = [];
    
    if (status) {
      query += ' WHERE o.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const orders = await c.env.DB.prepare(query).bind(...params).all();
    
    return c.json(orders.results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update order status
adminRoutes.put('/orders/:id/status', requireAdmin, async (c) => {
  try {
    const orderId = c.req.param('id');
    const { status, trackingNumber, deliveryDate } = await c.req.json();
    
    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];
    
    if (trackingNumber) {
      updates.push('tracking_number = ?');
      params.push(trackingNumber);
    }
    
    if (deliveryDate) {
      updates.push('delivery_date = ?');
      params.push(deliveryDate);
    }
    
    params.push(orderId);
    
    await c.env.DB.prepare(
      `UPDATE orders SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...params).run();
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Product management
adminRoutes.post('/products', requireAdmin, async (c) => {
  try {
    const product = await c.req.json();
    
    const result = await c.env.DB.prepare(
      `INSERT INTO products (sku, name, description, category_id, price, compare_price, stock_quantity, unit, brand, image_url, is_active, is_featured)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      product.sku,
      product.name,
      product.description || null,
      product.categoryId || null,
      product.price,
      product.comparePrice || null,
      product.stockQuantity || 0,
      product.unit || 'piece',
      product.brand || null,
      product.imageUrl || null,
      product.isActive ? 1 : 0,
      product.isFeatured ? 1 : 0
    ).run();
    
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update product
adminRoutes.put('/products/:id', requireAdmin, async (c) => {
  try {
    const productId = c.req.param('id');
    const updates = await c.req.json();
    
    const fields = [];
    const params = [];
    
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      fields.push(`${snakeKey} = ?`);
      params.push(value);
    }
    
    params.push(productId);
    
    await c.env.DB.prepare(
      `UPDATE products SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    ).bind(...params).run();
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get inventory levels
adminRoutes.get('/inventory', requireAdmin, async (c) => {
  try {
    const lowStock = await c.env.DB.prepare(
      `SELECT id, sku, name, stock_quantity 
       FROM products 
       WHERE is_active = 1 AND stock_quantity < 10 
       ORDER BY stock_quantity`
    ).all();
    
    const outOfStock = await c.env.DB.prepare(
      `SELECT id, sku, name 
       FROM products 
       WHERE is_active = 1 AND stock_quantity = 0`
    ).all();
    
    return c.json({
      lowStock: lowStock.results,
      outOfStock: outOfStock.results,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default adminRoutes;