import { Hono } from 'hono';
import { Bindings } from '../types';
import { supabase } from '../../lib/supabase';

const productRoutes = new Hono<{ Bindings: Bindings }>();

// Get all products with optional filters
productRoutes.get('/', async (c) => {
  try {
    const categorySlug = c.req.query('category');
    const search = c.req.query('search');
    const featured = c.req.query('featured');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase.from('products').select('*', { count: 'exact' }).eq('is_active', true);

    if (categorySlug) {
      const { data: category } = await supabase.from('categories').select('id').eq('slug', categorySlug).single();
      if (category) {
        query = query.eq('category_id', category.id);
      } else {
        // Category not found, return empty array
        return c.json({ products: [], pagination: { page, limit, total: 0, pages: 1 } });
      }
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.ilike.%${search}%`);
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    query = query.order('is_featured', { ascending: false }).order('created_at', { ascending: false });
    query = query.range(offset, offset + limit - 1);

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    return c.json({
      products: products,
      pagination: {
        page,
        limit,
        total: count,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get single product
productRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');

    const { data: product, error } = await supabase
      .from('products')
      .select('*')
      .eq('id', id)
      .eq('is_active', true)
      .single();

    if (error || !product) {
      return c.json({ error: 'Product not found' }, 404);
    }

    return c.json(product);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all categories - This is the new endpoint for the frontend
productRoutes.get('/categories', async (c) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) {
      throw error;
    }

    return c.json({ categories });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all categories (legacy)
productRoutes.get('/categories/all', async (c) => {
  try {
    const { data: categories, error } = await supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .order('name');

    if (error) {
      throw error;
    }

    return c.json(categories);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Search products (to be refactored)
productRoutes.post('/search', async (c) => {
  return c.json({ error: 'Not implemented yet' }, 501);
});

// Get brands (to be refactored)
productRoutes.get('/brands/all', async (c) => {
  return c.json({ error: 'Not implemented yet' }, 501);
});

export default productRoutes;