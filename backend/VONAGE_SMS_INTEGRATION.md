# Vonage SMS API Integration

## Overview

This document describes the integration of Vonage SMS API (formerly Nexmo) with the EscaShop queue management system. Vonage provides reliable, global SMS delivery services with competitive pricing and excellent API documentation.

## Features

- **Global Coverage**: Send SMS to over 190 countries
- **Reliable Delivery**: High delivery rates with detailed delivery reports
- **Cost Effective**: Competitive pricing with pay-as-you-go model
- **Developer Friendly**: Well-documented API with comprehensive SDKs
- **Delivery Tracking**: Real-time delivery status updates

## Configuration

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# SMS Provider Configuration
SMS_PROVIDER=vonage
SMS_ENABLED=true
SMS_FROM=EscaShop

# Vonage API Credentials
VONAGE_API_KEY=your_vonage_api_key
VONAGE_API_SECRET=your_vonage_api_secret
```

### Getting Vonage API Credentials

1. **Sign up for Vonage**: Visit [Vonage Developer Portal](https://dashboard.nexmo.com/sign-up)
2. **Create an Account**: Complete the registration process
3. **Get API Credentials**: 
   - Go to your dashboard
   - Find your API Key and API Secret
   - Add them to your environment variables

## Installation

The Vonage Server SDK is already included in the project dependencies. If you need to install it manually:

```bash
npm install @vonage/server-sdk
```

## Usage

### Basic SMS Sending

The Vonage integration is automatically used when `SMS_PROVIDER=vonage` is set in environment variables.

```javascript
import { EnhancedSMSService } from './services/EnhancedSMSService';

// Send a queue position update
const notification = await EnhancedSMSService.sendQueuePositionUpdate(
  customerId,
  phoneNumber,
  customerName,
  queuePosition,
  estimatedWaitMinutes
);

// Send ready to serve notification
const notification = await EnhancedSMSService.sendReadyToServeNotification(
  customerId,
  phoneNumber,
  customerName,
  tokenNumber,
  counterName
);
```

### Notification Types

The system supports three types of SMS notifications:

1. **Queue Position Updates**: Inform customers about their current position
2. **Ready to Serve**: Notify customers when it's their turn
3. **Delay Notifications**: Alert customers about delays

### Message Templates

SMS messages are generated using customizable templates stored in the database:

```sql
-- Example queue position template
INSERT INTO sms_templates (name, template_content, variables, is_active) VALUES 
('queue_position', 'Hello [CustomerName]! Your queue position is #[QueuePosition]. Estimated wait: [EstimatedWait] minutes.', 
'["CustomerName", "QueuePosition", "EstimatedWait"]', true);
```

## Error Handling

The integration includes comprehensive error handling:

```javascript
try {
  await EnhancedSMSService.sendQueuePositionUpdate(/* parameters */);
} catch (error) {
  console.error('SMS sending failed:', error.message);
  // Error is automatically logged to database with status 'failed'
}
```

### Common Error Scenarios

1. **Authentication Errors**: Invalid API key or secret
2. **Invalid Phone Numbers**: Malformed or unsupported numbers
3. **Insufficient Credits**: Account balance too low
4. **Network Issues**: Temporary connectivity problems

## Monitoring and Analytics

### SMS Statistics

Get comprehensive SMS statistics:

```javascript
const stats = await EnhancedSMSService.getSMSStats();
console.log(stats);
// {
//   totalSent: 1250,
//   totalDelivered: 1180,
//   totalFailed: 70,
//   deliveryRate: 94.4,
//   todaySent: 45,
//   weekSent: 320,
//   monthSent: 1250
// }
```

### Delivery Tracking

All SMS messages are tracked in the database:

```sql
SELECT * FROM sms_notifications 
WHERE customer_id = ? 
ORDER BY created_at DESC;
```

## Testing

### Development Mode

During development, SMS sending can be disabled to avoid charges:

```bash
SMS_ENABLED=false
NODE_ENV=development
```

Messages will be logged to console instead of being sent.

### Test Script

Run the included test script to verify integration:

```bash
node test-vonage.js
```

## Pricing and Limits

### Vonage SMS Pricing

- **Outbound SMS**: Varies by destination (typically $0.0075 - $0.05 per message)
- **Free Credits**: New accounts receive free credits for testing
- **Volume Discounts**: Available for high-volume senders

### Rate Limits

- **Default**: 1 message per second
- **Burst**: Up to 30 messages per second (with proper configuration)
- **Custom Limits**: Available upon request

## Security Best Practices

1. **Environment Variables**: Never hardcode API credentials
2. **HTTPS Only**: All API calls use HTTPS encryption
3. **Credential Rotation**: Regularly rotate API keys
4. **Access Control**: Limit API key permissions
5. **Audit Logs**: Monitor all SMS activities

## Troubleshooting

### Common Issues

1. **SMS Not Sending**
   - Check API credentials
   - Verify phone number format
   - Ensure sufficient account balance

2. **Invalid Phone Numbers**
   - Use E.164 format (e.g., +1234567890)
   - Include country code
   - Remove special characters

3. **Authentication Errors**
   - Verify API key and secret
   - Check account status
   - Ensure credentials are properly set

### Debug Mode

Enable debug logging:

```javascript
console.log('📄 Vonage Response:', response);
console.log('🔑 API Key:', process.env.VONAGE_API_KEY ? '***' + process.env.VONAGE_API_KEY.slice(-4) : 'NOT SET');
```

## Migration from Other Providers

### From Twilio

```javascript
// Old Twilio configuration
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_phone_number

// New Vonage configuration
SMS_PROVIDER=vonage
VONAGE_API_KEY=your_api_key
VONAGE_API_SECRET=your_api_secret
```

### From Clicksend

```javascript
// Old Clicksend configuration
SMS_PROVIDER=clicksend
CLICKSEND_USERNAME=your_username
CLICKSEND_API_KEY=your_api_key

// New Vonage configuration
SMS_PROVIDER=vonage
VONAGE_API_KEY=your_api_key
VONAGE_API_SECRET=your_api_secret
```

## Support

### Documentation

- [Vonage SMS API Documentation](https://developer.vonage.com/messaging/sms/overview)
- [Node.js SDK Documentation](https://github.com/vonage/vonage-node-sdk)

### Support Channels

- **Vonage Support**: Available through dashboard
- **Community**: Stack Overflow, GitHub Issues
- **Documentation**: Comprehensive API reference

## Changelog

### Version 1.0.0
- Initial Vonage SMS integration
- Support for all notification types
- Comprehensive error handling
- Testing and monitoring features

---

*This integration was added to support multiple SMS providers and give users more flexibility in choosing their preferred SMS service.*
