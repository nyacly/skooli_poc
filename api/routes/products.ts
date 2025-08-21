import { Hono } from 'hono';
// Import Supabase client for product queries. Node's ESM requires the .js extension
import { supabase } from '../../lib/supabase.js';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';

const products = new Hono();

// Get all categories
products.get('/categories', async (c) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) {
      console.error('Categories fetch error:', error);
      return c.json({ error: 'Failed to fetch categories' }, 500);
    }

    return c.json({ categories: data || [] });
  } catch (error) {
    console.error('Categories error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get products with pagination and filters
products.get('/', async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '12');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const minPrice = parseFloat(searchParams.get('minPrice') || '0');
    const maxPrice = parseFloat(searchParams.get('maxPrice') || '999999');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build query
    let query = supabase
      .from('products')
      .select('*, categories(name, slug)', { count: 'exact' })
      .gte('price', minPrice)
      .lte('price', maxPrice)
      .eq('is_active', true);

    // Apply category filter
    if (category) {
      const { data: categoryData } = await supabase
        .from('categories')
        .select('id')
        .eq('slug', category)
        .single();
      
      if (categoryData) {
        query = query.eq('category_id', categoryData.id);
      }
    }

    // Apply search filter
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Apply sorting
    const orderColumn = sortBy === 'price' ? 'price' : 'name';
    query = query.order(orderColumn, { ascending: sortOrder === 'asc' });

    // Apply pagination
    const start = (page - 1) * limit;
    query = query.range(start, start + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Products fetch error:', error);
      return c.json({ error: 'Failed to fetch products' }, 500);
    }

    return c.json({
      products: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error) {
    console.error('Products error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single product by ID
products.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('id', id)
      .single();

    if (error || !data) {
      return c.json({ error: 'Product not found' }, 404);
    }

    // Get related products
    const { data: related } = await supabase
      .from('products')
      .select('*')
      .eq('category_id', data.category_id)
      .neq('id', id)
      .eq('is_active', true)
      .limit(4);

    return c.json({
      product: data,
      relatedProducts: related || []
    });
  } catch (error) {
    console.error('Product detail error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Search products
products.get('/search', async (c) => {
  try {
    const { searchParams } = new URL(c.req.url);
    const query = searchParams.get('q') || '';
    const limit = parseInt(searchParams.get('limit') || '10');

    if (!query || query.length < 2) {
      return c.json({ results: [] });
    }

    const { data, error } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .eq('is_active', true)
      .limit(limit);

    if (error) {
      console.error('Search error:', error);
      return c.json({ error: 'Search failed' }, 500);
    }

    return c.json({ results: data || [] });
  } catch (error) {
    console.error('Search error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get featured products
products.get('/featured', async (c) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*, categories(name, slug)')
      .eq('is_featured', true)
      .eq('is_active', true)
      .limit(8);

    if (error) {
      console.error('Featured products error:', error);
      return c.json({ error: 'Failed to fetch featured products' }, 500);
    }

    return c.json({ products: data || [] });
  } catch (error) {
    console.error('Featured products error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin: Create product (requires auth)
const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  category_id: z.string().uuid(),
  sku: z.string().min(1),
  quantity: z.number().int().min(0),
  image_url: z.string().url().optional(),
  is_featured: z.boolean().default(false),
  is_active: z.boolean().default(true)
});

products.post('/', zValidator('json', createProductSchema), async (c) => {
  try {
    // Check admin authorization
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const productData = c.req.valid('json');

    const { data, error } = await supabase
      .from('products')
      .insert(productData)
      .select()
      .single();

    if (error) {
      console.error('Product creation error:', error);
      return c.json({ error: 'Failed to create product' }, 500);
    }

    return c.json({ product: data }, 201);
  } catch (error) {
    console.error('Create product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin: Update product
products.put('/:id', async (c) => {
  try {
    // Check admin authorization
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const id = c.req.param('id');
    const updates = await c.req.json();

    const { data, error } = await supabase
      .from('products')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Product update error:', error);
      return c.json({ error: 'Failed to update product' }, 500);
    }

    return c.json({ product: data });
  } catch (error) {
    console.error('Update product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Admin: Delete product
products.delete('/:id', async (c) => {
  try {
    // Check admin authorization
    const authorization = c.req.header('Authorization');
    if (!authorization) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return c.json({ error: 'Admin access required' }, 403);
    }

    const id = c.req.param('id');

    // Soft delete by setting is_active to false
    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Product delete error:', error);
      return c.json({ error: 'Failed to delete product' }, 500);
    }

    return c.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default products;