# Skooli E-commerce Platform

## Project Overview
- **Name**: Skooli - School Supplies E-commerce Platform
- **Goal**: Transform education logistics across Africa by providing a comprehensive platform for school supplies ordering, delivery, and management
- **Tech Stack**: Hono + TypeScript + Cloudflare Pages + D1 Database + MoMo Pay Integration

## Live URLs
- **Development**: https://3000-i6vrmbizli9ulwzhopw0p-6532622b.e2b.dev
- **Production**: Will be deployed to Cloudflare Pages
- **API Endpoints**: `/api/*`

## Features

### ✅ Currently Completed Features
1. **Product Catalog System**
   - Categories with icons and descriptions
   - Product listing with pagination
   - Search functionality
   - Product details view
   - Stock management

2. **Shopping Cart**
   - Session-based cart for anonymous users
   - User-based cart for logged-in users
   - Add/update/remove items
   - Real-time cart total calculation

3. **School List Management**
   - Upload school requirement lists (PDF, Excel, Text)
   - Automatic product matching
   - Quick order from school lists
   - Multiple school support

4. **User Authentication**
   - Parent/Student/Admin login
   - JWT-based authentication
   - Session management
   - User registration

5. **Order Management**
   - Order creation from cart
   - Order tracking
   - Order history
   - Order cancellation

6. **Payment Integration**
   - MoMo Pay integration (sandbox mode)
   - Payment initiation
   - Payment status tracking
   - Payment webhooks

7. **Admin Dashboard**
   - Order management
   - Product management
   - Inventory tracking
   - Sales statistics

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products (with filters)
- `GET /api/products/:id` - Get single product
- `GET /api/products/categories/all` - Get all categories
- `POST /api/products/search` - Search products
- `GET /api/products/brands/all` - Get all brands

### Cart
- `GET /api/cart` - Get current cart
- `POST /api/cart/add` - Add item to cart
- `PUT /api/cart/update` - Update cart item quantity
- `DELETE /api/cart/clear` - Clear cart

### Orders
- `POST /api/orders/create` - Create order from cart
- `GET /api/orders/my-orders` - Get user's orders
- `GET /api/orders/:id` - Get order details
- `POST /api/orders/:id/cancel` - Cancel order
- `GET /api/orders/:orderNumber/track` - Track order

### School Lists
- `GET /api/school-lists` - Get all school lists
- `GET /api/school-lists/:id` - Get single school list
- `POST /api/school-lists/:id/quick-order` - Quick order from list
- `POST /api/school-lists/upload` - Upload and parse school list
- `GET /api/school-lists/schools/all` - Get all schools

### Payments
- `POST /api/payments/initiate` - Initiate MoMo payment
- `GET /api/payments/status/:paymentId` - Check payment status
- `POST /api/payments/webhook/momo` - MoMo webhook endpoint
- `GET /api/payments/methods` - Get available payment methods

### Admin
- `GET /api/admin/dashboard` - Dashboard statistics
- `GET /api/admin/orders` - List all orders
- `PUT /api/admin/orders/:id/status` - Update order status
- `POST /api/admin/products` - Add new product
- `PUT /api/admin/products/:id` - Update product
- `GET /api/admin/inventory` - Get inventory levels

## Data Architecture

### Database Schema (Cloudflare D1)
- **Categories**: Product categorization
- **Products**: Product catalog with inventory
- **Schools**: Registered schools
- **Users**: Parents, students, and admins
- **Students**: Student profiles linked to schools
- **School Lists**: School requirement lists
- **Carts**: Shopping cart sessions
- **Orders**: Order records
- **Order Items**: Individual order line items
- **Payments**: Payment transactions
- **Uploaded Lists**: User-uploaded school lists
- **Sessions**: User session management

### Storage Services
- **D1 Database**: Primary data storage (SQLite-based)
- **KV Storage**: Session and cache storage (planned)
- **R2 Storage**: File uploads and images (planned)

## User Guide

### For Parents
1. **Browse Products**: Visit the homepage to see featured products and categories
2. **Upload School List**: Click "Upload School List" to upload your child's requirements
3. **Auto-Match Items**: System automatically matches items from your list to available products
4. **Review Cart**: Check matched items in your cart
5. **Checkout**: Proceed to checkout and pay with MoMo
6. **Track Order**: Monitor your order status until delivery

### For School Administrators
1. **Login**: Use admin credentials to access the dashboard
2. **Manage Orders**: View and update order statuses
3. **Manage Products**: Add or update product inventory
4. **View Reports**: Check sales statistics and inventory levels

### For Students
1. **View Orders**: Check orders placed by parents
2. **Track Deliveries**: Monitor when supplies will arrive at school

## Features Not Yet Implemented
- Email notifications for order updates
- SMS notifications for delivery
- Airtel Money integration
- Credit/Debit card payments
- Product reviews and ratings
- Bulk order discounts
- School-specific pricing
- Parent-student account linking
- Delivery scheduling
- Returns and refunds management
- Multi-language support (English, Luganda, Swahili)
- Mobile app (React Native)

## Recommended Next Steps
1. **Deploy to Production**: Deploy to Cloudflare Pages with production D1 database
2. **Complete Payment Integration**: Integrate production MoMo API credentials
3. **Add Notification System**: Implement email/SMS notifications
4. **Enhance File Upload**: Improve school list parsing with AI/ML
5. **Mobile Optimization**: Enhance mobile responsiveness
6. **Add Analytics**: Implement user behavior tracking
7. **School Partnerships**: Onboard pilot schools
8. **Marketing Website**: Create landing pages for different user types
9. **Documentation**: Create API documentation with Swagger
10. **Testing**: Add unit and integration tests

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Wrangler CLI

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd webapp

# Install dependencies
npm install

# Apply database migrations
npx wrangler d1 migrations apply skooli-production --local

# Seed database
npx wrangler d1 execute skooli-production --local --file=./seed.sql

# Build the project
npm run build

# Start development server
pm2 start ecosystem.config.cjs
```

### Environment Variables
Create a `.dev.vars` file:
```
MOMO_API_KEY=your-momo-api-key
MOMO_API_SECRET=your-momo-api-secret
MOMO_API_URL=https://sandbox.momodeveloper.mtn.com
JWT_SECRET=your-jwt-secret
```

## Deployment

### Cloudflare Pages Deployment
```bash
# Build for production
npm run build

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist --project-name skooli

# Create production D1 database
npx wrangler d1 create skooli-production

# Apply migrations to production
npx wrangler d1 migrations apply skooli-production
```

## Project Structure
```
webapp/
├── src/
│   ├── index.tsx        # Main application entry
│   ├── routes/          # API route handlers
│   ├── types.ts         # TypeScript type definitions
│   └── utils/           # Utility functions
├── public/
│   └── static/          # Static assets
├── migrations/          # Database migrations
├── dist/                # Build output
├── wrangler.jsonc       # Cloudflare configuration
└── ecosystem.config.cjs # PM2 configuration
```

## Security Considerations
- JWT tokens for authentication
- Password hashing with bcrypt
- Input validation with Zod
- SQL injection prevention with parameterized queries
- CORS configuration for API endpoints
- Environment variables for sensitive data

## Performance Optimizations
- Edge deployment with Cloudflare Workers
- CDN for static assets
- Database indexes for fast queries
- Lazy loading for product images
- Session-based cart for anonymous users
- Pagination for large datasets

## License
Proprietary - Skooli Uganda

## Support
For support, email: admin@skooli.ug

---

**Last Updated**: August 17, 2025