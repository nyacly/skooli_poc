import { Hono } from 'hono';
import { Bindings } from '../types';
import { getUserFromToken } from '../utils/auth';
import { supabase } from '../../lib/supabase';

const cartRoutes = new Hono<{ Bindings: Bindings }>();

// Helper to get cart for user or session
async function getCart(userId?: string, sessionId?: string) {
  let query = supabase.from('carts').select('*');

  if (userId) {
    query = query.eq('user_id', userId);
  } else if (sessionId) {
    query = query.eq('session_id', sessionId);
  } else {
    return null;
  }

  const { data, error } = await query.order('updated_at', { ascending: false }).limit(1).single();

  if (error && error.code !== 'PGRST116') { // Ignore 'single row not found' error
    console.error('Get cart error:', error);
  }

  return data;
}

// Get cart
cartRoutes.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    
    const cart = await getCart(user?.id, sessionId);
    
    if (!cart) {
      return c.json({ items: [], totalAmount: 0 });
    }
    
    const items = cart.items || [];
    
    return c.json({
      id: cart.id,
      items,
      totalAmount: cart.total_amount,
    });
  } catch (error: any) {
    console.error('Get cart route error:', error);
    return c.json({ error: 'Failed to retrieve cart', details: error.message }, 500);
  }
});

// Add to cart
cartRoutes.post('/add', async (c) => {
  try {
    const user = await getUserFromToken(c);
    let sessionId = c.req.header('X-Session-Id');
    const { productId, quantity = 1 } = await c.req.json();
    
    if (!user && !sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }

    // Get product
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    if (product.stock_quantity < quantity) {
      return c.json({ error: 'Insufficient stock' }, 400);
    }
    
    // Get or create cart
    let cart = await getCart(user?.id, sessionId);
    let items = cart?.items as any[] || [];
    
    // Add or update item
    const existingItemIndex = items.findIndex((item: any) => item.productId === productId);
    if (existingItemIndex > -1) {
      items[existingItemIndex].quantity += quantity;
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
      const { error: updateError } = await supabase
        .from('carts')
        .update({ items, total_amount: totalAmount, updated_at: new Date().toISOString() })
        .eq('id', cart.id);

      if (updateError) throw updateError;
    } else {
      // Create new cart
      const { data: newCart, error: insertError } = await supabase
        .from('carts')
        .insert({
          user_id: user?.id || null,
          session_id: user ? null : sessionId,
          items,
          total_amount: totalAmount,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      cart = newCart;
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
    console.error('Add to cart error:', error);
    return c.json({ error: 'Failed to add item to cart', details: error.message }, 500);
  }
});

// Update cart item
cartRoutes.put('/update', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    const { productId, quantity } = await c.req.json();
    
    let cart = await getCart(user?.id, sessionId);
    
    if (!cart) {
      return c.json({ error: 'Cart not found' }, 404);
    }
    
    let items = (cart.items as any[]) || [];
    
    const itemIndex = items.findIndex((item: any) => item.productId === productId);

    if (itemIndex > -1) {
      if (quantity === 0) {
        // Remove item
        items.splice(itemIndex, 1);
      } else {
        // Update quantity
        items[itemIndex].quantity = quantity;
      }
    }
    
    // Calculate total
    const totalAmount = items.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0);
    
    // Update cart
    const { error: updateError } = await supabase
      .from('carts')
      .update({ items, total_amount: totalAmount, updated_at: new Date().toISOString() })
      .eq('id', cart.id);

    if (updateError) throw updateError;
    
    return c.json({
      success: true,
      cart: {
        id: cart.id,
        items,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error('Update cart error:', error);
    return c.json({ error: 'Failed to update cart', details: error.message }, 500);
  }
});

// Clear cart
cartRoutes.delete('/clear', async (c) => {
  try {
    const user = await getUserFromToken(c);
    const sessionId = c.req.header('X-Session-Id');
    
    let query = supabase.from('carts').delete();

    if (user) {
      query = query.eq('user_id', user.id);
    } else if (sessionId) {
      query = query.eq('session_id', sessionId);
    } else {
      return c.json({ success: true, message: 'No cart to clear.' });
    }

    const { error } = await query;

    if (error) throw error;
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Clear cart error:', error);
    return c.json({ error: 'Failed to clear cart', details: error.message }, 500);
  }
});

export default cartRoutes;