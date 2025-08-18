import Stripe from 'stripe';

interface StripeConfig {
  secretKey: string;
  publishableKey?: string;
  webhookSecret?: string;
}

export class StripeService {
  private stripe: Stripe;
  private config: StripeConfig;
  
  constructor(config: StripeConfig) {
    this.config = config;
    this.stripe = new Stripe(config.secretKey, {
      apiVersion: '2023-10-16',
    });
  }
  
  async createPaymentIntent(
    orderId: string,
    amount: number,
    currency: string = 'ugx',
    customerEmail?: string,
    metadata?: any
  ): Promise<{
    id: string;
    client_secret: string;
    amount: number;
    currency: string;
    status: string;
  }> {
    try {
      // Stripe requires amount in smallest currency unit (cents for USD, no decimal for UGX)
      const stripeAmount = currency.toLowerCase() === 'ugx' ? Math.round(amount) : Math.round(amount * 100);
      
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: stripeAmount,
        currency: currency.toLowerCase(),
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId,
          ...metadata,
        },
        receipt_email: customerEmail,
        description: `Skooli Order #${orderId}`,
      });
      
      return {
        id: paymentIntent.id,
        client_secret: paymentIntent.client_secret!,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
      };
    } catch (error: any) {
      console.error('Stripe create payment intent error:', error);
      throw new Error('Failed to create payment intent');
    }
  }
  
  async confirmPayment(paymentIntentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    payment_method: any;
  }> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        payment_method: paymentIntent.payment_method,
      };
    } catch (error: any) {
      console.error('Stripe confirm payment error:', error);
      throw new Error('Failed to confirm payment');
    }
  }
  
  async createCheckoutSession(
    orderId: string,
    items: Array<{
      name: string;
      price: number;
      quantity: number;
      image?: string;
    }>,
    successUrl: string,
    cancelUrl: string,
    customerEmail?: string
  ): Promise<{
    id: string;
    url: string;
  }> {
    try {
      const lineItems = items.map(item => ({
        price_data: {
          currency: 'ugx',
          product_data: {
            name: item.name,
            images: item.image ? [item.image] : [],
          },
          unit_amount: Math.round(item.price), // UGX doesn't use decimal places
        },
        quantity: item.quantity,
      }));
      
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer_email: customerEmail,
        metadata: {
          orderId,
        },
        payment_intent_data: {
          description: `Skooli Order #${orderId}`,
          metadata: {
            orderId,
          },
        },
      });
      
      return {
        id: session.id,
        url: session.url!,
      };
    } catch (error: any) {
      console.error('Stripe create checkout session error:', error);
      throw new Error('Failed to create checkout session');
    }
  }
  
  async createRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: string
  ): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
  }> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount) : undefined,
        reason: reason as Stripe.RefundCreateParams.Reason,
      });
      
      return {
        id: refund.id,
        status: refund.status!,
        amount: refund.amount,
        currency: refund.currency,
      };
    } catch (error: any) {
      console.error('Stripe refund error:', error);
      throw new Error('Failed to process refund');
    }
  }
  
  async retrieveSession(sessionId: string): Promise<any> {
    try {
      return await this.stripe.checkout.sessions.retrieve(sessionId);
    } catch (error: any) {
      console.error('Stripe retrieve session error:', error);
      throw new Error('Failed to retrieve session');
    }
  }
  
  async constructWebhookEvent(
    payload: string,
    signature: string
  ): Promise<Stripe.Event> {
    try {
      if (!this.config.webhookSecret) {
        throw new Error('Webhook secret not configured');
      }
      
      return this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );
    } catch (error: any) {
      console.error('Stripe webhook verification error:', error);
      throw new Error('Invalid webhook signature');
    }
  }
  
  // Create a customer for saving payment methods
  async createCustomer(
    email: string,
    name: string,
    phone?: string,
    metadata?: any
  ): Promise<{
    id: string;
    email: string;
    name: string;
  }> {
    try {
      const customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        metadata,
      });
      
      return {
        id: customer.id,
        email: customer.email!,
        name: customer.name!,
      };
    } catch (error: any) {
      console.error('Stripe create customer error:', error);
      throw new Error('Failed to create customer');
    }
  }
  
  // List customer's payment methods
  async listPaymentMethods(customerId: string): Promise<any[]> {
    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: customerId,
        type: 'card',
      });
      
      return paymentMethods.data;
    } catch (error: any) {
      console.error('Stripe list payment methods error:', error);
      return [];
    }
  }
}