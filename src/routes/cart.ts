import { Hono } from 'hono';
import { Bindings, CartSchema } from '../types';
import { getUserFromToken } from '../utils/auth';

const cartRoutes = new Hono<{ Bindings: Bindings }>();

// Get cart
cartRoutes.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    
    let cart;
    if (user) {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(user.id).first();
    } else if (sessionId) {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(sessionId).first();
    }
    
    if (!cart) {
      return c.json({ items: [], totalAmount: 0 });
    }
    
    const items = cart.items ? JSON.parse(cart.items as string) : [];
    
    return c.json({
      id: cart.id,
      items,
      totalAmount: cart.total_amount,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Add to cart
cartRoutes.post('/add', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id') || `sess_${Date.now()}`;
    const { productId, quantity = 1 } = await c.req.json();
    
    // Get product
    const product = await c.env.DB.prepare(
      'SELECT * FROM products WHERE id = ? AND is_active = 1'
    ).bind(productId).first();
    
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    if (product.stock_quantity < quantity) {
      return c.json({ error: 'Insufficient stock' }, 400);
    }
    
    // Get or create cart
    let cart;
    if (user) {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(user.id).first();
    } else {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(sessionId).first();
    }
    
    let items = cart?.items ? JSON.parse(cart.items as string) : [];
    
    // Add or update item
    const existingItem = items.find((item: any) => item.productId === productId);
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      items.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        quantity,
        imageUrl: product.image_url,
      });
    }
    
    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0);
    
    if (cart) {
      // Update existing cart
      await c.env.DB.prepare(
        'UPDATE carts SET items = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(JSON.stringify(items), totalAmount, cart.id).run();
    } else {
      // Create new cart
      const result = await c.env.DB.prepare(
        'INSERT INTO carts (user_id, session_id, items, total_amount) VALUES (?, ?, ?, ?)'
      ).bind(
        user?.id || null,
        user ? null : sessionId,
        JSON.stringify(items),
        totalAmount
      ).run();
      
      cart = { id: result.meta.last_row_id };
    }
    
    return c.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        totalAmount,
      },
      sessionId: user ? undefined : sessionId,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Update cart item
cartRoutes.put('/update', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    const { productId, quantity } = await c.req.json();
    
    // Get cart
    let cart;
    if (user) {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(user.id).first();
    } else if (sessionId) {
      cart = await c.env.DB.prepare(
        'SELECT * FROM carts WHERE session_id = ? ORDER BY updated_at DESC LIMIT 1'
      ).bind(sessionId).first();
    }
    
    if (!cart) {
      return c.json({ error: 'Cart not found' }, 404);
    }
    
    let items = cart.items ? JSON.parse(cart.items as string) : [];
    
    if (quantity === 0) {
      // Remove item
      items = items.filter((item: any) => item.productId !== productId);
    } else {
      // Update quantity
      const item = items.find((item: any) => item.productId === productId);
      if (item) {
        item.quantity = quantity;
      }
    }
    
    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0);
    
    // Update cart
    await c.env.DB.prepare(
      'UPDATE carts SET items = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(JSON.stringify(items), totalAmount, cart.id).run();
    
    return c.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        totalAmount,
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Clear cart
cartRoutes.delete('/clear', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    
    if (user) {
      await c.env.DB.prepare(
        'DELETE FROM carts WHERE user_id = ?'
      ).bind(user.id).run();
    } else if (sessionId) {
      await c.env.DB.prepare(
        'DELETE FROM carts WHERE session_id = ?'
      ).bind(sessionId).run();
    }
    
    return c.json({ success: true });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default cartRoutes;