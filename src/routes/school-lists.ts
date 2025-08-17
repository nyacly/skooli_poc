import { Hono } from 'hono';
import { Bindings, SchoolListSchema } from '../types';
import { getUserFromToken } from '../utils/auth';

const schoolListRoutes = new Hono<{ Bindings: Bindings }>();

// Get all school lists
schoolListRoutes.get('/', async (c) => {
  try {
    const schoolId = c.req.query('school');
    const listType = c.req.query('type');
    const classParam = c.req.query('class');
    
    let query = 'SELECT sl.*, s.name as school_name FROM school_lists sl JOIN schools s ON sl.school_id = s.id WHERE sl.is_active = 1';
    const params: any[] = [];
    
    if (schoolId) {
      query += ' AND sl.school_id = ?';
      params.push(schoolId);
    }
    
    if (listType) {
      query += ' AND sl.list_type = ?';
      params.push(listType);
    }
    
    if (classParam) {
      query += ' AND sl.class = ?';
      params.push(classParam);
    }
    
    query += ' ORDER BY sl.created_at DESC';
    
    const lists = await c.env.DB.prepare(query).bind(...params).all();
    
    // Parse items JSON
    const results = lists.results.map(list => ({
      ...list,
      items: list.items ? JSON.parse(list.items as string) : [],
    }));
    
    return c.json(results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get single school list
schoolListRoutes.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    
    const list = await c.env.DB.prepare(
      'SELECT sl.*, s.name as school_name FROM school_lists sl JOIN schools s ON sl.school_id = s.id WHERE sl.id = ?'
    ).bind(id).first();
    
    if (!list) {
      return c.json({ error: 'School list not found' }, 404);
    }
    
    // Parse items and match with products
    const items = list.items ? JSON.parse(list.items as string) : [];
    const matchedItems = [];
    
    for (const item of items) {
      let product = null;
      
      // Try to find matching product
      if (item.matched_product_id) {
        product = await c.env.DB.prepare(
          'SELECT id, sku, name, price, image_url FROM products WHERE id = ? AND is_active = 1'
        ).bind(item.matched_product_id).first();
      } else {
        // Try to match by name
        product = await c.env.DB.prepare(
          'SELECT id, sku, name, price, image_url FROM products WHERE name LIKE ? AND is_active = 1 LIMIT 1'
        ).bind(`%${item.name}%`).first();
      }
      
      matchedItems.push({
        ...item,
        product,
      });
    }
    
    return c.json({
      ...list,
      items: matchedItems,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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
    const { studentId, selectedItems } = await c.req.json();
    
    // Get school list
    const list = await c.env.DB.prepare(
      'SELECT * FROM school_lists WHERE id = ? AND is_active = 1'
    ).bind(listId).first();
    
    if (!list) {
      return c.json({ error: 'School list not found' }, 404);
    }
    
    const items = JSON.parse(list.items as string);
    
    // Get or create cart
    let cart = await c.env.DB.prepare(
      'SELECT * FROM carts WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1'
    ).bind(user.id).first();
    
    let cartItems = cart?.items ? JSON.parse(cart.items as string) : [];
    
    // Add selected items to cart
    for (const item of items) {
      if (selectedItems && !selectedItems.includes(item.name)) {
        continue;
      }
      
      // Find matching product
      let product;
      if (item.matched_product_id) {
        product = await c.env.DB.prepare(
          'SELECT * FROM products WHERE id = ? AND is_active = 1'
        ).bind(item.matched_product_id).first();
      } else {
        product = await c.env.DB.prepare(
          'SELECT * FROM products WHERE name LIKE ? AND is_active = 1 LIMIT 1'
        ).bind(`%${item.name}%`).first();
      }
      
      if (product) {
        // Check if item already in cart
        const existingItem = cartItems.find((ci: any) => ci.productId === product.id);
        if (existingItem) {
          existingItem.quantity += item.quantity;
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
    
    // Calculate total
    const totalAmount = cartItems.reduce((sum: number, item: any) => 
      sum + (item.price * item.quantity), 0);
    
    if (cart) {
      // Update existing cart
      await c.env.DB.prepare(
        'UPDATE carts SET items = ?, total_amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
      ).bind(JSON.stringify(cartItems), totalAmount, cart.id).run();
    } else {
      // Create new cart
      const result = await c.env.DB.prepare(
        'INSERT INTO carts (user_id, items, total_amount) VALUES (?, ?, ?)'
      ).bind(user.id, JSON.stringify(cartItems), totalAmount).run();
      
      cart = { id: result.meta.last_row_id };
    }
    
    return c.json({
      success: true,
      cart: {
        id: cart.id,
        items: cartItems,
        totalAmount,
      },
      schoolListId: listId,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
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
    
    // Parse the file content (simplified - in production, use proper parsing)
    const lines = fileContent.split('\n').filter((line: string) => line.trim());
    const parsedItems = [];
    
    for (const line of lines) {
      // Simple parsing - extract quantity and item name
      const match = line.match(/(\d+)\s+(.+)/);
      if (match) {
        const [, quantity, name] = match;
        parsedItems.push({
          name: name.trim(),
          quantity: parseInt(quantity),
        });
      }
    }
    
    // Try to match products
    const matchedProducts = [];
    for (const item of parsedItems) {
      const product = await c.env.DB.prepare(
        'SELECT id, name, price FROM products WHERE name LIKE ? AND is_active = 1 LIMIT 1'
      ).bind(`%${item.name}%`).first();
      
      if (product) {
        matchedProducts.push({
          ...item,
          matched_product_id: product.id,
          matched_product_name: product.name,
          matched_product_price: product.price,
        });
      } else {
        matchedProducts.push(item);
      }
    }
    
    // Save uploaded list
    const result = await c.env.DB.prepare(
      `INSERT INTO uploaded_lists (user_id, school_id, student_id, file_name, parsed_items, matched_products, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      user.id,
      schoolId || null,
      studentId || null,
      fileName,
      JSON.stringify(parsedItems),
      JSON.stringify(matchedProducts),
      'matched'
    ).run();
    
    return c.json({
      success: true,
      uploadId: result.meta.last_row_id,
      parsedItems,
      matchedProducts,
      matchRate: (matchedProducts.filter(p => p.matched_product_id).length / parsedItems.length) * 100,
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Get schools
schoolListRoutes.get('/schools/all', async (c) => {
  try {
    const schools = await c.env.DB.prepare(
      'SELECT * FROM schools WHERE is_active = 1 ORDER BY name'
    ).all();
    
    return c.json(schools.results);
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

export default schoolListRoutes;