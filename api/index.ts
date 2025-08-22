import { Hono } from 'hono';
import { handle } from '@hono/node-server/vercel';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';

// Import Supabase-adapted routes
// Explicit .js extensions ensure Node's ESM resolver finds the compiled files
import authRoutes from './routes/auth.js';
import productRoutes from './routes/products.js';
import cartRoutes from './routes/cart.js';
import orderRoutes from './routes/orders.js';
import paymentRoutes from './routes/payments.js';
import schoolRoutes from './routes/schools.js';

export const app = new Hono();

// Middleware
app.use('*', logger());
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173', // Common Vite dev port
];
if (process.env.VITE_APP_URL) {
  allowedOrigins.push(process.env.VITE_APP_URL);
}

app.use('/api/*', cors({
  origin: (origin) => {
    if (!origin) {
      return allowedOrigins[0];
    }
    if (allowedOrigins.includes(origin)) {
      return origin;
    }
    // For previews/tests, allow vercel.app domains
    if (process.env.VERCEL_ENV !== 'production' && new URL(origin).hostname.endsWith('.vercel.app')) {
      return origin;
    }
    return allowedOrigins[0]; // Default to a safe value
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/api/cart', cartRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/payments', paymentRoutes);
app.route('/api/schools', schoolRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'vercel',
    database: 'supabase'
  });
});

// API info endpoint
app.get('/api', (c) => {
  return c.json({
    name: 'Skooli API',
    version: '2.0.0',
    status: 'running',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/products',
      '/api/cart',
      '/api/orders',
      '/api/payments',
      '/api/schools'
    ]
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error('Error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default handle(app);
