# Daily Queue Scheduler Integration

## Overview

The Daily Queue Scheduler has been successfully integrated into the ESCashop backend to automatically reset the queue at midnight Philippine Time and provide historical queue analytics capabilities.

## Features

### 🕐 Automatic Daily Reset
- **Schedule**: Every day at 00:00 Philippine Time (UTC+8)
- **Process**: Archives queue data, resets active queues, and broadcasts notifications
- **Data Preservation**: Customer records are archived for historical analysis
- **Recovery**: Automatic retry mechanism on failures

### 🧹 Automated Cleanup  
- **Schedule**: Every Sunday at 02:00 Philippine Time
- **Process**: Removes historical data older than 1 year
- **Efficiency**: Keeps database size manageable

### 📊 Analytics Dashboard Integration
- **Daily Queue History**: Comprehensive daily queue metrics
- **Display Monitor History**: Historical performance data
- **Customer History**: Archived customer records for trend analysis

## Files Added/Modified

### Core Services
- `src/services/DailyQueueScheduler.ts` - Main scheduler service
- `src/services/DailyQueueResetService.ts` - Daily reset operations
- `src/routes/scheduler.ts` - Administrative API endpoints
- `src/types/index.ts` - Added scheduler-related type definitions

### Integration Points
- `src/index.ts` - Scheduler initialization and graceful shutdown
- `package.json` - Added required dependencies and test scripts

### Testing
- `src/scripts/test-scheduler.ts` - Scheduler integration test
- Added npm script: `npm run test:scheduler`

## API Endpoints

All endpoints require authentication and are prefixed with `/api/scheduler`:

### GET `/status`
Get current scheduler status including next reset time and running state.

### POST `/trigger-reset`  
Manually trigger a daily reset (admin operation).

### POST `/start`
Start the scheduler (admin operation).

### POST `/stop`
Stop the scheduler (admin operation).

## Dependencies Added

```json
{
  "node-cron": "^4.2.1",
  "moment-timezone": "^0.6.0",
  "@types/node-cron": "^3.0.11"
}
```

## Configuration

### Environment Variables
The scheduler uses the existing database configuration. No additional environment variables required.

### Philippine Time Zone
- **Timezone**: `Asia/Manila` (UTC+8)
- **Automatic**: Handles daylight saving time changes
- **Validation**: Startup validation ensures timezone support

## Database Integration

### Tables Used
- `daily_queue_history` - Daily queue metrics
- `customer_history` - Archived customer records  
- `display_monitor_history` - Daily performance metrics
- `daily_reset_log` - Reset operation logs
- `system_settings` - Daily token counter

### Migration Required
Run the daily queue history migration SQL script to create required tables before using the scheduler.

## Operational Details

### Startup Process
1. Database connection established
2. Timezone support validated
3. Cron jobs scheduled for daily reset and weekly cleanup
4. Status logged and next reset time calculated

### Daily Reset Process
1. **Snapshot Creation**: Capture current queue metrics
2. **Data Archival**: Move queue data to history tables
3. **Analytics Update**: Update final daily metrics
4. **Queue Reset**: Reset active queue (preserve incomplete customers)
5. **Counter Reset**: Reset daily token counters
6. **Activity Logging**: Log reset activity for audit
7. **WebSocket Broadcast**: Notify connected clients

### Error Handling
- **Transaction Safety**: All operations wrapped in database transactions
- **Rollback**: Automatic rollback on any failure
- **Recovery**: 5-minute delayed retry on failures
- **Logging**: Comprehensive error logging and activity tracking

### Graceful Shutdown
- Scheduler properly stops during application shutdown
- No interruption of ongoing reset operations
- Clean resource cleanup

## Testing

### Manual Testing
```bash
npm run test:scheduler
```

### Status Check
```bash
# Check if scheduler is running
curl -H "Authorization: Bearer <token>" \
     http://localhost:5000/api/scheduler/status
```

### Manual Trigger (Testing)
```bash
# Manually trigger reset (for testing)
curl -X POST -H "Authorization: Bearer <token>" \
     http://localhost:5000/api/scheduler/trigger-reset
```

## Production Deployment

### Checklist
- [ ] Database migration completed
- [ ] Dependencies installed (`npm install`)
- [ ] Application built (`npm run build`)
- [ ] Scheduler test passed (`npm run test:scheduler`)
- [ ] TimeZone support validated (Asia/Manila)

### Monitoring
- Check application logs for scheduler initialization
- Monitor `activity_logs` table for scheduler operations
- Verify `daily_reset_log` entries are created daily
- Watch for WebSocket broadcasts of reset notifications

### Troubleshooting

#### Scheduler Not Starting
- Check timezone support: `moment().tz('Asia/Manila')`
- Verify database connection
- Check for TypeScript compilation errors

#### Daily Reset Failing
- Check database connectivity during reset time
- Verify required tables exist (run migration)
- Review error logs in `activity_logs` table
- Check system resources during reset

#### Missing Historical Data
- Verify migration was run correctly
- Check if daily reset is executing successfully
- Review `daily_queue_history` table for entries

## Future Enhancements

### Potential Features
- Configurable reset times per timezone
- Multiple backup/archive retention policies
- Advanced analytics and reporting
- Integration with external monitoring systems
- Custom notification systems for reset events

### Performance Optimizations
- Batch processing for large datasets
- Asynchronous archival processes
- Database indexing optimizations
- Memory usage monitoring during resets

## Support

For issues related to the scheduler integration:

1. Check the test script output: `npm run test:scheduler`
2. Review application logs during startup and reset times
3. Verify database migration completion
4. Check timezone and cron dependencies installation

The scheduler is designed to be robust and self-healing, with comprehensive error handling and recovery mechanisms built-in.
