import { createClient } from '@supabase/supabase-js';

// These will be replaced with your actual Supabase project details
// Support both Vercel and Vite-style environment variable names
// Allow the application to start even when Supabase environment variables
// are not provided. This is useful for local development or CI environments
// where a real Supabase instance isn't available. In those cases we fall back
// to harmless placeholder values which keep the client from throwing an error
// at initialization time. Any actual Supabase calls will still fail at runtime
// (which is fine for tests that don't exercise those paths).
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'http://localhost';
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'anon-key';
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'service-role-key';

// Client for browser/public operations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Admin client for server-side operations (only use in API routes)
export const supabaseAdmin = () => {
  if (typeof window !== 'undefined') {
    throw new Error('supabaseAdmin should only be used on the server');
  }
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

// Database types
export interface Database {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          parent_id: string | null;
          icon: string | null;
          sort_order: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['categories']['Insert']>;
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          description: string | null;
          category_id: string | null;
          price: number;
          compare_price: number | null;
          cost: number | null;
          stock_quantity: number;
          unit: string;
          brand: string | null;
          image_url: string | null;
          images: any | null;
          specifications: any | null;
          tags: any | null;
          weight: number | null;
          is_active: boolean;
          is_featured: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['products']['Insert']>;
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          phone: string | null;
          first_name: string;
          last_name: string;
          user_type: 'parent' | 'student' | 'school_admin' | 'admin';
          school_id: string | null;
          is_active: boolean;
          email_verified: boolean;
          phone_verified: boolean;
          two_factor_enabled: boolean;
          two_factor_secret: string | null;
          stripe_customer_id: string | null;
          paypal_customer_id: string | null;
          last_login: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>;
      };
      orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          student_id: string | null;
          school_id: string | null;
          school_list_id: string | null;
          status: 'pending' | 'processing' | 'packed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
          payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
          payment_method: string | null;
          payment_reference: string | null;
          subtotal: number;
          tax_amount: number;
          shipping_fee: number;
          total_amount: number;
          shipping_address: any | null;
          billing_address: any | null;
          delivery_notes: string | null;
          delivery_date: string | null;
          tracking_number: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['orders']['Insert']>;
      };
      carts: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string | null;
          items: any | null;
          total_amount: number;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['carts']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['carts']['Insert']>;
      };
    };
  };
}

// Helper to get the base URL
const getURL = () => {
  const url = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';
  return url.replace(/\/$/, ''); // Remove trailing slash
};

// Helper functions
export async function signUp(
  email: string,
  password: string,
  metadata: any,
  baseUrl?: string
) {
  const redirectBase = baseUrl || getURL();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: metadata,
      emailRedirectTo: `${redirectBase}/auth/callback`,
    },
  });

  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }
  
  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  
  return {
    ...user,
    profile,
  };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getURL()}/auth/reset-password`,
  });
  
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });
  
  return { data, error };
}