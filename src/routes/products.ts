import { Hono } from 'hono';
import { Bindings } from '../types';

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
    
    let query = 'SELECT * FROM products WHERE is_active = 1';
    const params: any[] = [];
    
    if (categoryId) {
      query += ' AND category_id = ?';
      params.push(categoryId);
    }
    
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }
    
    if (featured === 'true') {
      query += ' AND is_featured = 1';
    }
    
    query += ' ORDER BY is_featured DESC, created_at DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const stmt = c.env.DB.prepare(query);
    const products = await stmt.bind(...params).all();
    
    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM products WHERE is_active = 1';
    const countParams: any[] = [];
    
    if (categoryId) {
      countQuery += ' AND category_id = ?';
      countParams.push(categoryId);
    }
    
    if (search) {
      countQuery += ' AND (name LIKE ? OR description LIKE ? OR tags LIKE ?)';
      const searchParam = `%${search}%`;
      countParams.push(searchParam, searchParam, searchParam);
    }
    
    if (featured === 'true') {
      countQuery += ' AND is_featured = 1';
    }
    
    const countStmt = c.env.DB.prepare(countQuery);
    const countResult = await countStmt.bind(...countParams).first();
    const total = countResult?.total || 0;
    
    return c.json({
      products: products.results,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
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
    
    const product = await c.env.DB.prepare(
      'SELECT * FROM products WHERE id = ? AND is_active = 1'
    ).bind(id).first();
    
    if (!product) {
      return c.json({ error: 'Product not found' }, 404);
    }
    
    // Parse JSON fields
    if (product.images) {
      product.images = JSON.parse(product.images as string);
    }
    if (product.specifications) {
      product.specifications = JSON.parse(product.specifications as string);
    }
    if (product.tags) {
      product.tags = JSON.parse(product.tags as string);
    }
    
    return c.json(product);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get all categories
productRoutes.get('/categories/all', async (c) => {
  try {
    const categories = await c.env.DB.prepare(
      'SELECT * FROM categories WHERE is_active = 1 ORDER BY sort_order, name'
    ).all();
    
    return c.json(categories.results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Search products
productRoutes.post('/search', async (c) => {
  try {
    const { query, filters } = await c.req.json();
    
    if (!query) {
      return c.json({ error: 'Search query required' }, 400);
    }
    
    let sql = `
      SELECT p.*, c.name as category_name 
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1 
      AND (p.name LIKE ? OR p.description LIKE ? OR p.brand LIKE ? OR p.tags LIKE ?)
    `;
    
    const params: any[] = [];
    const searchParam = `%${query}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
    
    if (filters?.categoryId) {
      sql += ' AND p.category_id = ?';
      params.push(filters.categoryId);
    }
    
    if (filters?.minPrice) {
      sql += ' AND p.price >= ?';
      params.push(filters.minPrice);
    }
    
    if (filters?.maxPrice) {
      sql += ' AND p.price <= ?';
      params.push(filters.maxPrice);
    }
    
    if (filters?.brand) {
      sql += ' AND p.brand = ?';
      params.push(filters.brand);
    }
    
    sql += ' ORDER BY p.is_featured DESC, p.name';
    sql += ' LIMIT 50';
    
    const products = await c.env.DB.prepare(sql).bind(...params).all();
    
    return c.json(products.results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get brands
productRoutes.get('/brands/all', async (c) => {
  try {
    const brands = await c.env.DB.prepare(
      'SELECT DISTINCT brand FROM products WHERE brand IS NOT NULL AND is_active = 1 ORDER BY brand'
    ).all();
    
    return c.json(brands.results.map(b => b.brand));
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default productRoutes;