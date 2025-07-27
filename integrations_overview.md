# Integrations Overview

This document provides an overview of EscaShop's integrations with external services.

## System Integrations

| Service          | Endpoint / URL               | Auth Method            | Failure Handling                            |
|------------------|------------------------------|------------------------|---------------------------------------------|
| **Twilio**       | SMS API                      | API Key / Token        | Retry logic in place, error logs maintained |
| **ClickSend**    | SMS API                      | Basic Auth (Username)  | Retry logic in place, error logs maintained |
| **Google Sheets**| Google Sheets API URL        | OAuth 2.0 / API Key    | Logged and user notified via dashboard      |
| **Thermal Printer** | Local Network Interface  | None                   | Manual Intervention Required                |
| **Email SMTP**   | Gmail/Office365 SMTP Server | Username/Password      | Email logs and alerts                      |

## Notes
- Twilio and ClickSend are used for sending SMS notifications.
- Google Sheets is used for exporting and analyzing customer data.
- Thermal Printers are utilized for printing queue tickets and service receipts.
- Email SMTP (Gmail/Office365) is used for sending user notifications like password resets.

This setup ensures a robust and flexible integration strategy to maintain operational efficiency across various touchpoints.
