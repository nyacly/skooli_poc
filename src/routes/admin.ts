import { Hono } from 'hono';
import { Bindings } from '../types';
import { getUserFromToken } from '../utils/auth';
import { supabase } from '../../lib/supabase';
import { Context } from 'hono';

const adminRoutes = new Hono<{ Bindings: Bindings }>();

// Middleware to check admin access
async function requireAdmin(c: Context, next: Function) {
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
    const { data: totalOrders, count: totalOrdersCount } = await supabase.from('orders').select('id', { count: 'exact' });
    const { data: totalCustomers, count: totalCustomersCount } = await supabase.from('users').select('id', { count: 'exact' }).eq('user_type', 'parent');
    const { data: totalProducts, count: totalProductsCount } = await supabase.from('products').select('id', { count: 'exact' }).eq('is_active', true);
    const { data: revenueData, error: revenueError } = await supabase.from('orders').select('total_amount').eq('payment_status', 'paid');
    const { data: pendingOrders, count: pendingOrdersCount } = await supabase.from('orders').select('id', { count: 'exact' }).eq('status', 'pending');

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: weeklyOrders, count: weeklyOrdersCount } = await supabase.from('orders').select('id', { count: 'exact' }).gte('created_at', sevenDaysAgo);

    const totalRevenue = revenueData ? revenueData.reduce((sum, r) => sum + r.total_amount, 0) : 0;
    
    return c.json({
      totalOrders: totalOrdersCount || 0,
      totalCustomers: totalCustomersCount || 0,
      totalProducts: totalProductsCount || 0,
      totalRevenue,
      pendingOrders: pendingOrdersCount || 0,
      weeklyOrders: weeklyOrdersCount || 0,
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
    
    let query = supabase
      .from('orders')
      .select(`
        *,
        users ( email, first_name, last_name )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data: orders, error } = await query;
    if (error) throw error;
    
    return c.json(orders || []);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update order status
adminRoutes.put('/orders/:id/status', requireAdmin, async (c) => {
  try {
    const orderId = c.req.param('id');
    const { status, trackingNumber, deliveryDate } = await c.req.json();
    
    const updates: { [key: string]: any } = {
      status,
      updated_at: new Date().toISOString()
    };
    
    if (trackingNumber) updates.tracking_number = trackingNumber;
    if (deliveryDate) updates.delivery_date = deliveryDate;
    
    const { error } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', orderId);

    if (error) throw error;
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Product management
adminRoutes.post('/products', requireAdmin, async (c) => {
  try {
    const product = await c.req.json();
    
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        sku: product.sku,
        name: product.name,
        description: product.description || null,
        category_id: product.categoryId || null,
        price: product.price,
        compare_price: product.comparePrice || null,
        stock_quantity: product.stockQuantity || 0,
        unit: product.unit || 'piece',
        brand: product.brand || null,
        image_url: product.imageUrl || null,
        is_active: product.isActive,
        is_featured: product.isFeatured,
      })
      .select()
      .single();

    if (error) throw error;

    return c.json({ success: true, id: newProduct.id });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update product
adminRoutes.put('/products/:id', requireAdmin, async (c) => {
  try {
    const productId = c.req.param('id');
    const updates = await c.req.json();
    
    // Convert camelCase to snake_case for Supabase
    const snakeCaseUpdates: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(updates)) {
      const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
      snakeCaseUpdates[snakeKey] = value;
    }
    snakeCaseUpdates.updated_at = new Date().toISOString();
    
    const { error } = await supabase
      .from('products')
      .update(snakeCaseUpdates)
      .eq('id', productId);

    if (error) throw error;
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get inventory levels
adminRoutes.get('/inventory', requireAdmin, async (c) => {
  try {
    const { data: lowStock, error: lowStockError } = await supabase
      .from('products')
      .select('id, sku, name, stock_quantity')
      .eq('is_active', true)
      .lt('stock_quantity', 10)
      .order('stock_quantity');

    if (lowStockError) throw lowStockError;

    const { data: outOfStock, error: outOfStockError } = await supabase
      .from('products')
      .select('id, sku, name')
      .eq('is_active', true)
      .eq('stock_quantity', 0);

    if (outOfStockError) throw outOfStockError;
    
    return c.json({
      lowStock: lowStock || [],
      outOfStock: outOfStock || [],
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default adminRoutes;