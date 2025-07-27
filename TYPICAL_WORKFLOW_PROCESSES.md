# Typical Workflow Processes for Each Role

This document describes the typical daily workflow scenarios for each role in the EscaShop Optical Queue Management System, illustrating all main interactions and processes.

## 1. Sales Agent Workflow

### Daily Workflow Process
**Customer Registration → Queue Status Monitoring → Customer Communication → Performance Tracking → Support Activities**

### Detailed Workflow Steps

#### A. Morning Setup (8:00 AM - 8:30 AM)
1. **Login to System**
   - Navigate to login page
   - Enter credentials (email/password)
   - Access Sales Agent Dashboard

2. **Review Dashboard Statistics**
   - Check total customers registered
   - Review today's registrations count
   - Monitor customer status breakdown (waiting/serving/completed/cancelled)
   - View weekly and monthly performance metrics

#### B. Customer Registration Process (8:30 AM - 5:00 PM)
1. **Register New Customer**
   - Navigate to Customer Management → "Add New Customer"
   - Enter customer details:
     - Personal information (name, contact, email)
     - Prescription data (grade types, lens types)
     - Medical information (doctor details if applicable)
     - Priority flags (senior citizen, pregnant, PWD)
   - Generate OR number automatically
   - Assign token number for queue
   - Option to create initial transaction record
   - Print customer token/receipt

2. **Customer Queue Integration**
   - Customer automatically enters queue system
   - Real-time queue position updates
   - SMS notifications sent to customer

#### C. Queue Status Monitoring (Throughout Day)
1. **Monitor Own Customers**
   - View queue management dashboard
   - Track customers by queue status (waiting → serving → completed)
   - Monitor estimated wait times
   - Real-time WebSocket updates for status changes

2. **Customer Communication**
   - Send SMS notifications for:
     - Queue position updates
     - Ready for service alerts
     - Important announcements
   - Use predefined SMS templates
   - Track notification delivery status

#### D. Customer Management Activities
1. **Update Customer Information**
   - Edit customer details as needed
   - Modify prescription information
   - Update contact information
   - Adjust priority flags

2. **View Customer History**
   - Access customer transaction history
   - Review queue participation records
   - Track service completion status

#### E. Performance Monitoring
1. **Review Personal Statistics**
   - Daily registration count
   - Customer satisfaction metrics
   - Queue completion rates
   - SMS notification success rates

2. **Export Customer Data**
   - Generate customer reports
   - Export to Excel/PDF formats
   - Share data with team/management

### Key Features Access
- ✅ Customer Registration and Management (own customers only)
- ✅ Queue Status Monitoring (view-only)
- ✅ SMS Notifications (own customers)
- ✅ Personal Performance Dashboard
- ✅ Customer Data Export
- ❌ Transaction Processing
- ❌ Financial Reports
- ❌ System Administration

---

## 2. Cashier Workflow

### Daily Workflow Process
**Login → Counter Setup → Call Next Customer → Process Transaction → Complete Service → Settlement Management → Daily Reconciliation**

### Detailed Workflow Steps

#### A. Morning Setup (8:00 AM - 8:30 AM)
1. **System Login**
   - Login with cashier credentials
   - Access Cashier Dashboard

2. **Counter Configuration**
   - Set up service counter
   - Configure counter display settings
   - Test audio/visual notification systems
   - Verify transaction processing systems

#### B. Customer Service Process (8:30 AM - 5:00 PM)
1. **Queue Management**
   - Monitor real-time queue display
   - View waiting customers with priorities
   - Check estimated service times

2. **Call Next Customer**
   - Click "Call Next Customer" or select specific customer
   - System announces customer token number
   - Audio/visual display updates
   - Customer status changes to "serving"
   - SMS notification sent to customer

3. **Customer Service Interaction**
   - Verify customer identity
   - Review customer prescription details
   - Confirm service requirements
   - Process any service modifications

4. **Transaction Processing**
   - Create new transaction record
   - Enter transaction details:
     - Service amounts
     - Payment method
     - Discount applications
     - Tax calculations
   - Generate payment receipt
   - Update customer financial records

5. **Payment Settlement**
   - Process various payment methods:
     - Cash payments
     - Credit/debit cards
     - Digital payments
   - Record settlement details
   - Generate settlement reports
   - Handle payment reconciliation

6. **Complete Service**
   - Mark customer as "completed"
   - Update queue status
   - Print service completion receipt
   - Send completion SMS to customer
   - Customer removed from active queue

#### C. Queue Control Activities
1. **Manual Queue Management**
   - Reorder queue priorities when needed
   - Handle priority customers (senior, pregnant, PWD)
   - Manage no-show customers
   - Cancel customer services if needed

2. **Handle Special Cases**
   - Process walk-in customers
   - Manage emergency priorities
   - Handle customer complaints
   - Coordinate with sales agents

#### D. Transaction Management (Throughout Day)
1. **Monitor Transaction Status**
   - View all customer transactions
   - Track payment settlements
   - Monitor pending payments
   - Review completed transactions

2. **Daily Financial Activities**
   - Process cash settlements
   - Reconcile payment methods
   - Generate transaction reports
   - Handle payment discrepancies

#### E. End-of-Day Activities (5:00 PM - 5:30 PM)
1. **Daily Reconciliation**
   - Generate daily financial reports
   - Balance cash drawer
   - Reconcile card payments
   - Review transaction summaries

2. **System Maintenance**
   - Clear completed queue entries
   - Archive daily transaction data
   - Prepare system for next day
   - Log any issues or exceptions

### Key Features Access
- ✅ Queue Management (call, serve, complete customers)
- ✅ Transaction Processing (create, modify, settle)
- ✅ Payment Settlement Management
- ✅ Counter Management
- ✅ Daily Financial Reports
- ✅ Customer Service (all customers)
- ✅ SMS Notifications (service-related)
- ❌ Customer Registration
- ❌ System Administration
- ❌ User Management

---

## 3. Admin Workflow

### Daily Workflow Process
**System Monitoring → User Management → Analytics Review → Configuration Management → Report Generation → System Maintenance → Audit Review**

### Detailed Workflow Steps

#### A. Morning System Check (8:00 AM - 8:30 AM)
1. **Login and Dashboard Review**
   - Admin login with full access
   - Review system health dashboard
   - Check overnight activity logs
   - Monitor system performance metrics

2. **Queue Analytics Overview**
   - Review queue performance metrics
   - Check customer flow statistics
   - Monitor service efficiency rates
   - Identify bottlenecks or issues

#### B. User and Staff Management (8:30 AM - 10:00 AM)
1. **User Account Management**
   - Create new staff accounts (sales/cashier)
   - Modify user permissions and roles
   - Reset user passwords
   - Deactivate/reactivate accounts
   - Review user login activities

2. **Staff Performance Monitoring**
   - Review individual staff metrics
   - Monitor sales agent performance
   - Track cashier transaction volumes
   - Identify training needs

#### C. System Configuration (10:00 AM - 11:00 AM)
1. **Dropdown Management**
   - Configure grade types for prescriptions
   - Manage lens type options
   - Update service categories
   - Modify dropdown options as needed

2. **Counter Management**
   - Configure service counters
   - Set up display monitor settings
   - Manage counter assignments
   - Update counter availability

3. **SMS Template Management**
   - Create new SMS templates
   - Update existing message templates
   - Configure SMS provider settings
   - Test SMS functionality

#### D. Analytics and Reporting (11:00 AM - 12:00 PM)
1. **Queue Analytics Dashboard**
   - Review hourly queue statistics
   - Analyze customer flow patterns
   - Monitor service completion rates
   - Track average wait times
   - Identify peak hours and bottlenecks

2. **SMS Communication Analytics**
   - Monitor SMS delivery success rates
   - Track notification engagement
   - Review failed message reports
   - Optimize message templates

3. **Financial Analytics**
   - Review daily transaction summaries
   - Generate weekly/monthly reports
   - Monitor payment settlement patterns
   - Track revenue metrics

#### E. Daily Operations Management (12:00 PM - 5:00 PM)
1. **Real-time System Monitoring**
   - Monitor queue operations
   - Handle system escalations
   - Resolve technical issues
   - Support staff with complex cases

2. **Queue Management Override**
   - Manually adjust queue priorities
   - Handle special customer requests
   - Reset queue when necessary
   - Manage system-wide announcements

3. **Customer Service Support**
   - Handle escalated customer complaints
   - Review and approve special requests
   - Monitor service quality metrics
   - Coordinate between departments

#### F. Data Management and Export (3:00 PM - 4:00 PM)
1. **Export Management**
   - Generate comprehensive reports
   - Export data to Excel/PDF/Google Sheets
   - Schedule automated reports
   - Manage data backup procedures

2. **Integration Management**
   - Monitor Google Sheets synchronization
   - Manage SMS provider integrations
   - Update external API configurations
   - Test system integrations

#### G. End-of-Day Administration (5:00 PM - 5:30 PM)
1. **Activity Log Review**
   - Review all system activities
   - Check audit trails
   - Identify security concerns
   - Document important events

2. **System Maintenance**
   - Clean up old log files
   - Archive completed transactions
   - Update system settings
   - Plan maintenance activities

3. **Security and Compliance**
   - Review user access logs
   - Monitor failed login attempts
   - Update security settings
   - Ensure compliance requirements

#### H. Strategic Planning and Analysis
1. **Performance Analysis**
   - Weekly performance reviews
   - Monthly trend analysis
   - Quarterly system assessments
   - Annual planning activities

2. **System Optimization**
   - Identify improvement opportunities
   - Plan system upgrades
   - Optimize workflow processes
   - Implement efficiency measures

### Key Features Access
- ✅ Complete System Access (all modules)
- ✅ User Management (create, edit, delete users)
- ✅ System Configuration (all settings)
- ✅ Queue Management (full control)
- ✅ Analytics Dashboard (comprehensive reports)
- ✅ SMS Management (templates, providers)
- ✅ Financial Reports (all levels)
- ✅ Activity Logs (full audit access)
- ✅ Data Export (all formats)
- ✅ Counter Management
- ✅ Session and Security Settings

---

## Cross-Role Interactions

### Sales Agent → Cashier Handoff
1. Sales agent registers customer
2. Customer enters queue with token
3. Cashier calls customer for service
4. Transaction processing and payment
5. Service completion and notification

### Admin → Staff Support
1. Admin monitors staff performance
2. Provides technical support when needed
3. Handles escalated customer issues
4. Manages system configurations for optimal performance

### Real-time Communication
- WebSocket notifications for queue updates
- SMS notifications to customers
- System alerts and notifications
- Cross-role status updates

## System Integration Points

### Queue Management System
- Real-time status updates across all roles
- Priority handling for special customers
- Automated time estimation and notifications

### Transaction Processing
- Seamless handoff from registration to payment
- Real-time financial tracking
- Automated settlement processing

### Communication Systems
- Multi-provider SMS integration
- Automated notification workflows
- Template-based messaging

### Analytics and Reporting
- Real-time performance dashboards
- Comprehensive reporting across all activities
- Data export and integration capabilities

This workflow documentation provides a comprehensive view of how each role operates within the EscaShop system, ensuring efficient customer service delivery and effective system management.
