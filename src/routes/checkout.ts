import { Hono } from 'hono';
import { Bindings } from '../types';
import { supabase } from '../../lib/supabase';
import { getUserFromToken, generateOrderNumber } from '../utils/auth';
import { MoMoPaymentService } from '../utils/momo';
import { PayPalService } from '../utils/paypal';
import { StripeService } from '../utils/stripe';
import { EmailService } from '../utils/email';

const checkoutRoutes = new Hono<{ Bindings: Bindings }>();

// Get checkout page
checkoutRoutes.get('/page', async (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Checkout - Skooli</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
        <script src="https://js.stripe.com/v3/"></script>
        <script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&currency=USD"></script>
    </head>
    <body class="bg-gray-50">
        <div class="max-w-7xl mx-auto px-4 py-8">
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Order Summary -->
                <div class="lg:col-span-2">
                    <div class="bg-white rounded-lg shadow p-6">
                        <h2 class="text-2xl font-bold mb-6">Checkout</h2>
                        
                        <!-- Shipping Information -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-4">Delivery Information</h3>
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="text" id="firstName" placeholder="First Name" class="w-full px-4 py-2 border rounded-lg" required>
                                <input type="text" id="lastName" placeholder="Last Name" class="w-full px-4 py-2 border rounded-lg" required>
                                <input type="email" id="email" placeholder="Email Address" class="w-full px-4 py-2 border rounded-lg" required>
                                <input type="tel" id="phone" placeholder="Phone Number" class="w-full px-4 py-2 border rounded-lg" required>
                                <select id="school" class="w-full px-4 py-2 border rounded-lg" required>
                                    <option value="">Select School</option>
                                    <option value="1">Kings College Budo</option>
                                    <option value="2">Gayaza High School</option>
                                    <option value="3">Namugongo SS</option>
                                </select>
                                <input type="text" id="studentName" placeholder="Student Name" class="w-full px-4 py-2 border rounded-lg" required>
                                <input type="text" id="studentNumber" placeholder="Student Number" class="w-full px-4 py-2 border rounded-lg col-span-2">
                                <textarea id="deliveryNotes" placeholder="Delivery Notes (Optional)" class="w-full px-4 py-2 border rounded-lg col-span-2" rows="3"></textarea>
                            </div>
                        </div>
                        
                        <!-- Payment Methods -->
                        <div class="mb-6">
                            <h3 class="text-lg font-semibold mb-4">Payment Method</h3>
                            <div class="space-y-3">
                                <!-- MoMo Pay -->
                                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="momo" class="mr-3" checked>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/f/f1/MTN_Mobile_Money_Logo.png" alt="MoMo" class="h-8 mr-3">
                                    <div>
                                        <div class="font-semibold">MTN Mobile Money</div>
                                        <div class="text-sm text-gray-600">Pay with your MoMo account</div>
                                    </div>
                                </label>
                                
                                <!-- Credit Card (Stripe) -->
                                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="card" class="mr-3">
                                    <i class="fas fa-credit-card text-2xl mr-3 text-blue-600"></i>
                                    <div>
                                        <div class="font-semibold">Credit/Debit Card</div>
                                        <div class="text-sm text-gray-600">Visa, Mastercard, American Express</div>
                                    </div>
                                </label>
                                
                                <!-- PayPal -->
                                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                                    <input type="radio" name="paymentMethod" value="paypal" class="mr-3">
                                    <img src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_37x23.jpg" alt="PayPal" class="h-8 mr-3">
                                    <div>
                                        <div class="font-semibold">PayPal</div>
                                        <div class="text-sm text-gray-600">Pay with PayPal account or card</div>
                                    </div>
                                </label>
                                
                                <!-- Airtel Money (Coming Soon) -->
                                <label class="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 opacity-50">
                                    <input type="radio" name="paymentMethod" value="airtel" class="mr-3" disabled>
                                    <img src="https://upload.wikimedia.org/wikipedia/commons/5/5c/Airtel_logo_2019.png" alt="Airtel" class="h-8 mr-3">
                                    <div>
                                        <div class="font-semibold">Airtel Money</div>
                                        <div class="text-sm text-gray-600">Coming Soon</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                        
                        <!-- Payment Details -->
                        <div id="paymentDetails">
                            <!-- MoMo Details -->
                            <div id="momoDetails" class="payment-details">
                                <h4 class="font-semibold mb-3">Enter MoMo Number</h4>
                                <input type="tel" id="momoNumber" placeholder="07XXXXXXXX" class="w-full px-4 py-2 border rounded-lg">
                            </div>
                            
                            <!-- Card Details -->
                            <div id="cardDetails" class="payment-details hidden">
                                <h4 class="font-semibold mb-3">Card Information</h4>
                                <div id="card-element" class="p-3 border rounded-lg"></div>
                                <div id="card-errors" class="text-red-500 text-sm mt-2"></div>
                            </div>
                            
                            <!-- PayPal Button Container -->
                            <div id="paypalDetails" class="payment-details hidden">
                                <div id="paypal-button-container"></div>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Order Summary Sidebar -->
                <div class="lg:col-span-1">
                    <div class="bg-white rounded-lg shadow p-6 sticky top-4">
                        <h3 class="text-lg font-semibold mb-4">Order Summary</h3>
                        <div id="orderItems" class="space-y-3 mb-4">
                            <!-- Items will be loaded here -->
                        </div>
                        <div class="border-t pt-4 space-y-2">
                            <div class="flex justify-between">
                                <span>Subtotal</span>
                                <span id="subtotal">UGX 0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>VAT (18%)</span>
                                <span id="tax">UGX 0</span>
                            </div>
                            <div class="flex justify-between">
                                <span>Delivery Fee</span>
                                <span id="shipping">UGX 15,000</span>
                            </div>
                            <div class="border-t pt-2 mt-2">
                                <div class="flex justify-between text-xl font-bold">
                                    <span>Total</span>
                                    <span id="total">UGX 0</span>
                                </div>
                            </div>
                        </div>
                        
                        <button id="placeOrderBtn" onclick="placeOrder()" class="w-full bg-green-600 text-white py-3 rounded-lg mt-6 hover:bg-green-700 font-semibold">
                            Place Order
                        </button>
                        
                        <div class="mt-4 text-center">
                            <p class="text-sm text-gray-600">
                                <i class="fas fa-lock mr-1"></i>
                                Secure Payment
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <script src="/static/checkout.js"></script>
    </body>
    </html>
  `);
});

// Process checkout
checkoutRoutes.post('/process', async (c) => {
  try {
    const user = await getUserFromToken(c);
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }
    
    const body = await c.req.json();
    const {
      paymentMethod,
      shippingAddress,
      billingAddress,
      studentId,
      schoolId,
      deliveryNotes,
      paymentDetails,
    } = body;
    
    // Get user's cart
    const { data: cart, error: cartError } = await supabase
      .from('carts')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();
    
    if (cartError || !cart || !cart.items) {
      return c.json({ error: 'Cart is empty' }, 400);
    }
    
    const items = cart.items as any[];
    
    // Calculate totals
    const subtotal = cart.total_amount;
    const taxAmount = subtotal * 0.18;
    const shippingFee = 15000;
    const totalAmount = subtotal + taxAmount + shippingFee;
    
    // Create order
    const orderNumber = generateOrderNumber();
    const { data: newOrder, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        user_id: user.id,
        student_id: studentId || null,
        school_id: schoolId || null,
        status: 'pending',
        payment_status: 'pending',
        payment_method: paymentMethod,
        subtotal,
        tax_amount: taxAmount,
        shipping_fee: shippingFee,
        total_amount: totalAmount,
        shipping_address: shippingAddress,
        billing_address: billingAddress || shippingAddress,
        delivery_notes: deliveryNotes || null,
      })
      .select()
      .single();

    if (orderError) throw orderError;
    const orderId = newOrder.id;
    
    // Create order items
    const orderItems = items.map(item => ({
      order_id: orderId,
      product_id: item.productId,
      quantity: item.quantity,
      unit_price: item.price,
      total_price: item.price * item.quantity,
    }));
    await supabase.from('order_items').insert(orderItems);
    
    // Process payment based on method
    let paymentResult: any;
    
    switch (paymentMethod) {
      case 'momo':
        const momoService = new MoMoPaymentService({
          apiKey: c.env.MOMO_API_KEY || 'test-api-key',
          apiSecret: c.env.MOMO_API_SECRET || 'test-api-secret',
          apiUrl: c.env.MOMO_API_URL || 'https://sandbox.momodeveloper.mtn.com',
          environment: c.env.MOMO_API_KEY ? 'production' : 'sandbox',
        });
        paymentResult = await momoService.requestPayment(orderNumber, paymentDetails.phoneNumber, totalAmount, 'UGX', `Payment for order ${orderNumber}`);
        break;
      case 'card':
        const stripeService = new StripeService({
          secretKey: c.env.STRIPE_SECRET_KEY || 'sk_test_...',
          webhookSecret: c.env.STRIPE_WEBHOOK_SECRET,
        });
        paymentResult = await stripeService.createPaymentIntent(orderNumber, totalAmount, 'ugx', user.email, { orderId });
        break;
      case 'paypal':
        const paypalService = new PayPalService({
          clientId: c.env.PAYPAL_CLIENT_ID || 'test-client-id',
          clientSecret: c.env.PAYPAL_CLIENT_SECRET || 'test-client-secret',
          environment: c.env.PAYPAL_CLIENT_ID ? 'production' : 'sandbox',
        });
        paymentResult = await paypalService.createOrder(orderNumber, totalAmount, 'UGX', items);
        break;
      default:
        return c.json({ error: 'Invalid payment method' }, 400);
    }
    
    // Save payment record
    await supabase.from('payments').insert({
      order_id: orderId,
      transaction_id: (paymentResult as any)?.id || (paymentResult as any)?.financialTransactionId || `PENDING-${Date.now()}`,
      payment_method: paymentMethod,
      amount: totalAmount,
      currency: 'UGX',
      status: 'pending',
      provider_response: paymentResult,
    });
    
    // Clear cart
    await supabase.from('carts').delete().eq('id', cart.id);
    
    // Send order confirmation email
    const emailService = new EmailService({
      apiKey: c.env.RESEND_API_KEY || 'test-api-key',
      fromEmail: 'orders@skooli.ug',
      fromName: 'Skooli Orders',
    });
    
    await emailService.sendOrderConfirmationEmail(user.email, user.first_name, orderNumber, totalAmount, items);
    
    return c.json({
      success: true,
      orderId,
      orderNumber,
      paymentResult,
      message: 'Order created successfully',
    });
  } catch (error: any) {
    console.error('Checkout error:', error);
    return c.json({ error: 'Failed to process checkout', details: error.message }, 500);
  }
});

// Payment callback endpoints
checkoutRoutes.post('/payment/callback/momo', async (c) => {
  // Handle MoMo callback
  const body = await c.req.json();
  // Process MoMo webhook
  return c.json({ success: true });
});

checkoutRoutes.post('/payment/callback/stripe', async (c) => {
  // Handle Stripe webhook
  const body = await c.req.text();
  const signature = c.req.header('stripe-signature');
  // Process Stripe webhook
  return c.json({ success: true });
});

checkoutRoutes.post('/payment/callback/paypal', async (c) => {
  // Handle PayPal webhook
  const body = await c.req.json();
  // Process PayPal webhook
  return c.json({ success: true });
});

export default checkoutRoutes;