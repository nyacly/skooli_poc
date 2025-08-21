import { Hono } from 'hono';
import { Bindings, SchoolListSchema } from '../types';
import { supabase } from '../../lib/supabase';
import { getUserFromToken } from '../utils/auth';

const schoolListRoutes = new Hono<{ Bindings: Bindings }>();

// Get all school lists
schoolListRoutes.get('/', async (c) => {
  try {
    const schoolId = c.req.query('school');
    const listType = c.req.query('type');
    const classParam = c.req.query('class');
    
    let query = supabase
      .from('school_lists')
      .select('*, schools ( name )')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (schoolId) {
      query = query.eq('school_id', schoolId);
    }
    if (listType) {
      query = query.eq('list_type', listType);
    }
    if (classParam) {
      query = query.eq('class', classParam);
    }
    
    const { data: lists, error } = await query;

    if (error) throw error;
    
    // Supabase client automatically parses JSONB, so no manual parsing needed.
    return c.json(lists || []);
  } catch (error: any) {
    console.error("Get school lists error:", error);
    return c.json({ error: 'Failed to fetch school lists', details: error.message }, 500);
  }
});

// Get single school list
schoolListRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const { data: list, error } = await supabase
      .from('school_lists')
      .select('*, schools (name)')
      .eq('id', id)
      .single();
    
    if (error || !list) {
      return c.json({ error: 'School list not found' }, 404);
    }
    
    const items = (list.items as any[]) || [];
    const matchedItems = [];
    
    for (const item of items) {
      let productQuery = supabase
        .from('products')
        .select('id, sku, name, price, image_url')
        .eq('is_active', true);

      if (item.matched_product_id) {
        productQuery = productQuery.eq('id', item.matched_product_id);
      } else {
        productQuery = productQuery.ilike('name', `%${item.name}%`).limit(1);
      }
      
      const { data: product } = await productQuery.single();

      matchedItems.push({
        ...item,
        product: product || null,
      });
    }
    
    return c.json({
      ...list,
      items: matchedItems,
    });
  } catch (error: any) {
    console.error("Get single school list error:", error);
    return c.json({ error: 'Failed to fetch school list', details: error.message }, 500);
  }
});

// Quick order from school list
schoolListRoutes.post('/:id/quick-order', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const listId = c.req.param('id');
    const { selectedItems } = await c.req.json();

    const { data: list, error: listError } = await supabase
      .from('school_lists')
      .select('*')
      .eq('id', listId)
      .eq('is_active', true)
      .single();

    if (listError || !list) {
      return c.json({ error: 'School list not found' }, 404);
    }
    
    const items = (list.items as any[]) || [];
    
    const { data: cartData } = await supabase.from('carts').select('*').eq('user_id', user.id).limit(1).single();
    let cart = cartData;
    let cartItems = (cart?.items as any[]) || [];
    
    for (const item of items) {
      if (selectedItems && !selectedItems.includes(item.name)) continue;

      let productQuery = supabase.from('products').select('*').eq('is_active', true);
      if (item.matched_product_id) {
        productQuery = productQuery.eq('id', item.matched_product_id);
      } else {
        productQuery = productQuery.ilike('name', `%${item.name}%`).limit(1);
      }
      const { data: product } = await productQuery.single();
      
      if (product) {
        const existingItemIndex = cartItems.findIndex((ci: any) => ci.productId === product.id);
        if (existingItemIndex > -1) {
          cartItems[existingItemIndex].quantity += item.quantity;
        } else {
          cartItems.push({
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: product.price,
            quantity: item.quantity,
            imageUrl: product.image_url,
          });
        }
      }
    }
    
    const totalAmount = cartItems.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);
    
    if (cart) {
      await supabase.from('carts').update({ items: cartItems, total_amount: totalAmount, updated_at: new Date().toISOString() }).eq('id', cart.id);
    } else {
      const { data: newCart } = await supabase.from('carts').insert({ user_id: user.id, items: cartItems, total_amount: totalAmount }).select().single();
      cart = newCart;
    }
    
    return c.json({
      success: true,
      cart: { id: cart.id, items: cartItems, totalAmount },
      schoolListId: listId,
    });
  } catch (error: any) {
    console.error("Quick order error:", error);
    return c.json({ error: 'Failed to create quick order', details: error.message }, 500);
  }
});

// Upload and parse school list
schoolListRoutes.post('/upload', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const { schoolId, studentId, fileName, fileContent } = await c.req.json();
    
    const lines = fileContent.split('\n').filter((line: string) => line.trim());
    const parsedItems = [];
    
    for (const line of lines) {
      const match = line.match(/(\d+)\s+(.+)/);
      if (match) {
        const [, quantity, name] = match;
        parsedItems.push({ name: name.trim(), quantity: parseInt(quantity) });
      }
    }
    
    const matchedProducts = [];
    for (const item of parsedItems) {
      const { data: product } = await supabase
        .from('products')
        .select('id, name, price')
        .ilike('name', `%${item.name}%`)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (product) {
        matchedProducts.push({ ...item, matched_product_id: product.id, matched_product_name: product.name, matched_product_price: product.price });
      } else {
        matchedProducts.push(item);
      }
    }
    
    const { data: newUpload, error } = await supabase
      .from('uploaded_lists')
      .insert({
        user_id: user.id,
        school_id: schoolId || null,
        student_id: studentId || null,
        file_name: fileName,
        parsed_items: parsedItems,
        matched_products: matchedProducts,
        status: 'matched',
      })
      .select()
      .single();

    if (error) throw error;
    
    return c.json({
      success: true,
      uploadId: newUpload.id,
      parsedItems,
      matchedProducts,
      matchRate: (matchedProducts.filter((p: any) => p.matched_product_id).length / parsedItems.length) * 100,
    });
  } catch (error: any) {
    console.error("Upload list error:", error);
    return c.json({ error: 'Failed to upload list', details: error.message }, 500);
  }
});

// Get schools
schoolListRoutes.get('/schools/all', async (c) => {
  try {
    const { data: schools, error } = await supabase
      .from('schools')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    
    return c.json(schools || []);
  } catch (error: any) {
    console.error("Get schools error:", error);
    return c.json({ error: 'Failed to fetch schools', details: error.message }, 500);
  }
});

export default schoolListRoutes;