# Skooli - E-commerce Platform for School Supplies

## Project Overview
- **Name**: Skooli
- **Goal**: A comprehensive e-commerce platform for school supplies with catalog presentation, school list upload functionality, and multiple payment gateway integrations
- **Features**: 
  - Product catalog with categories and search
  - Shopping cart and order management
  - User authentication with email/SMS verification
  - Multiple payment gateways (MoMo Pay, Stripe, PayPal)
  - Order tracking and history
  - Admin dashboard for product management

## Technology Stack
- **Backend**: Hono Framework (lightweight, fast)
- **Database**: Supabase (PostgreSQL with Auth)
- **Deployment**: Vercel (serverless functions)
- **Frontend**: Vanilla JavaScript with Tailwind CSS
- **Payment Integration**: MoMo Pay, Stripe, PayPal
- **Authentication**: Supabase Auth with JWT tokens

## URLs
- **Production**: (To be deployed on Vercel)
- **API Endpoints**: `/api/*`
- **GitHub**: (To be configured)

## Data Architecture

### Database Schema (Supabase/PostgreSQL)
- **users**: User profiles with roles (parent, student, teacher, admin)
- **categories**: Product categories with slugs
- **products**: School supplies catalog with inventory tracking
- **cart_items**: User shopping cart items
- **orders**: Order records with status tracking
- **order_items**: Individual items within orders
- **payments**: Payment transactions with multiple gateway support
- **school_lists**: Uploaded school supply lists (future feature)

### Storage Services
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage (for product images)
- **Sessions**: JWT tokens managed by Supabase

## API Endpoints

### Authentication (`/api/auth`)
- `POST /signup` - Create new account
- `POST /signin` - Sign in user
- `POST /signout` - Sign out user
- `GET /me` - Get current user profile
- `POST /forgot-password` - Request password reset
- `POST /update-password` - Update user password

### Products (`/api/products`)
- `GET /` - List products with pagination and filters
- `GET /categories` - Get all categories
- `GET /featured` - Get featured products
- `GET /search` - Search products
- `GET /:id` - Get product details
- `POST /` - Create product (admin only)
- `PUT /:id` - Update product (admin only)
- `DELETE /:id` - Delete product (admin only)

### Shopping Cart (`/api/cart`)
- `GET /` - Get user's cart
- `POST /add` - Add item to cart
- `PUT /:itemId` - Update item quantity
- `DELETE /:itemId` - Remove item from cart
- `DELETE /` - Clear entire cart
- `POST /coupon` - Apply coupon code

### Orders (`/api/orders`)
- `POST /create` - Create order from cart
- `GET /` - Get user's orders
- `GET /:orderId` - Get order details
- `POST /:orderId/cancel` - Cancel order
- `GET /:orderId/track` - Track order status

### Payments (`/api/payments`)
- `POST /initialize` - Initialize payment
- `POST /confirm` - Confirm payment
- `GET /:paymentId/status` - Get payment status
- `POST /:paymentId/cancel` - Cancel payment
- `POST /webhook/:provider` - Payment provider webhooks

## Environment Variables

Required environment variables for deployment:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application URLs
VITE_APP_URL=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app

# Payment Gateways (Optional for development)
MOMO_API_KEY=your_momo_api_key
STRIPE_SECRET_KEY=your_stripe_secret_key
PAYPAL_SECRET=your_paypal_secret
```

## Setup Instructions

### 1. Supabase Setup
1. Create a Supabase project at https://app.supabase.com
2. Copy your project URL and anon key
3. Run the migration script in `supabase/migrations/20240817000001_initial_schema.sql`
4. Configure Row Level Security (RLS) policies as needed

### 2. Local Development
```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run development server
npm run dev:vercel

# Or run with Vercel CLI
vercel dev
```

### 3. Deployment to Vercel

#### Prerequisites
- GitHub repository connected to Vercel
- Supabase project created and configured
- Environment variables set in Vercel dashboard

#### Deployment Steps
1. Push code to GitHub
2. Import project to Vercel
3. Configure environment variables in Vercel dashboard
4. Deploy

#### Vercel Configuration
The project includes `vercel.json` for proper configuration:
- API routes at `/api/*`
- Function timeout set to 30 seconds
- Build command: `npm run build:vercel`

## Currently Completed Features
✅ Database schema migrated to Supabase (PostgreSQL)
✅ Supabase client configuration with TypeScript types
✅ Authentication routes with Supabase Auth
✅ Product catalog and search functionality
✅ Shopping cart management
✅ Order creation and tracking
✅ Payment gateway integration structure
✅ API routes adapted for Vercel deployment
✅ Environment configuration for multiple environments

## Features Not Yet Implemented
- [ ] Frontend UI components
- [ ] Real payment gateway integration (currently mocked)
- [ ] Email/SMS notification services
- [ ] School list upload and parsing
- [ ] Admin dashboard UI
- [ ] Product image upload to Supabase Storage
- [ ] Real-time order status updates
- [ ] Analytics and reporting

## Recommended Next Steps
1. **Connect to GitHub**: Push code to GitHub repository
2. **Deploy to Vercel**: Import project and configure environment variables
3. **Test API Endpoints**: Verify all endpoints work with Supabase
4. **Implement Frontend**: Build the UI components
5. **Payment Integration**: Complete real payment gateway setup
6. **Add Notifications**: Implement email/SMS services
7. **School Lists Feature**: Build upload and parsing functionality
8. **Admin Dashboard**: Create management interface

## Project Structure
```
webapp/
├── api/
│   ├── index.ts          # Main API handler for Vercel
│   └── routes/           # API route handlers
│       ├── auth.ts       # Authentication endpoints
│       ├── products.ts   # Product management
│       ├── cart.ts       # Shopping cart
│       ├── orders.ts     # Order management
│       └── payments.ts   # Payment processing
├── lib/
│   └── supabase.ts       # Supabase client configuration
├── supabase/
│   └── migrations/       # Database migrations
├── public/               # Static assets
├── .env.example          # Environment variables template
├── vercel.json           # Vercel configuration
├── package.json          # Dependencies and scripts
└── README.md             # Project documentation
```

## Security Considerations
- All sensitive operations require authentication
- Admin routes protected with role-based access control
- Payment webhooks should verify signatures in production
- Use environment variables for all secrets
- Enable Row Level Security (RLS) in Supabase
- Implement rate limiting for API endpoints

## Support and Documentation
- **Supabase Docs**: https://supabase.com/docs
- **Vercel Docs**: https://vercel.com/docs
- **Hono Framework**: https://hono.dev
- **Payment Gateway Docs**:
  - MoMo: https://developers.momo.vn
  - Stripe: https://stripe.com/docs
  - PayPal: https://developer.paypal.com

## License
Proprietary - All rights reserved

## Last Updated
2024-08-17