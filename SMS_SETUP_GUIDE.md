# 📱 SMS Setup Guide for EscaShop Queue Management

## 🎯 **Quick Answer: How to Use SMS NOW**

### **Testing SMS (No API Required)**
1. **Start the development server**: `npm run dev`
2. **In Queue Management**, click the **🟣 Pink SMS Button (💬)** next to any customer
3. **Check the backend terminal** - you'll see the SMS message logged like this:

```
🔔 ===== SMS NOTIFICATION =====
📱 To: 09491243800
💬 Message: Hello John, you are currently #1 in line. Estimated wait time: 15 minutes. Thank you for your patience!
🏷️  Type: queue_position
⏰ Time: 7/10/2025, 11:49:37 AM
===============================
```

## 🎮 **Action Buttons Guide**

In the **Queue Management** interface, the Actions column has:

1. **🔵 Blue Play Button (▶️)** 
   - **Function**: Call Customer to Counter
   - **When to use**: When customer is WAITING
   - **What it does**: Changes status to "SERVING"

2. **🟢 Green Check Button (✅)** 
   - **Function**: Complete Service
   - **When to use**: When customer is SERVING
   - **What it does**: Changes status to "COMPLETED"

3. **🟣 Pink SMS Button (💬)** 
   - **Function**: Send SMS Notification
   - **When to use**: Anytime to notify customer
   - **What it does**: Sends queue position SMS

## 🚀 **Production SMS Setup**

### **Option 1: Twilio (Recommended)**
1. **Sign up**: https://www.twilio.com/
2. **Get credentials**: Account SID, Auth Token, Phone Number
3. **Install package**: `npm install twilio`
4. **Configure**:
```bash
# Create backend/.env file
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
NODE_ENV=production
```

### **Option 2: Clicksend (Philippines-friendly)**
1. **Sign up**: https://www.clicksend.com/
2. **Get API credentials**
3. **Configure**:
```bash
SMS_PROVIDER=clicksend
CLICKSEND_USERNAME=your_username
CLICKSEND_API_KEY=your_api_key
SMS_FROM=EscaShop
NODE_ENV=production
```

### **Option 3: Your Local SMS Provider**
```bash
SMS_PROVIDER=generic
SMS_API_URL=https://api.yoursmsservice.com/send
SMS_API_KEY=your_api_key
SMS_FROM=EscaShop
NODE_ENV=production
```

## 📋 **SMS Templates Available**

The system includes 3 pre-configured SMS templates:

### 1. **Queue Position**
```
Hello [CustomerName], you are currently #[QueuePosition] in line. 
Estimated wait time: [EstimatedWait] minutes. Thank you for your patience!
```

### 2. **Ready to Serve**
```
Hi [CustomerName], your order with token #[TokenNumber] at EscaShop Optical 
is now ready. Please proceed to counter [CounterName].
```

### 3. **Delay Notification**
```
Hi [CustomerName], there is a slight delay in processing. Your new estimated 
wait time is [EstimatedWait] minutes. We apologize for the inconvenience.
```

## 🔧 **Advanced Features**

### **SMS Analytics**
- View SMS statistics in Admin Panel
- Track delivery rates
- Monitor failed messages

### **Bulk SMS**
- Send notifications to all waiting customers
- Automatic queue position updates

### **Custom Templates**
- Modify SMS templates in Admin Panel
- Add custom variables
- Multi-language support

## 🎨 **Enhanced Display Monitor**

The new Display Monitor includes:
- ✨ **Smooth animations** and transitions
- 🎨 **Beautiful gradient backgrounds**
- 🏷️ **Helpful tooltips** on all buttons
- 📊 **Real-time statistics** with visual indicators
- 🎯 **Priority customer highlighting**
- 🔊 **Sound toggle** for notifications

## 🔍 **Troubleshooting**

### **SMS Not Sending**
1. Check backend console for error messages
2. Verify environment variables are set
3. Ensure customer has valid phone number
4. Check SMS provider balance/credits

### **Button Not Working**
1. Ensure user has proper permissions (cashier/admin)
2. Check browser console for errors
3. Verify customer data is complete

### **Display Monitor Issues**
1. Check if user is logged in
2. Verify database connection
3. Refresh browser cache

## 🎉 **You're All Set!**

- ✅ SMS system is **fully functional** in development mode
- ✅ **Beautiful UI** with animations and tooltips
- ✅ **Professional SMS templates** ready to use
- ✅ **Easy production setup** when you're ready
- ✅ **Comprehensive analytics** and monitoring

**Start testing now by clicking the SMS button in Queue Management!** 📱
