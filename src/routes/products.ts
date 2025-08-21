import { Hono } from 'hono';
import { Bindings } from '../types';
import { supabase } from '../../lib/supabase';

const productRoutes = new Hono<{ Bindings: Bindings }>();

// Get all products with optional filters
productRoutes.get('/', async (c) => {
  try {
    const categoryId = c.req.query('category');
    const search = c.req.query('search');
    const featured = c.req.query('featured');
    const page = parseInt(c.req.query('page') || '1');
    const limit = parseInt(c.req.query('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('is_active', true)
      .order('is_featured', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,tags.ilike.%${search}%`);
    }

    if (featured === 'true') {
      query = query.eq('is_featured', true);
    }

    const { data: products, error, count } = await query;

    if (error) {
      throw error;
    }

    return c.json({
      products: products || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Get products error:', error);
    return c.json({ error: 'Failed to fetch products', details: error.message }, 500);
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
    
    // The Supabase client automatically parses JSON fields, so no manual parsing is needed.
    
    return c.json(product);
  } catch (error: any) {
    console.error('Get single product error:', error);
    return c.json({ error: 'Failed to fetch product', details: error.message }, 500);
  }
});

// Get all categories
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
    
    return c.json(categories || []);
  } catch (error: any) {
    console.error('Get categories error:', error);
    return c.json({ error: 'Failed to fetch categories', details: error.message }, 500);
  }
});

// Search products (re-uses the main GET / endpoint logic, but can be kept for compatibility)
productRoutes.post('/search', async (c) => {
  try {
    const { query: searchQuery, filters } = await c.req.json();
    
    if (!searchQuery) {
      return c.json({ error: 'Search query required' }, 400);
    }
    
    let query = supabase
      .from('products')
      .select('*, categories(name)')
      .eq('is_active', true)
      .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,tags.ilike.%${searchQuery}%`)
      .order('is_featured', { ascending: false })
      .order('name')
      .limit(50);
    
    if (filters?.categoryId) {
      query = query.eq('category_id', filters.categoryId);
    }
    
    if (filters?.minPrice) {
      query = query.gte('price', filters.minPrice);
    }
    
    if (filters?.maxPrice) {
      query = query.lte('price', filters.maxPrice);
    }
    
    if (filters?.brand) {
      query = query.eq('brand', filters.brand);
    }
    
    const { data: products, error } = await query;

    if (error) {
      throw error;
    }
    
    return c.json(products || []);
  } catch (error: any) {
    console.error('Search products error:', error);
    return c.json({ error: 'Failed to search products', details: error.message }, 500);
  }
});

// Get brands
productRoutes.get('/brands/all', async (c) => {
  try {
    // Supabase doesn't have a direct DISTINCT ON equivalent in the query builder for a single column.
    // A simple way is to fetch all brands and process them, or use an RPC.
    // For simplicity, we fetch and process here.
    const { data, error } = await supabase
      .from('products')
      .select('brand')
      .eq('is_active', true)
      .not('brand', 'is', null);

    if (error) {
      throw error;
    }

    const brands = [...new Set(data.map(p => p.brand))].sort();
    
    return c.json(brands);
  } catch (error: any) {
    console.error('Get brands error:', error);
    return c.json({ error: 'Failed to fetch brands', details: error.message }, 500);
  }
});

export default productRoutes;