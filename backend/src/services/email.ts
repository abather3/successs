import nodemailer from 'nodemailer';
import { config } from '../config/config';

export class EmailService {
  static async sendPasswordResetEmail(
    email: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    try {
      // In a real implementation, you would use a service like SendGrid, AWS SES, or Nodemailer
      // For now, we'll simulate the email sending
      
      // Use first URL from comma-separated FRONTEND_URL for email links
      const firstFrontendUrl = config.FRONTEND_URL.split(',')[0].trim();
      const resetLink = `${firstFrontendUrl}/reset-password/${resetToken}`;
      
      console.log(`
==================================================
PASSWORD RESET EMAIL (Development Mode)
==================================================
To: ${email}
Subject: Password Reset Request - EscaShop Optical

Dear ${userName},

You have requested to reset your password for your EscaShop Optical account.

Please click the link below to reset your password:
${resetLink}

This link will expire in 1 hour for security reasons.

If you did not request this password reset, please ignore this email or contact your administrator.

Best regards,
EscaShop Optical Team
==================================================
      `);

      // If email configuration is available, send actual email
      console.log('EMAIL_SERVICE_ENABLED:', config.EMAIL_SERVICE_ENABLED);
      console.log('EMAIL_USER:', config.EMAIL_USER);
      console.log('EMAIL_PASSWORD:', config.EMAIL_PASSWORD ? '***CONFIGURED***' : 'NOT SET');
      
      if (config.EMAIL_SERVICE_ENABLED) {
        console.log('Attempting to send actual email...');
        return await this.sendActualEmail(email, resetToken, userName);
      } else {
        console.log('Email service is disabled, using console output only');
      }

      // For development, always return true
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', error);
      return false;
    }
  }

  private static async sendActualEmail(
    email: string,
    resetToken: string,
    userName: string
  ): Promise<boolean> {
    try {
      // Create transporter with Gmail configuration
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASSWORD
        }
      });

      // Use first URL from comma-separated FRONTEND_URL for email links
      const firstFrontendUrl = config.FRONTEND_URL.split(',')[0].trim();
      const resetLink = `${firstFrontendUrl}/reset-password/${resetToken}`;
      
      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: 'Password Reset Request - EscaShop Optical',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2>Password Reset Request</h2>
            <p>Dear ${userName},</p>
            <p>You have requested to reset your password for your EscaShop Optical account.</p>
            <p>Please click the button below to reset your password:</p>
            <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
            <p>This link will expire in 1 hour for security reasons.</p>
            <p>If you did not request this password reset, please ignore this email or contact your administrator.</p>
            <br>
            <p>Best regards,<br>EscaShop Optical Team</p>
          </div>
        `
      };

      console.log('Sending password reset email to:', email);
      await transporter.sendMail(mailOptions);
      console.log('Password reset email sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error sending actual email:', error);
      return false;
    }
  }

  static async sendWelcomeEmail(
    email: string,
    userName: string,
    temporaryPassword: string
  ): Promise<boolean> {
    try {
      console.log(`
==================================================
WELCOME EMAIL (Development Mode)
==================================================
To: ${email}
Subject: Welcome to EscaShop Optical - Account Created

Dear ${userName},

Welcome to EscaShop Optical! Your account has been created successfully.

Your temporary login credentials:
Email: ${email}
Temporary Password: ${temporaryPassword}

Please log in and change your password immediately for security reasons.

Login URL: ${config.FRONTEND_URL.split(',')[0].trim()}/login

Best regards,
EscaShop Optical Team
==================================================
      `);

      // If email configuration is available, send actual email
      if (config.EMAIL_SERVICE_ENABLED) {
        return await this.sendActualWelcomeEmail(email, userName, temporaryPassword);
      }

      return true;
    } catch (error) {
      console.error('Error sending welcome email:', error);
      return false;
    }
  }

  private static async sendActualWelcomeEmail(
    email: string,
    userName: string,
    temporaryPassword: string
  ): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: config.EMAIL_USER,
          pass: config.EMAIL_PASSWORD
        }
      });

      const mailOptions = {
        from: config.EMAIL_FROM,
        to: email,
        subject: 'Welcome to EscaShop Optical - Account Created',
        html: `
          <div style="max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif;">
            <h2>Welcome to EscaShop Optical!</h2>
            <p>Dear ${userName},</p>
            <p>Welcome to EscaShop Optical! Your account has been created successfully.</p>
            <h3>Your temporary login credentials:</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
            <p><strong>Login URL:</strong> <a href="${config.FRONTEND_URL.split(',')[0].trim()}/login">${config.FRONTEND_URL.split(',')[0].trim()}/login</a></p>
            <p><em>Please log in and change your password immediately for security reasons.</em></p>
            <br>
            <p>Best regards,<br>EscaShop Optical Team</p>
          </div>
        `
      };

      console.log('Sending welcome email to:', email);
      await transporter.sendMail(mailOptions);
      console.log('Welcome email sent successfully to:', email);
      return true;
    } catch (error) {
      console.error('Error sending actual welcome email:', error);
      return false;
    }
  }

  static async sendNotificationEmail(
    email: string,
    subject: string,
    message: string
  ): Promise<boolean> {
    try {
      console.log(`
==================================================
NOTIFICATION EMAIL (Development Mode)
==================================================
To: ${email}
Subject: ${subject}

${message}

Best regards,
EscaShop Optical Team
==================================================
      `);

      return true;
    } catch (error) {
      console.error('Error sending notification email:', error);
      return false;
    }
  }
}
