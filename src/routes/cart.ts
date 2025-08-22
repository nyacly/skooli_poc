import { Hono } from 'hono';
import { Bindings } from '../types';
import { supabase } from '../../lib/supabase';

const cartRoutes = new Hono<{ Bindings: Bindings }>();

const getUserFromRequest = async (c: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) return null;
    const token = authHeader.split(' ')[1];
    if (!token) return null;
    const { data: { user } } = await supabase.auth.getUser(token);
    return user;
}

// Get cart
cartRoutes.get('/', async (c) => {
    try {
        const user = await getUserFromRequest(c);
        const sessionId = c.req.header('X-Session-Id');

        let query = supabase.from('carts').select('*');

        if (user) {
            query = query.eq('user_id', user.id);
        } else if (sessionId) {
            query = query.eq('session_id', sessionId);
        } else {
            return c.json({ items: [], totalAmount: 0 });
        }

        const { data: cart, error } = await query.order('updated_at', { ascending: false }).limit(1).single();

        if (error || !cart) {
            return c.json({ items: [], summary: { total: 0, count: 0 } });
        }

        return c.json({
            id: cart.id,
            items: cart.items || [],
            summary: cart.summary || { total: 0, count: 0 }
        });
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Add item to cart
cartRoutes.post('/add', async (c) => {
    try {
        const user = await getUserFromRequest(c);
        let sessionId = c.req.header('X-Session-Id');
        const { productId, quantity = 1 } = await c.req.json();

        if (!user && !sessionId) {
            sessionId = `sess_${Date.now()}`;
        }

        // Get product details
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

        if (productError || !product) {
            return c.json({ error: 'Product not found' }, 404);
        }

        if (product.stock_quantity < quantity) {
            return c.json({ error: 'Insufficient stock' }, 400);
        }

        // Get current cart
        let cartQuery = supabase.from('carts').select('*');
        if (user) {
            cartQuery = cartQuery.eq('user_id', user.id);
        } else if (sessionId) {
            cartQuery = cartQuery.eq('session_id', sessionId);
        }
        const { data: existingCart, error: cartError } = await cartQuery.limit(1).single();

        let items = existingCart?.items || [];
        const existingItemIndex = items.findIndex((item: any) => item.productId === productId);

        if (existingItemIndex > -1) {
            items[existingItemIndex].quantity += quantity;
        } else {
            items.push({
                productId: product.id,
                name: product.name,
                price: product.price,
                quantity,
                image_url: product.image_url
            });
        }

        const summary = {
            total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
            count: items.reduce((sum: number, item: any) => sum + item.quantity, 0)
        };

        if (existingCart) {
            const { data, error } = await supabase
                .from('carts')
                .update({ items, summary, updated_at: new Date().toISOString() })
                .eq('id', existingCart.id)
                .select()
                .single();
            if(error) throw error;
            return c.json(data);

        } else {
            const { data, error } = await supabase
                .from('carts')
                .insert({
                    user_id: user?.id,
                    session_id: sessionId,
                    items,
                    summary
                })
                .select()
                .single();
            if(error) throw error;
            return c.json(data, 201);
        }

    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Update cart item
cartRoutes.put('/:itemId', async (c) => {
    try {
        const user = await getUserFromRequest(c);
        const sessionId = c.req.header('X-Session-Id');
        const itemId = c.req.param('itemId');
        const { quantity } = await c.req.json();

        let cartQuery = supabase.from('carts').select('*');
        if (user) {
            cartQuery = cartQuery.eq('user_id', user.id);
        } else if (sessionId) {
            cartQuery = cartQuery.eq('session_id', sessionId);
        } else {
            return c.json({ error: 'Cart not found' }, 404);
        }

        const { data: cart, error: cartError } = await cartQuery.limit(1).single();

        if (cartError || !cart) {
            return c.json({ error: 'Cart not found' }, 404);
        }

        let items = cart.items || [];
        const itemIndex = items.findIndex((item: any) => item.productId === itemId);

        if (itemIndex === -1) {
            return c.json({ error: 'Item not found in cart' }, 404);
        }

        if (quantity <= 0) {
            items.splice(itemIndex, 1);
        } else {
            items[itemIndex].quantity = quantity;
        }

        const summary = {
            total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
            count: items.reduce((sum: number, item: any) => sum + item.quantity, 0)
        };

        const { data, error } = await supabase
            .from('carts')
            .update({ items, summary, updated_at: new Date().toISOString() })
            .eq('id', cart.id)
            .select()
            .single();

        if (error) throw error;

        return c.json(data);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

// Remove item from cart
cartRoutes.delete('/:itemId', async (c) => {
    try {
        const user = await getUserFromRequest(c);
        const sessionId = c.req.header('X-Session-Id');
        const itemId = c.req.param('itemId');

        let cartQuery = supabase.from('carts').select('*');
        if (user) {
            cartQuery = cartQuery.eq('user_id', user.id);
        } else if (sessionId) {
            cartQuery = cartQuery.eq('session_id', sessionId);
        } else {
            return c.json({ error: 'Cart not found' }, 404);
        }

        const { data: cart, error: cartError } = await cartQuery.limit(1).single();

        if (cartError || !cart) {
            return c.json({ error: 'Cart not found' }, 404);
        }

        let items = cart.items || [];
        const updatedItems = items.filter((item: any) => item.productId !== itemId);

        if (items.length === updatedItems.length) {
            return c.json({ error: 'Item not found in cart' }, 404);
        }

        const summary = {
            total: updatedItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
            count: updatedItems.reduce((sum: number, item: any) => sum + item.quantity, 0)
        };

        const { data, error } = await supabase
            .from('carts')
            .update({ items: updatedItems, summary, updated_at: new Date().toISOString() })
            .eq('id', cart.id)
            .select()
            .single();

        if (error) throw error;

        return c.json(data);
    } catch (error: any) {
        return c.json({ error: error.message }, 500);
    }
});

export default cartRoutes;