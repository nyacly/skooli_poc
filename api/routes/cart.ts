import { Hono } from 'hono';
// Import Supabase client. Include .js for Node ESM resolution
import { supabase } from '../../lib/supabase.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const cart = new Hono();

// Middleware to get user from token
async function getUserFromToken(authorization: string | undefined) {
  if (!authorization) return null;
  
  const token = authorization.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) return null;
  return user;
}

// Get user's cart
cart.get('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Get cart items with product details
    const { data, error } = await supabase
      .from('cart_items')
      .select(`
        *,
        products (
          id,
          name,
          price,
          image_url,
          sku,
          stock_quantity:quantity
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Cart fetch error:', error);
      return c.json({ error: 'Failed to fetch cart' }, 500);
    }

    // Calculate totals
    const items = data || [];
    const subtotal = items.reduce((sum, item) => {
      return sum + (item.products?.price || 0) * item.quantity;
    }, 0);

    const tax = subtotal * 0.15; // 15% tax
    const shipping = subtotal > 50 ? 0 : 10; // Free shipping over $50
    const total = subtotal + tax + shipping;

    return c.json({
      items,
      summary: {
        subtotal,
        tax,
        shipping,
        total,
        itemCount: items.reduce((sum, item) => sum + item.quantity, 0)
      }
    });
  } catch (error) {
    console.error('Cart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Add item to cart
const addToCartSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive()
});

cart.post('/add', zValidator('json', addToCartSchema), async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { productId, quantity } = c.req.valid('json');

    // Check product availability
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, name, price, stock_quantity, is_active')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    if (!product.is_active) {
      return c.json({ error: 'Product is not available' }, 400);
    }

    if (product.stock_quantity < quantity) {
      return c.json({ 
        error: `Only ${product.stock_quantity} items available in stock` 
      }, 400);
    }

    // Check if item already in cart
    const { data: existingItem } = await supabase
      .from('cart_items')
      .select('id, quantity')
      .eq('user_id', user.id)
      .eq('product_id', productId)
      .single();

    if (existingItem) {
      // Update quantity
      const newQuantity = existingItem.quantity + quantity;
      
      if (product.stock_quantity < newQuantity) {
        return c.json({ 
          error: `Cannot add more. Only ${product.stock_quantity} items available` 
        }, 400);
      }

      const { error: updateError } = await supabase
        .from('cart_items')
        .update({ quantity: newQuantity })
        .eq('id', existingItem.id);

      if (updateError) {
        console.error('Cart update error:', updateError);
        return c.json({ error: 'Failed to update cart' }, 500);
      }

      return c.json({ 
        message: 'Cart updated',
        cartItem: { ...existingItem, quantity: newQuantity }
      });
    } else {
      // Add new item
      const { data: newItem, error: insertError } = await supabase
        .from('cart_items')
        .insert({
          user_id: user.id,
          product_id: productId,
          quantity
        })
        .select()
        .single();

      if (insertError) {
        console.error('Cart insert error:', insertError);
        return c.json({ error: 'Failed to add to cart' }, 500);
      }

      return c.json({ 
        message: 'Added to cart',
        cartItem: newItem
      }, 201);
    }
  } catch (error) {
    console.error('Add to cart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Update cart item quantity
const updateQuantitySchema = z.object({
  quantity: z.number().int().positive()
});

cart.put('/:itemId', zValidator('json', updateQuantitySchema), async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const itemId = c.req.param('itemId');
    const { quantity } = c.req.valid('json');

    // Get cart item with product
    const { data: cartItem, error: fetchError } = await supabase
      .from('cart_items')
      .select('*, products(stock_quantity)')
      .eq('id', itemId)
      .eq('user_id', user.id)
      .single();

    if (fetchError || !cartItem) {
      return c.json({ error: 'Cart item not found' }, 404);
    }

    // Check stock
    if (cartItem.products.stock_quantity < quantity) {
      return c.json({ 
        error: `Only ${cartItem.products.stock_quantity} items available` 
      }, 400);
    }

    // Update quantity
    const { error: updateError } = await supabase
      .from('cart_items')
      .update({ quantity })
      .eq('id', itemId);

    if (updateError) {
      console.error('Cart update error:', updateError);
      return c.json({ error: 'Failed to update cart' }, 500);
    }

    return c.json({ 
      message: 'Cart updated',
      cartItem: { ...cartItem, quantity }
    });
  } catch (error) {
    console.error('Update cart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Remove item from cart
cart.delete('/:itemId', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const itemId = c.req.param('itemId');

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', itemId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Cart delete error:', error);
      return c.json({ error: 'Failed to remove item' }, 500);
    }

    return c.json({ message: 'Item removed from cart' });
  } catch (error) {
    console.error('Remove from cart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Clear entire cart
cart.delete('/', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('user_id', user.id);

    if (error) {
      console.error('Cart clear error:', error);
      return c.json({ error: 'Failed to clear cart' }, 500);
    }

    return c.json({ message: 'Cart cleared' });
  } catch (error) {
    console.error('Clear cart error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Apply coupon to cart
cart.post('/coupon', async (c) => {
  try {
    const user = await getUserFromToken(c.req.header('Authorization'));
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { code } = await c.req.json();

    // Mock coupon validation
    const validCoupons = {
      'WELCOME10': { discount: 0.1, type: 'percentage' },
      'SAVE20': { discount: 0.2, type: 'percentage' },
      'SHIP5': { discount: 5, type: 'fixed' }
    };

    const coupon = validCoupons[code as keyof typeof validCoupons];
    
    if (!coupon) {
      return c.json({ error: 'Invalid coupon code' }, 400);
    }

    return c.json({
      message: 'Coupon applied',
      coupon: {
        code,
        ...coupon
      }
    });
  } catch (error) {
    console.error('Apply coupon error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default cart;