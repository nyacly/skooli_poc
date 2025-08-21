import * as payPalCore from '@paypal/checkout-server-sdk/core';
import * as payPalOrders from '@paypal/checkout-server-sdk/orders';
import * as payPalPayments from '@paypal/checkout-server-sdk/payments';

interface PayPalConfig {
  clientId: string;
  clientSecret: string;
  environment: 'sandbox' | 'production';
}

export class PayPalService {
  private client: any;
  
  constructor(config: PayPalConfig) {
    const environment = config.environment === 'production'
      ? new payPalCore.LiveEnvironment(config.clientId, config.clientSecret)
      : new payPalCore.SandboxEnvironment(config.clientId, config.clientSecret);
    
    this.client = new payPalCore.PayPalHttpClient(environment);
  }
  
  async createOrder(
    orderId: string,
    amount: number,
    currency: string = 'USD',
    items: any[] = []
  ): Promise<{ id: string; status: string; links: any[] }> {
    const request = new payPalOrders.OrdersCreateRequest();
    request.prefer('return=representation');
    
    // Convert UGX to USD (approximate rate, should use real-time rates in production)
    const usdAmount = currency === 'UGX' ? (amount / 3700).toFixed(2) : amount.toFixed(2);
    
    request.requestBody({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: orderId,
        amount: {
          currency_code: 'USD',
          value: usdAmount,
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: usdAmount,
            },
          },
        },
        items: items.map(item => ({
          name: item.name,
          unit_amount: {
            currency_code: 'USD',
            value: (item.price / 3700).toFixed(2),
          },
          quantity: item.quantity.toString(),
        })),
        description: `Skooli Order #${orderId}`,
      }],
      application_context: {
        brand_name: 'Skooli',
        landing_page: 'BILLING',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
        return_url: `https://skooli.ug/payment/success?order=${orderId}`,
        cancel_url: `https://skooli.ug/payment/cancel?order=${orderId}`,
      },
    });
    
    try {
      const response = await this.client.execute(request);
      return {
        id: response.result.id,
        status: response.result.status,
        links: response.result.links,
      };
    } catch (error: any) {
      console.error('PayPal create order error:', error);
      throw new Error('Failed to create PayPal order');
    }
  }
  
  async captureOrder(paypalOrderId: string): Promise<{
    id: string;
    status: string;
    payer: any;
    purchase_units: any[];
  }> {
    const request = new payPalOrders.OrdersCaptureRequest(paypalOrderId);
    request.requestBody({});
    
    try {
      const response = await this.client.execute(request);
      return {
        id: response.result.id,
        status: response.result.status,
        payer: response.result.payer,
        purchase_units: response.result.purchase_units,
      };
    } catch (error: any) {
      console.error('PayPal capture order error:', error);
      throw new Error('Failed to capture PayPal payment');
    }
  }
  
  async getOrderDetails(paypalOrderId: string): Promise<any> {
    const request = new payPalOrders.OrdersGetRequest(paypalOrderId);
    
    try {
      const response = await this.client.execute(request);
      return response.result;
    } catch (error: any) {
      console.error('PayPal get order error:', error);
      throw new Error('Failed to get PayPal order details');
    }
  }
  
  async refundPayment(captureId: string, amount?: number): Promise<{
    id: string;
    status: string;
    amount: any;
  }> {
    const request = new payPalPayments.CapturesRefundRequest(captureId);
    
    if (amount) {
      request.requestBody({
        amount: {
          currency_code: 'USD',
          value: amount.toFixed(2),
        },
      });
    } else {
      request.requestBody({});
    }
    
    try {
      const response = await this.client.execute(request);
      return {
        id: response.result.id,
        status: response.result.status,
        amount: response.result.amount,
      };
    } catch (error: any) {
      console.error('PayPal refund error:', error);
      throw new Error('Failed to process PayPal refund');
    }
  }
  
  // Verify webhook signature (for production)
  async verifyWebhookSignature(
    webhookId: string,
    headers: any,
    body: any
  ): Promise<boolean> {
    // Implementation depends on PayPal webhook verification
    // For now, return true in development
    return true;
  }
}