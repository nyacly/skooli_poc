# Vercel Deployment Guide for Skooli

## Prerequisites

Before deploying to Vercel, ensure you have:

1. ✅ GitHub repository with the code (https://github.com/nyacly/skooli_poc)
2. ✅ Supabase project created and configured
3. ✅ Vercel account (sign up at https://vercel.com)

## Step 1: Supabase Setup

### 1.1 Create Supabase Project
1. Go to https://app.supabase.com
2. Click "New Project"
3. Enter project details:
   - Name: `skooli-production`
   - Database Password: (save this securely)
   - Region: Choose closest to your users
4. Wait for project to be created (~2 minutes)

### 1.2 Get Supabase Credentials
Once created, go to Settings > API and copy:
- **Project URL**: `https://[PROJECT_ID].supabase.co`
- **Anon/Public Key**: `eyJhbGciOiJS...` (long string)
- **Service Role Key**: `eyJhbGciOiJS...` (different long string - keep secret!)

### 1.3 Run Database Migration
1. Go to SQL Editor in Supabase dashboard
2. Click "New Query"
3. Copy and paste the entire content from `supabase/migrations/20240817000001_initial_schema.sql`
4. Click "Run" to execute the migration
5. Verify tables are created in Table Editor

## Step 2: Vercel Deployment

### 2.1 Import Project to Vercel
1. Go to https://vercel.com/dashboard
2. Click "Add New..." → "Project"
3. Import Git Repository:
   - Connect your GitHub account if not already connected
   - Select `nyacly/skooli_poc` repository
   - Click "Import"

### 2.2 Configure Build Settings
In the "Configure Project" screen:

**Framework Preset**: Other (or Vite if available)

**Build and Output Settings**:
- Build Command: `npm run build:vercel`
- Output Directory: `dist`
- Install Command: `npm install`

**Node.js Version**: 20.x

### 2.3 Set Environment Variables
Click "Environment Variables" and add the following:

```
VITE_SUPABASE_URL = [Your Supabase Project URL]
VITE_SUPABASE_ANON_KEY = [Your Supabase Anon Key]
SUPABASE_SERVICE_ROLE_KEY = [Your Supabase Service Role Key]
VITE_APP_URL = https://[your-project].vercel.app
FRONTEND_URL = https://[your-project].vercel.app
NODE_ENV = production
```

Optional (for production payment processing):
```
MOMO_API_KEY = [Your MoMo API Key]
MOMO_SECRET_KEY = [Your MoMo Secret Key]
STRIPE_SECRET_KEY = [Your Stripe Secret Key]
PAYPAL_SECRET = [Your PayPal Secret]
```

### 2.4 Deploy
1. Click "Deploy"
2. Wait for deployment to complete (~2-3 minutes)
3. Your app will be available at `https://[project-name].vercel.app`

## Step 3: Post-Deployment Configuration

### 3.1 Update CORS Settings in Supabase
1. Go to Supabase Dashboard > Authentication > URL Configuration
2. Add your Vercel URL to:
   - Site URL: `https://[your-project].vercel.app`
   - Redirect URLs: 
     - `https://[your-project].vercel.app/*`
     - `http://localhost:3000/*` (for local development)

### 3.2 Test the Deployment
1. Visit `https://[your-project].vercel.app/api/health`
   - Should return: `{"status":"ok","timestamp":"...","environment":"vercel","database":"supabase"}`

2. Test API endpoints:
   ```bash
   # Test health check
   curl https://[your-project].vercel.app/api/health
   
   # Test products endpoint
   curl https://[your-project].vercel.app/api/products/categories
   ```

### 3.3 Enable Automatic Deployments
Vercel automatically deploys when you push to the main branch:
1. Make changes locally
2. Commit and push to GitHub
3. Vercel will automatically redeploy

## Step 4: Custom Domain (Optional)

### 4.1 Add Custom Domain
1. Go to your project in Vercel Dashboard
2. Click "Settings" → "Domains"
3. Add your domain (e.g., `api.skooli.ug`)
4. Follow DNS configuration instructions

### 4.2 Update Environment Variables
After adding custom domain, update:
```
VITE_APP_URL = https://api.skooli.ug
FRONTEND_URL = https://skooli.ug
```

## Troubleshooting

### Common Issues and Solutions

**1. "Module not found" errors**
- Ensure all dependencies are in `package.json`
- Check that build command is correct
- Try clearing Vercel cache and redeploying

**2. "Supabase connection failed"**
- Verify environment variables are set correctly
- Check that Supabase project is active
- Ensure Service Role Key is used for server-side operations

**3. "CORS errors"**
- Add your Vercel URL to Supabase allowed URLs
- Check API CORS configuration in `api/index.ts`

**4. "Build failed"**
- Check build logs in Vercel dashboard
- Ensure TypeScript has no errors: `npx tsc --noEmit`
- Verify Node.js version compatibility

**5. "API routes returning 404"**
- Ensure `vercel.json` is properly configured
- Check that API files are in `api/` directory
- Verify route exports use `export default handle(app)`

## Development Workflow

### Local Development with Vercel CLI
```bash
# Install Vercel CLI globally
npm i -g vercel

# Login to Vercel
vercel login

# Link project
vercel link

# Pull environment variables
vercel env pull .env.local

# Run development server
vercel dev
```

### Deployment Commands
```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Check deployment status
vercel ls

# View logs
vercel logs
```

## Monitoring and Analytics

### Vercel Dashboard Features
- **Functions**: Monitor API function execution
- **Analytics**: Track page views and performance
- **Logs**: View real-time logs and errors
- **Speed Insights**: Monitor Core Web Vitals

### Supabase Dashboard Features
- **Database**: Monitor queries and performance
- **Authentication**: Track user signups and logins
- **Storage**: Monitor file uploads (if using)
- **Realtime**: Track WebSocket connections

## Security Best Practices

1. **Never expose Service Role Key** in client-side code
2. **Use environment variables** for all secrets
3. **Enable RLS (Row Level Security)** in Supabase
4. **Implement rate limiting** for API endpoints
5. **Validate all inputs** on the server side
6. **Use HTTPS** for all communications
7. **Regularly update dependencies** for security patches

## Support Resources

- **Vercel Documentation**: https://vercel.com/docs
- **Supabase Documentation**: https://supabase.com/docs
- **GitHub Repository**: https://github.com/nyacly/skooli_poc
- **Vercel Support**: https://vercel.com/support
- **Supabase Support**: https://supabase.com/support

## Next Steps After Deployment

1. ✅ Test all API endpoints
2. ✅ Set up monitoring and alerts
3. ✅ Configure custom domain (if needed)
4. ✅ Implement frontend UI
5. ✅ Set up payment gateway webhooks
6. ✅ Configure email/SMS services
7. ✅ Add analytics tracking
8. ✅ Set up backup strategy

---

**Last Updated**: 2024-08-17
**Version**: 1.0.0