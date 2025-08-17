import { z } from 'zod';

// Environment bindings
export type Bindings = {
  DB: D1Database;
  KV: KVNamespace;
  MOMO_API_KEY?: string;
  MOMO_API_SECRET?: string;
  MOMO_API_URL?: string;
  JWT_SECRET?: string;
};

// User types
export const UserSchema = z.object({
  id: z.number().optional(),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6).optional(),
  firstName: z.string(),
  lastName: z.string(),
  userType: z.enum(['parent', 'student', 'school_admin', 'admin']),
  schoolId: z.number().optional(),
  isActive: z.boolean().default(true),
  isVerified: z.boolean().default(false),
});

export type User = z.infer<typeof UserSchema>;

// Product types
export const ProductSchema = z.object({
  id: z.number().optional(),
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  categoryId: z.number().optional(),
  price: z.number().positive(),
  comparePrice: z.number().optional(),
  stockQuantity: z.number().default(0),
  unit: z.string().default('piece'),
  brand: z.string().optional(),
  imageUrl: z.string().optional(),
  images: z.array(z.string()).optional(),
  specifications: z.record(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export type Product = z.infer<typeof ProductSchema>;

// Cart types
export const CartItemSchema = z.object({
  productId: z.number(),
  sku: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number().positive(),
  imageUrl: z.string().optional(),
});

export const CartSchema = z.object({
  id: z.number().optional(),
  userId: z.number().optional(),
  sessionId: z.string().optional(),
  items: z.array(CartItemSchema),
  totalAmount: z.number(),
});

export type Cart = z.infer<typeof CartSchema>;
export type CartItem = z.infer<typeof CartItemSchema>;

// Order types
export const OrderSchema = z.object({
  id: z.number().optional(),
  orderNumber: z.string(),
  userId: z.number(),
  studentId: z.number().optional(),
  schoolId: z.number().optional(),
  schoolListId: z.number().optional(),
  status: z.enum(['pending', 'processing', 'packed', 'shipped', 'delivered', 'cancelled', 'refunded']),
  paymentStatus: z.enum(['pending', 'paid', 'failed', 'refunded']),
  paymentMethod: z.string().optional(),
  subtotal: z.number(),
  taxAmount: z.number().default(0),
  shippingFee: z.number().default(0),
  totalAmount: z.number(),
  shippingAddress: z.record(z.string()).optional(),
  billingAddress: z.record(z.string()).optional(),
  deliveryNotes: z.string().optional(),
  deliveryDate: z.string().optional(),
});

export type Order = z.infer<typeof OrderSchema>;

// School list types
export const SchoolListItemSchema = z.object({
  name: z.string(),
  quantity: z.number(),
  unit: z.string().optional(),
  category: z.string().optional(),
  matched_product_id: z.number().optional(),
});

export const SchoolListSchema = z.object({
  id: z.number().optional(),
  schoolId: z.number(),
  name: z.string(),
  term: z.string().optional(),
  year: z.number().optional(),
  class: z.string().optional(),
  listType: z.enum(['requirements', 'books', 'uniforms', 'general']),
  items: z.array(SchoolListItemSchema),
  isActive: z.boolean().default(true),
});

export type SchoolList = z.infer<typeof SchoolListSchema>;
export type SchoolListItem = z.infer<typeof SchoolListItemSchema>;

// Payment types
export const PaymentRequestSchema = z.object({
  orderId: z.number(),
  phoneNumber: z.string(),
  amount: z.number(),
  currency: z.string().default('UGX'),
  description: z.string().optional(),
});

export type PaymentRequest = z.infer<typeof PaymentRequestSchema>;

// File upload types
export const UploadedListSchema = z.object({
  userId: z.number(),
  schoolId: z.number().optional(),
  studentId: z.number().optional(),
  fileName: z.string(),
  fileContent: z.string(), // Base64 or text content
});

export type UploadedList = z.infer<typeof UploadedListSchema>;