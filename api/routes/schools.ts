import { Hono } from 'hono';
import { supabase } from '../../lib/supabase.js';

const schools = new Hono();

// Get all active schools
schools.get('/', async (c) => {
  try {
    const { data, error } = await supabase
      .from('schools')
      .select('id, name, code, type, city, district, region, logo_url')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Schools fetch error:', error);
      return c.json({ error: 'Failed to fetch schools' }, 500);
    }

    return c.json({ schools: data || [] });
  } catch (error) {
    console.error('Schools error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

// Get single school by id
schools.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const { data, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      return c.json({ error: 'School not found' }, 404);
    }

    return c.json(data);
  } catch (error) {
    console.error('School fetch error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default schools;

