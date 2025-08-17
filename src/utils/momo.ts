import { v4 as uuidv4 } from 'uuid';

interface MoMoConfig {
  apiKey: string;
  apiSecret: string;
  apiUrl: string;
  environment: 'sandbox' | 'production';
}

interface MoMoPaymentRequest {
  amount: string;
  currency: string;
  externalId: string;
  payer: {
    partyIdType: 'MSISDN';
    partyId: string;
  };
  payerMessage: string;
  payeeNote: string;
}

interface MoMoPaymentResponse {
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  financialTransactionId?: string;
  externalId: string;
  amount: string;
  currency: string;
  payer?: {
    partyIdType: string;
    partyId: string;
  };
  payerMessage?: string;
  payeeNote?: string;
  reason?: string;
}

export class MoMoPaymentService {
  private config: MoMoConfig;
  
  constructor(config: MoMoConfig) {
    this.config = config;
  }
  
  private async getAccessToken(): Promise<string> {
    // In production, implement OAuth2 flow to get access token
    // For now, return a mock token
    return 'mock-access-token';
  }
  
  private formatPhoneNumber(phone: string): string {
    // Remove any non-numeric characters
    let cleaned = phone.replace(/\D/g, '');
    
    // Add country code if not present
    if (!cleaned.startsWith('256')) {
      if (cleaned.startsWith('0')) {
        cleaned = '256' + cleaned.substring(1);
      } else {
        cleaned = '256' + cleaned;
      }
    }
    
    return cleaned;
  }
  
  async requestPayment(
    orderId: string,
    phoneNumber: string,
    amount: number,
    currency: string = 'UGX',
    description: string = 'Skooli Order Payment'
  ): Promise<MoMoPaymentResponse> {
    const referenceId = uuidv4();
    const formattedPhone = this.formatPhoneNumber(phoneNumber);
    
    const paymentRequest: MoMoPaymentRequest = {
      amount: amount.toString(),
      currency,
      externalId: orderId,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone,
      },
      payerMessage: description,
      payeeNote: `Payment for order ${orderId}`,
    };
    
    // In production environment, make actual API call
    if (this.config.environment === 'production') {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(`${this.config.apiUrl}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'X-Reference-Id': referenceId,
          'X-Target-Environment': this.config.environment,
          'Content-Type': 'application/json',
          'Ocp-Apim-Subscription-Key': this.config.apiKey,
        },
        body: JSON.stringify(paymentRequest),
      });
      
      if (!response.ok) {
        throw new Error(`MoMo API error: ${response.status}`);
      }
      
      // Poll for payment status
      return await this.checkPaymentStatus(referenceId);
    }
    
    // Mock response for development
    return {
      status: 'SUCCESSFUL',
      financialTransactionId: `MOCK-${referenceId}`,
      externalId: orderId,
      amount: amount.toString(),
      currency,
      payer: {
        partyIdType: 'MSISDN',
        partyId: formattedPhone,
      },
      payerMessage: description,
      payeeNote: `Payment for order ${orderId}`,
    };
  }
  
  async checkPaymentStatus(referenceId: string): Promise<MoMoPaymentResponse> {
    // In production, make actual API call to check status
    if (this.config.environment === 'production') {
      const accessToken = await this.getAccessToken();
      
      const response = await fetch(
        `${this.config.apiUrl}/collection/v1_0/requesttopay/${referenceId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Target-Environment': this.config.environment,
            'Ocp-Apim-Subscription-Key': this.config.apiKey,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`MoMo API error: ${response.status}`);
      }
      
      return await response.json();
    }
    
    // Mock response for development
    return {
      status: 'SUCCESSFUL',
      financialTransactionId: `MOCK-${referenceId}`,
      externalId: 'mock-order-id',
      amount: '100000',
      currency: 'UGX',
    };
  }
  
  async refundPayment(
    transactionId: string,
    amount: number,
    currency: string = 'UGX'
  ): Promise<boolean> {
    // Implement refund logic
    // In production, make actual API call
    
    // Mock response for development
    return true;
  }
}