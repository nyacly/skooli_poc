import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/cloudflare-workers';
import { logger } from 'hono/logger';
import { Bindings } from './types';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import cartRoutes from './routes/cart';
import orderRoutes from './routes/orders';
import schoolListRoutes from './routes/school-lists';
import paymentRoutes from './routes/payments';
import adminRoutes from './routes/admin';
import checkoutRoutes from './routes/checkout';

const app = new Hono<{ Bindings: Bindings }>();

// Middleware
app.use('*', logger());
app.use('/api/*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }));
app.use('/uploads/*', serveStatic({ root: './public' }));

// API Routes
app.route('/api/auth', authRoutes);
app.route('/api/products', productRoutes);
app.route('/api/cart', cartRoutes);
app.route('/api/orders', orderRoutes);
app.route('/api/school-lists', schoolListRoutes);
app.route('/api/payments', paymentRoutes);
app.route('/api/admin', adminRoutes);
app.route('/checkout', checkoutRoutes);

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database on first request
app.get('/api/init', async (c) => {
  try {
    // This endpoint is for development to ensure tables exist
    const result = await c.env.DB.prepare('SELECT COUNT(*) as count FROM sqlite_master WHERE type="table"').first();
    return c.json({ 
      success: true, 
      tables: result?.count || 0,
      message: 'Database initialized' 
    });
  } catch (error: any) {
    return c.json({ error: error.message }, 500);
  }
});

// Main page
app.get('/', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Skooli - School Supplies Made Easy</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <link href="/static/styles.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <!-- Navigation -->
        <nav class="bg-white shadow-lg sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <a href="#" class="text-2xl font-bold text-green-600 nav-link" data-page="home">
                            <i class="fas fa-graduation-cap mr-2"></i>Skooli
                        </a>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="#" class="text-gray-700 hover:text-green-600 nav-link" data-page="products">Shop</a>
                        <a href="/school-lists" class="text-gray-700 hover:text-green-600">School Lists</a>
                        <button id="cartBtn" class="relative text-gray-700 hover:text-green-600">
                            <i class="fas fa-shopping-cart text-xl"></i>
                            <span id="cartCount" class="absolute -top-2 -right-2 bg-orange-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">0</span>
                        </button>
                        <button id="authBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-user mr-2"></i><span id="authText">Sign In</span>
                        </button>
                    </div>
                </div>
            </div>
        </nav>

        <!-- Hero Section -->
        <div id="heroSection" class="bg-gradient-to-r from-green-600 to-blue-600 text-white py-16">
            <div class="max-w-7xl mx-auto px-4 text-center">
                <h2 class="text-4xl font-bold mb-4">Everything Your Child Needs for School</h2>
                <p class="text-xl mb-8">Delivered Directly to Their Dorm!</p>
                <div class="flex justify-center space-x-4">
                    <button id="uploadListBtn" class="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 text-lg">
                        <i class="fas fa-upload mr-2"></i>Upload School List
                    </button>
                    <button id="shopNowBtn" class="bg-white text-green-600 px-6 py-3 rounded-lg hover:bg-gray-100 text-lg">
                        <i class="fas fa-shopping-bag mr-2"></i>Start Shopping
                    </button>
                </div>
            </div>
        </div>

        <!-- How It Works -->
        <div class="py-12 bg-white">
            <div class="max-w-7xl mx-auto px-4">
                <h3 class="text-3xl font-bold text-center mb-8">How It Works</h3>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div class="text-center">
                        <div class="bg-green-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-shopping-basket text-3xl text-green-600"></i>
                        </div>
                        <h4 class="font-semibold mb-2">Parents Shop Online</h4>
                        <p class="text-gray-600">Select school-approved supplies from our verified list</p>
                    </div>
                    <div class="text-center">
                        <div class="bg-blue-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-truck text-3xl text-blue-600"></i>
                        </div>
                        <h4 class="font-semibold mb-2">We Deliver to Schools</h4>
                        <p class="text-gray-600">Packed, labeled, delivered directly to dormitories</p>
                    </div>
                    <div class="text-center">
                        <div class="bg-orange-100 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4">
                            <i class="fas fa-smile text-3xl text-orange-600"></i>
                        </div>
                        <h4 class="font-semibold mb-2">Students Receive on Arrival</h4>
                        <p class="text-gray-600">Hassle-free school reopening</p>
                    </div>
                </div>
            </div>
        </div>

        <!-- Categories -->
        <div class="py-12 bg-gray-50" id="categoriesSection">
            <div class="max-w-7xl mx-auto px-4">
                <h3 class="text-3xl font-bold text-center mb-8">Shop by Category</h3>
                <div id="categoriesGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    <!-- Categories will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Featured Products -->
        <div class="py-12 bg-white" id="featuredSection">
            <div class="max-w-7xl mx-auto px-4">
                <h3 class="text-3xl font-bold text-center mb-8">Featured Products</h3>
                <div id="featuredGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Featured products will be loaded here -->
                </div>
            </div>
        </div>

        <!-- All Products Section -->
        <div id="productsSection" class="py-12 bg-gray-50 hidden">
            <div class="max-w-7xl mx-auto px-4">
                 <div class="flex justify-between items-center mb-8">
                    <h3 class="text-3xl font-bold">All Products</h3>
                    <div class="flex space-x-4">
                        <input type="text" id="searchInput" placeholder="Search products..."
                               class="px-4 py-2 border rounded-lg focus:outline-none focus:border-green-500">
                        <button id="searchBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">
                            <i class="fas fa-search"></i>
                        </button>
                    </div>
                </div>
                <div id="productsGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <!-- Products will be loaded here -->
                </div>
            </div>
        </div>

        <!-- Shopping Cart Modal -->
        <div id="cartModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
                <div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <h3 class="text-2xl font-bold">Shopping Cart</h3>
                        <button id="closeCartBtn" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                </div>
                <div id="cartItems" class="p-6 overflow-y-auto">
                    <!-- Cart items will be loaded here -->
                </div>
                <div class="p-6 border-t bg-gray-50">
                    <div class="flex justify-between mb-2">
                        <span>Subtotal</span>
                        <span id="cartSubtotal">UGX 0</span>
                    </div>
                    <div class="flex justify-between mb-4">
                        <span>Tax</span>
                        <span id="cartTax">UGX 0</span>
                    </div>
                    <div class="flex justify-between text-xl font-bold mb-4">
                        <span>Total</span>
                        <span id="cartTotal">UGX 0</span>
                    </div>
                    <button id="checkoutBtn" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">
                        Proceed to Checkout
                    </button>
                </div>
            </div>
        </div>

        <!-- Upload School List Modal -->
        <div id="upload-modal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg max-w-lg w-full mx-4">
                <div class="p-6">
                    <h3 class="text-2xl font-bold mb-4">Upload School List</h3>
                    <div class="space-y-4">
                        <select id="school-select" class="w-full px-4 py-2 border rounded-lg">
                            <option value="">Select School</option>
                            <option value="1">Kings College Budo</option>
                            <option value="2">Gayaza High School</option>
                            <option value="3">Namugongo SS</option>
                        </select>
                        <div class="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <input type="file" id="file-input" accept=".pdf,.doc,.docx,.txt,.xls,.xlsx" class="hidden">
                            <i class="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4"></i>
                            <p class="text-gray-600 mb-2">Drag and drop your school list here or</p>
                            <button onclick="document.getElementById('file-input').click()" class="text-green-600 hover:text-green-700 font-semibold">
                                Browse Files
                            </button>
                        </div>
                        <button onclick="uploadList()" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">
                            Upload and Auto-Match Items
                        </button>
                        <button onclick="closeUploadModal()" class="w-full bg-gray-200 text-gray-700 py-3 rounded-lg hover:bg-gray-300">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Auth Modal -->
        <div id="authModal" class="hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <div class="bg-white rounded-lg max-w-md w-full mx-4">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 id="authTitle" class="text-2xl font-bold">Sign In</h3>
                        <button id="closeAuthBtn" class="text-gray-500 hover:text-gray-700">
                            <i class="fas fa-times text-xl"></i>
                        </button>
                    </div>
                    <form id="authForm" class="space-y-4">
                        <div id="nameField" class="hidden">
                            <input type="text" id="nameInput" placeholder="Full Name" class="w-full px-4 py-2 border rounded-lg">
                        </div>
                        <input type="email" id="emailInput" placeholder="Email" required class="w-full px-4 py-2 border rounded-lg">
                        <input type="password" id="passwordInput" placeholder="Password" required class="w-full px-4 py-2 border rounded-lg">
                        <button id="authSubmitBtn" type="submit" class="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700">
                            Sign In
                        </button>
                    </form>
                    <p class="text-center mt-4">
                        <a href="#" id="authToggle" class="text-green-600 hover:underline">Don't have an account? Sign Up</a>
                    </p>
                </div>
            </div>
        </div>

        <script src="/static/app.js"></script>
    </body>
    </html>
  `);
});

// Admin page
app.get('/admin', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Dashboard - Skooli</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-100">
        <div class="flex h-screen bg-gray-200">
            <!-- Sidebar -->
            <div class="w-64 bg-gray-800 text-white flex flex-col">
                <div class="px-8 py-4 border-b border-gray-700">
                    <h2 class="text-2xl font-semibold">Skooli Admin</h2>
                </div>
                <nav class="flex-1 px-4 py-4 space-y-2">
                    <a href="/admin" class="flex items-center px-4 py-2 text-gray-100 bg-gray-700 rounded-lg">
                        <i class="fas fa-tachometer-alt mr-3"></i> Dashboard
                    </a>
                    <a href="#" class="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg">
                        <i class="fas fa-box-open mr-3"></i> Products
                    </a>
                    <a href="#" class="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg">
                        <i class="fas fa-shopping-cart mr-3"></i> Orders
                    </a>
                    <a href="#" class="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg">
                        <i class="fas fa-users mr-3"></i> Users
                    </a>
                    <a href="/" class="flex items-center px-4 py-2 text-gray-300 hover:bg-gray-700 rounded-lg mt-auto">
                        <i class="fas fa-arrow-left mr-3"></i> Back to Shop
                    </a>
                </nav>
            </div>

            <!-- Main content -->
            <div class="flex-1 flex flex-col">
                <header class="bg-white shadow-md p-4 flex justify-end">
                    <div id="admin-user" class="flex items-center">
                        <!-- Admin user info will be loaded here -->
                    </div>
                </header>
                <main class="flex-1 p-8">
                    <!-- Tabs -->
                    <div class="mb-8 border-b border-gray-300">
                        <nav class="flex space-x-8" aria-label="Tabs">
                            <button id="tab-dashboard" class="tab-btn border-b-2 border-green-600 text-green-600 whitespace-nowrap pb-4 px-1 text-sm font-medium">Dashboard</button>
                            <button id="tab-products" class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap pb-4 px-1 text-sm font-medium">Products</button>
                            <button id="tab-orders" class="tab-btn border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 whitespace-nowrap pb-4 px-1 text-sm font-medium">Orders</button>
                        </nav>
                    </div>

                    <!-- Dashboard Content -->
                    <div id="content-dashboard" class="tab-content">
                        <h1 class="text-3xl font-bold mb-8">Dashboard</h1>
                        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-gray-600">Total Revenue</h3>
                                <p id="stats-revenue" class="text-3xl font-bold">Loading...</p>
                            </div>
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-gray-600">Total Orders</h3>
                                <p id="stats-orders" class="text-3xl font-bold">Loading...</p>
                            </div>
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-gray-600">New Users</h3>
                                <p id="stats-users" class="text-3xl font-bold">Loading...</p>
                            </div>
                            <div class="bg-white p-6 rounded-lg shadow">
                                <h3 class="text-gray-600">Total Products</h3>
                                <p id="stats-products" class="text-3xl font-bold">Loading...</p>
                            </div>
                        </div>
                    </div>

                    <!-- Products Content -->
                    <div id="content-products" class="tab-content hidden">
                        <div class="flex justify-between items-center mb-8">
                            <h1 class="text-3xl font-bold">Products</h1>
                            <button id="addProductBtn" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700">Add Product</button>
                        </div>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <table class="w-full text-left">
                                <thead>
                                    <tr>
                                        <th class="p-2">Name</th>
                                        <th class="p-2">Price</th>
                                        <th class="p-2">Stock</th>
                                        <th class="p-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody id="products-table-body">
                                    <!-- Product rows will be inserted here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Orders Content -->
                    <div id="content-orders" class="tab-content hidden">
                        <h1 class="text-3xl font-bold mb-8">Orders</h1>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <table class="w-full text-left">
                                <thead>
                                    <tr>
                                        <th class="p-2">Order ID</th>
                                        <th class="p-2">Customer</th>
                                        <th class="p-2">Total</th>
                                        <th class="p-2">Status</th>
                                        <th class="p-2">Date</th>
                                    </tr>
                                </thead>
                                <tbody id="orders-table-body">
                                    <!-- Order rows will be inserted here -->
                                </tbody>
                            </table>
                        </div>
                    </div>

                </main>
            </div>
        </div>
        <script src="/static/admin.js"></script>
    </body>
    </html>
  `);
});

// School lists page
app.get('/school-lists', (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>School Lists - Skooli</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gray-50">
        <nav class="bg-white shadow-lg sticky top-0 z-50">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="flex justify-between h-16">
                    <div class="flex items-center">
                        <a href="/" class="text-2xl font-bold text-green-600">
                            <i class="fas fa-graduation-cap mr-2"></i>Skooli
                        </a>
                    </div>
                    <div class="flex items-center space-x-4">
                        <a href="/" class="text-gray-700 hover:text-green-600">Shop</a>
                        <a href="/school-lists" class="text-green-600 font-semibold">School Lists</a>
                    </div>
                </div>
            </div>
        </nav>

        <div class="max-w-7xl mx-auto px-4 py-12">
            <h2 class="text-3xl font-bold mb-8">Available School Lists</h2>
            <div id="school-lists" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- School lists will be loaded here -->
            </div>
        </div>

        <script src="/static/school-lists.js"></script>
    </body>
    </html>
  `);
});

export default app;