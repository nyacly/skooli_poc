import { Resend } from 'resend';

interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export class EmailService {
  private resend: Resend | null = null;
  private config: EmailConfig;
  
  constructor(config: EmailConfig) {
    this.config = config;
    if (config.apiKey && config.apiKey !== 'test-api-key') {
      this.resend = new Resend(config.apiKey);
    }
  }
  
  async sendVerificationEmail(to: string, name: string, verificationCode: string): Promise<boolean> {
    const template = this.getVerificationTemplate(name, verificationCode);
    return await this.sendEmail({
      to,
      subject: 'Verify Your Skooli Account',
      html: template.html,
      text: template.text,
    });
  }
  
  async sendPasswordResetEmail(to: string, name: string, resetToken: string): Promise<boolean> {
    const template = this.getPasswordResetTemplate(name, resetToken);
    return await this.sendEmail({
      to,
      subject: 'Reset Your Skooli Password',
      html: template.html,
      text: template.text,
    });
  }
  
  async sendOrderConfirmationEmail(
    to: string,
    name: string,
    orderNumber: string,
    totalAmount: number,
    items: any[]
  ): Promise<boolean> {
    const template = this.getOrderConfirmationTemplate(name, orderNumber, totalAmount, items);
    return await this.sendEmail({
      to,
      subject: `Order Confirmation - ${orderNumber}`,
      html: template.html,
      text: template.text,
    });
  }
  
  async sendPaymentConfirmationEmail(
    to: string,
    name: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string
  ): Promise<boolean> {
    const template = this.getPaymentConfirmationTemplate(name, orderNumber, amount, paymentMethod);
    return await this.sendEmail({
      to,
      subject: `Payment Received - ${orderNumber}`,
      html: template.html,
      text: template.text,
    });
  }
  
  private async sendEmail(template: EmailTemplate): Promise<boolean> {
    try {
      if (this.resend) {
        const { data, error } = await this.resend.emails.send({
          from: `${this.config.fromName} <${this.config.fromEmail}>`,
          to: template.to,
          subject: template.subject,
          html: template.html,
          text: template.text,
        });
        
        if (error) {
          console.error('Email send error:', error);
          return false;
        }
        
        return true;
      } else {
        // Development mode - log to console
        console.log('📧 Email would be sent:');
        console.log('To:', template.to);
        console.log('Subject:', template.subject);
        console.log('Content:', template.text || 'HTML content');
        return true;
      }
    } catch (error) {
      console.error('Email service error:', error);
      return false;
    }
  }
  
  private getVerificationTemplate(name: string, code: string): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .code { background: white; border: 2px solid #16a34a; border-radius: 8px; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #16a34a; margin: 20px 0; }
          .button { display: inline-block; background: #16a34a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
          .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Skooli!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>Thank you for creating an account with Skooli. To complete your registration, please verify your email address using the code below:</p>
            <div class="code">${code}</div>
            <p>This code will expire in 30 minutes.</p>
            <p>If you didn't create an account with Skooli, please ignore this email.</p>
            <p>Best regards,<br>The Skooli Team</p>
          </div>
          <div class="footer">
            <p>© 2025 Skooli. All rights reserved.</p>
            <p>Kampala, Uganda</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      Welcome to Skooli!
      
      Hi ${name},
      
      Thank you for creating an account with Skooli. To complete your registration, please verify your email address using the code below:
      
      Verification Code: ${code}
      
      This code will expire in 30 minutes.
      
      If you didn't create an account with Skooli, please ignore this email.
      
      Best regards,
      The Skooli Team
    `;
    
    return { html, text };
  }
  
  private getPasswordResetTemplate(name: string, token: string): { html: string; text: string } {
    const resetUrl = `https://skooli.ug/reset-password?token=${token}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #f97316, #16a34a); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .button { display: inline-block; background: #f97316; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <p>We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${resetUrl}" class="button">Reset Password</a>
            <p>Or copy and paste this link into your browser:</p>
            <p>${resetUrl}</p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request a password reset, please ignore this email.</p>
            <p>Best regards,<br>The Skooli Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      Password Reset Request
      
      Hi ${name},
      
      We received a request to reset your password. Visit the link below to create a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you didn't request a password reset, please ignore this email.
      
      Best regards,
      The Skooli Team
    `;
    
    return { html, text };
  }
  
  private getOrderConfirmationTemplate(
    name: string,
    orderNumber: string,
    totalAmount: number,
    items: any[]
  ): { html: string; text: string } {
    const itemsHtml = items.map(item => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb;">${item.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center;">${item.quantity}</td>
        <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right;">UGX ${new Intl.NumberFormat('en-UG').format(item.price)}</td>
      </tr>
    `).join('');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #2563eb); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          .total { font-size: 20px; font-weight: bold; color: #16a34a; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Order Confirmation</h1>
            <p>Order #${orderNumber}</p>
          </div>
          <div class="content">
            <h2>Thank you for your order, ${name}!</h2>
            <p>We've received your order and will begin processing it shortly.</p>
            
            <h3>Order Details:</h3>
            <table>
              <thead>
                <tr>
                  <th style="padding: 10px; border-bottom: 2px solid #16a34a; text-align: left;">Item</th>
                  <th style="padding: 10px; border-bottom: 2px solid #16a34a; text-align: center;">Quantity</th>
                  <th style="padding: 10px; border-bottom: 2px solid #16a34a; text-align: right;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${itemsHtml}
              </tbody>
            </table>
            
            <p class="total">Total: UGX ${new Intl.NumberFormat('en-UG').format(totalAmount)}</p>
            
            <p>We'll send you another email when your order is shipped.</p>
            
            <p>Best regards,<br>The Skooli Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = items.map(item => `- ${item.name} x${item.quantity} - UGX ${item.price}`).join('\n');
    
    return { html, text: `Order Confirmation\n\nOrder #${orderNumber}\n\nItems:\n${text}\n\nTotal: UGX ${totalAmount}` };
  }
  
  private getPaymentConfirmationTemplate(
    name: string,
    orderNumber: string,
    amount: number,
    paymentMethod: string
  ): { html: string; text: string } {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #16a34a, #f97316); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { background: #d4edda; border: 1px solid #16a34a; border-radius: 5px; padding: 15px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Successful!</h1>
          </div>
          <div class="content">
            <h2>Hi ${name},</h2>
            <div class="success">
              <p><strong>✅ Payment Received!</strong></p>
              <p>Amount: UGX ${new Intl.NumberFormat('en-UG').format(amount)}</p>
              <p>Payment Method: ${paymentMethod}</p>
              <p>Order Number: ${orderNumber}</p>
            </div>
            <p>Your order is now being processed and will be delivered to the school soon.</p>
            <p>You can track your order status in your account dashboard.</p>
            <p>Best regards,<br>The Skooli Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const text = `
      Payment Successful!
      
      Hi ${name},
      
      We've received your payment:
      - Amount: UGX ${amount}
      - Payment Method: ${paymentMethod}
      - Order Number: ${orderNumber}
      
      Your order is now being processed.
      
      Best regards,
      The Skooli Team
    `;
    
    return { html, text };
  }
}

// SMS Service (using Africa's Talking or similar)
export class SMSService {
  private apiKey: string;
  private username: string;
  private sender: string;
  
  constructor(config: { apiKey: string; username: string; sender: string }) {
    this.apiKey = config.apiKey;
    this.username = config.username;
    this.sender = config.sender;
  }
  
  async sendVerificationSMS(phoneNumber: string, code: string): Promise<boolean> {
    const message = `Your Skooli verification code is: ${code}. Valid for 30 minutes.`;
    return await this.sendSMS(phoneNumber, message);
  }
  
  async sendOrderUpdateSMS(phoneNumber: string, orderNumber: string, status: string): Promise<boolean> {
    const message = `Skooli Order Update: Your order ${orderNumber} is now ${status}.`;
    return await this.sendSMS(phoneNumber, message);
  }
  
  private async sendSMS(to: string, message: string): Promise<boolean> {
    try {
      // In production, integrate with Africa's Talking or similar SMS gateway
      // For now, log to console in development
      console.log('📱 SMS would be sent:');
      console.log('To:', to);
      console.log('Message:', message);
      return true;
    } catch (error) {
      console.error('SMS service error:', error);
      return false;
    }
  }
}