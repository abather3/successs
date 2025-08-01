"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueueAnalyticsService = void 0;
const database_1 = require("../config/database");
class QueueAnalyticsService {
    /**
     * Record a queue event for analytics tracking
     */
    static async recordQueueEvent(event) {
        try {
            const query = `
        INSERT INTO queue_events (
          customer_id, event_type, counter_id, queue_position,
          wait_time_minutes, service_time_minutes, is_priority
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `;
            await database_1.pool.query(query, [
                event.customerId,
                event.eventType,
                event.counterId,
                event.queuePosition,
                event.waitTimeMinutes,
                event.serviceTimeMinutes,
                event.isPriority ? 1 : 0
            ]);
            // Update hourly analytics (async, non-blocking)
            this.updateHourlyAnalytics().catch(error => {
                console.error('Failed to update hourly analytics:', error);
            });
        }
        catch (error) {
            console.error('Failed to record queue event:', error);
            // Don't throw error to prevent blocking customer creation
        }
    }
    /**
     * Update hourly analytics based on recent events
     */
    static async updateHourlyAnalytics() {
        const now = new Date();
        const currentDate = now.toISOString().split('T')[0];
        const currentHour = now.getHours();
        // Calculate metrics for current hour including processing duration
        const metricsQuery = `
      WITH hourly_events AS (
        SELECT 
          customer_id,
          event_type,
          wait_time_minutes,
          service_time_minutes,
          processing_duration_minutes,
          is_priority,
          queue_position
        FROM queue_events
        WHERE DATE(created_at) = $1 
        AND EXTRACT(HOUR FROM created_at) = $2
      ),
      metrics AS (
        SELECT 
          COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined') as total_customers,
          COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'joined' AND is_priority = true) as priority_customers,
          AVG(wait_time_minutes) FILTER (WHERE wait_time_minutes IS NOT NULL) as avg_wait_time,
          AVG(service_time_minutes) FILTER (WHERE service_time_minutes IS NOT NULL) as avg_service_time,
          MAX(queue_position) as peak_queue_length,
          COUNT(DISTINCT customer_id) FILTER (WHERE event_type = 'served') as customers_served,
          AVG(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as avg_processing_duration,
          COUNT(*) FILTER (WHERE processing_duration_minutes IS NOT NULL) as total_processing_count,
          MAX(processing_duration_minutes) as max_processing_duration,
          MIN(processing_duration_minutes) FILTER (WHERE processing_duration_minutes IS NOT NULL) as min_processing_duration
        FROM hourly_events
      )
      SELECT * FROM metrics
    `;
        const result = await database_1.pool.query(metricsQuery, [currentDate, currentHour]);
        const metrics = result.rows[0];
        if (metrics && metrics.total_customers > 0) {
            const upsertQuery = `
        INSERT INTO queue_analytics (
          date, hour, total_customers, priority_customers,
          avg_wait_time_minutes, avg_service_time_minutes,
          peak_queue_length, customers_served,
          avg_processing_duration_minutes, total_processing_count,
          max_processing_duration_minutes, min_processing_duration_minutes,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (date, hour) 
        DO UPDATE SET
          total_customers = EXCLUDED.total_customers,
          priority_customers = EXCLUDED.priority_customers,
          avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
          avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
          peak_queue_length = EXCLUDED.peak_queue_length,
          customers_served = EXCLUDED.customers_served,
          avg_processing_duration_minutes = EXCLUDED.avg_processing_duration_minutes,
          total_processing_count = EXCLUDED.total_processing_count,
          max_processing_duration_minutes = EXCLUDED.max_processing_duration_minutes,
          min_processing_duration_minutes = EXCLUDED.min_processing_duration_minutes,
          updated_at = CURRENT_TIMESTAMP
      `;
            await database_1.pool.query(upsertQuery, [
                currentDate,
                currentHour,
                metrics.total_customers || 0,
                metrics.priority_customers || 0,
                metrics.avg_wait_time || 0,
                metrics.avg_service_time || 0,
                metrics.peak_queue_length || 0,
                metrics.customers_served || 0,
                metrics.avg_processing_duration || 0,
                metrics.total_processing_count || 0,
                metrics.max_processing_duration || 0,
                metrics.min_processing_duration || 0
            ]);
        }
    }
    /**
     * Update daily summary analytics
     */
    static async updateDailySummary(date) {
        const targetDate = date || new Date().toISOString().split('T')[0];
        const summaryQuery = `
      WITH daily_metrics AS (
        SELECT 
          SUM(total_customers) as total_customers,
          SUM(priority_customers) as priority_customers,
          AVG(avg_wait_time_minutes) as avg_wait_time,
          AVG(avg_service_time_minutes) as avg_service_time,
          MAX(peak_queue_length) as peak_queue_length,
          SUM(customers_served) as customers_served,
          AVG(avg_processing_duration_minutes) as avg_processing_duration,
          SUM(total_processing_count) as total_processing_count,
          MAX(max_processing_duration_minutes) as max_processing_duration,
          MIN(min_processing_duration_minutes) as min_processing_duration
        FROM queue_analytics
        WHERE date = $1
      ),
      peak_hour AS (
        SELECT hour as peak_hour
        FROM queue_analytics
        WHERE date = $1
        ORDER BY total_customers DESC
        LIMIT 1
      ),
      busiest_counter AS (
        SELECT counter_id
        FROM queue_events
        WHERE DATE(created_at) = $1
        AND event_type = 'served'
        GROUP BY counter_id
        ORDER BY COUNT(*) DESC
        LIMIT 1
      )
      SELECT 
        dm.*,
        ph.peak_hour,
        bc.counter_id as busiest_counter_id
      FROM daily_metrics dm
      CROSS JOIN peak_hour ph
      CROSS JOIN busiest_counter bc
    `;
        const result = await database_1.pool.query(summaryQuery, [targetDate]);
        let summary = result.rows[0];
        console.log('Daily Summary Data from queue_analytics:', summary);
        // If no data from queue_analytics, fallback to customers table
        if (!summary || (!summary.total_customers && !summary.customers_served)) {
            console.log('No queue_analytics data found, generating from customers table...');
            const customerSummaryQuery = `
        WITH customer_metrics AS (
          SELECT 
            COUNT(*) as total_customers,
            COUNT(*) FILTER (WHERE 
              priority_flags->>'senior_citizen' = 'true' OR 
              priority_flags->>'pregnant' = 'true' OR 
              priority_flags->>'pwd' = 'true'
            ) as priority_customers,
            COUNT(*) FILTER (WHERE queue_status = 'completed') as customers_served,
            COUNT(*) FILTER (WHERE queue_status = 'cancelled') as customers_cancelled,
            AVG(
              CASE 
                WHEN queue_status IN ('serving', 'processing', 'completed') AND served_at IS NOT NULL
                THEN EXTRACT(EPOCH FROM (served_at - created_at))/60.0
                ELSE EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at))/60.0
              END
            ) as avg_wait_time,
            0 as avg_service_time,
            MAX(token_number) as peak_queue_length,
            EXTRACT(HOUR FROM MAX(created_at)) as peak_hour
          FROM customers 
          WHERE DATE(created_at) = $1
        ),
        busiest_counter_fallback AS (
          SELECT 1 as counter_id  -- Default fallback
        )
        SELECT 
          cm.*,
          bc.counter_id as busiest_counter_id
        FROM customer_metrics cm
        CROSS JOIN busiest_counter_fallback bc
      `;
            const customerResult = await database_1.pool.query(customerSummaryQuery, [targetDate]);
            summary = customerResult.rows[0];
            console.log('Daily Summary Data from customers table:', summary);
        }
        if (summary && (summary.total_customers > 0 || summary.customers_served > 0)) {
            const upsertQuery = `
        INSERT INTO daily_queue_summary (
          date, total_customers, priority_customers,
          avg_wait_time_minutes, avg_service_time_minutes,
          peak_hour, peak_queue_length, customers_served,
          avg_processing_duration_minutes, total_processing_count,
          max_processing_duration_minutes, min_processing_duration_minutes,
          busiest_counter_id, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
        ON CONFLICT (date)
        DO UPDATE SET
          total_customers = EXCLUDED.total_customers,
          priority_customers = EXCLUDED.priority_customers,
          avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
          avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
          peak_hour = EXCLUDED.peak_hour,
          peak_queue_length = EXCLUDED.peak_queue_length,
          customers_served = EXCLUDED.customers_served,
          avg_processing_duration_minutes = EXCLUDED.avg_processing_duration_minutes,
          total_processing_count = EXCLUDED.total_processing_count,
          max_processing_duration_minutes = EXCLUDED.max_processing_duration_minutes,
          min_processing_duration_minutes = EXCLUDED.min_processing_duration_minutes,
          busiest_counter_id = EXCLUDED.busiest_counter_id,
          updated_at = CURRENT_TIMESTAMP
      `;
            await database_1.pool.query(upsertQuery, [
                targetDate,
                summary.total_customers || 0,
                summary.priority_customers || 0,
                summary.avg_wait_time || 0,
                summary.avg_service_time || 0,
                summary.peak_hour || 0,
                summary.peak_queue_length || 0,
                summary.customers_served || 0,
                summary.avg_processing_duration || 0,
                summary.total_processing_count || 0,
                summary.max_processing_duration || 0,
                summary.min_processing_duration || 0,
                summary.busiest_counter_id || null
            ]);
        }
    }
    /**
     * Get comprehensive analytics dashboard data
     */
    static async getAnalyticsDashboard(dateRange) {
        const today = new Date().toISOString().split('T')[0];
        const endDate = dateRange?.end || today;
        const startDate = dateRange?.start || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        // Get today's summary from analytics table first
        const todayQuery = `
      SELECT * FROM daily_queue_summary WHERE date = $1
    `;
        const todayResult = await database_1.pool.query(todayQuery, [today]);
        let todaySummary = todayResult.rows[0];
        // Convert snake_case to camelCase if data exists
        if (todaySummary) {
            todaySummary = {
                date: todaySummary.date,
                totalCustomers: todaySummary.total_customers || 0,
                priorityCustomers: todaySummary.priority_customers || 0,
                avgWaitTimeMinutes: todaySummary.avg_wait_time_minutes || 0,
                avgServiceTimeMinutes: todaySummary.avg_service_time_minutes || 0,
                peakHour: todaySummary.peak_hour || new Date().getHours(),
                peakQueueLength: todaySummary.peak_queue_length || 0,
                customersServed: todaySummary.customers_served || 0,
                busiestCounterId: todaySummary.busiest_counter_id || 1
            };
        }
        // If no analytics data exists, generate from customers table with queue_events data
        if (!todaySummary) {
            const customerQuery = `
        WITH service_times AS (
          SELECT 
            qe.customer_id,
            EXTRACT(EPOCH FROM (served.created_at - called.created_at)) / 60 as service_time_minutes
          FROM queue_events qe
          JOIN queue_events called ON called.customer_id = qe.customer_id AND called.event_type = 'called'
          JOIN queue_events served ON served.customer_id = qe.customer_id AND served.event_type = 'served'
          WHERE qe.event_type = 'served'
          AND DATE(qe.created_at) = $1
        )
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE priority_flags::json->>'senior_citizen' = 'true' OR 
                                 priority_flags::json->>'pwd' = 'true' OR 
                                 priority_flags::json->>'pregnant' = 'true') as priority_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as customers_served,
          COUNT(*) FILTER (WHERE queue_status = 'waiting') as customers_waiting,
          COUNT(*) FILTER (WHERE queue_status = 'serving') as customers_serving,
          COALESCE((
            SELECT AVG(service_time_minutes) 
            FROM service_times
          ), 0) as avg_service_time,
          AVG(CASE WHEN queue_status IN ('waiting', 'serving', 'completed') THEN 
                EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 60 
              END) as avg_wait_time,
          EXTRACT(HOUR FROM MAX(created_at)) as peak_hour,
          MAX(token_number) as max_token
        FROM customers 
        WHERE DATE(created_at) = $1
      `;
            const customerResult = await database_1.pool.query(customerQuery, [today]);
            const customerData = customerResult.rows[0];
            const totalCustomers = parseInt(customerData.total_customers) || 0;
            const waitingCustomers = parseInt(customerData.customers_waiting) || 0;
            const servingCustomers = parseInt(customerData.customers_serving) || 0;
            todaySummary = {
                date: today,
                totalCustomers: totalCustomers,
                priorityCustomers: parseInt(customerData.priority_customers) || 0,
                avgWaitTimeMinutes: isNaN(parseFloat(customerData.avg_wait_time)) ? 0 : parseFloat(customerData.avg_wait_time),
                avgServiceTimeMinutes: isNaN(parseFloat(customerData.avg_service_time)) ? 0 : parseFloat(customerData.avg_service_time),
                peakHour: isNaN(parseInt(customerData.peak_hour)) ? new Date().getHours() : parseInt(customerData.peak_hour),
                peakQueueLength: Math.max(waitingCustomers + servingCustomers, parseInt(customerData.max_token) || 0),
                customersServed: parseInt(customerData.customers_served) || 0,
                busiestCounterId: 1
            };
        }
        // Get hourly trend for today
        const hourlyQuery = `
      SELECT 
        date,
        hour,
        total_customers as "totalCustomers",
        priority_customers as "priorityCustomers",
        avg_wait_time_minutes as "avgWaitTimeMinutes",
        avg_service_time_minutes as "avgServiceTimeMinutes",
        peak_queue_length as "peakQueueLength",
        customers_served as "customersServed"
      FROM queue_analytics 
      WHERE date = $1 
      ORDER BY hour
    `;
        const hourlyResult = await database_1.pool.query(hourlyQuery, [today]);
        // Get weekly comparison
        const weeklyQuery = `
      SELECT 
        date,
        total_customers as "totalCustomers",
        priority_customers as "priorityCustomers",
        avg_wait_time_minutes as "avgWaitTimeMinutes",
        avg_service_time_minutes as "avgServiceTimeMinutes",
        peak_hour as "peakHour",
        peak_queue_length as "peakQueueLength",
        customers_served as "customersServed",
        busiest_counter_id as "busiestCounterId"
      FROM daily_queue_summary 
      WHERE date BETWEEN $1 AND $2 
      ORDER BY date DESC
    `;
        const weeklyResult = await database_1.pool.query(weeklyQuery, [startDate, endDate]);
        // Get peak hours analysis from customers table
        const peakHoursQuery = `
      SELECT 
        EXTRACT(HOUR FROM created_at) as hour,
        COUNT(*) as "avgCustomers"
      FROM customers 
      WHERE DATE(created_at) BETWEEN $1 AND $2
      GROUP BY EXTRACT(HOUR FROM created_at) 
      ORDER BY "avgCustomers" DESC
      LIMIT 5
    `;
        const peakHoursResult = await database_1.pool.query(peakHoursQuery, [startDate, endDate]);
        // Get counter performance from queue events
        const counterQuery = `
      WITH counter_service_times AS (
        SELECT 
          qe.counter_id,
          EXTRACT(EPOCH FROM (served.created_at - called.created_at)) / 60 as service_time_minutes
        FROM queue_events qe
        JOIN queue_events called ON called.customer_id = qe.customer_id AND called.event_type = 'called'
        JOIN queue_events served ON served.customer_id = qe.customer_id AND served.event_type = 'served'
        WHERE qe.event_type = 'served'
        AND DATE(qe.created_at) BETWEEN $1 AND $2
        AND qe.counter_id IS NOT NULL
      )
      SELECT 
        c.id as "counterId",
        c.name,
        COUNT(cst.counter_id) as "customersServed",
        COALESCE(AVG(cst.service_time_minutes), 0) as "avgServiceTime"
      FROM counters c
      LEFT JOIN counter_service_times cst ON c.id = cst.counter_id
      WHERE c.is_active = true
      GROUP BY c.id, c.name
      ORDER BY "customersServed" DESC
    `;
        const counterResult = await database_1.pool.query(counterQuery, [startDate, endDate]);
        // Get wait time distribution from customers table
        const waitTimeQuery = `
      WITH wait_time_ranges AS (
        SELECT 
          CASE 
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 60 < 5 THEN '0-5 min'
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 60 < 10 THEN '5-10 min'
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 60 < 15 THEN '10-15 min'
            WHEN EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) / 60 < 30 THEN '15-30 min'
            ELSE '30+ min'
          END as range,
          COUNT(*) as count
        FROM customers
        WHERE DATE(created_at) BETWEEN $1 AND $2
        AND queue_status IN ('waiting', 'serving', 'completed')
        GROUP BY range
      )
      SELECT range, count FROM wait_time_ranges
      ORDER BY 
        CASE range
          WHEN '0-5 min' THEN 1
          WHEN '5-10 min' THEN 2
          WHEN '10-15 min' THEN 3
          WHEN '15-30 min' THEN 4
          WHEN '30+ min' THEN 5
        END
    `;
        const waitTimeResult = await database_1.pool.query(waitTimeQuery, [startDate, endDate]);
        return {
            today: todaySummary,
            hourlyTrend: hourlyResult.rows,
            weeklyComparison: weeklyResult.rows,
            peakHours: peakHoursResult.rows,
            counterPerformance: counterResult.rows,
            waitTimeDistribution: waitTimeResult.rows
        };
    }
    /**
     * Get queue analytics for a specific date range
     */
    static async getQueueAnalytics(startDate, endDate) {
        const query = `
      SELECT 
        date,
        hour,
        total_customers as "totalCustomers",
        priority_customers as "priorityCustomers",
        avg_wait_time_minutes as "avgWaitTimeMinutes",
        avg_service_time_minutes as "avgServiceTimeMinutes",
        peak_queue_length as "peakQueueLength",
        customers_served as "customersServed",
        COALESCE(avg_processing_duration_minutes, 0) as "avgProcessingDurationMinutes",
        COALESCE(total_processing_count, 0) as "totalProcessingCount",
        COALESCE(max_processing_duration_minutes, 0) as "maxProcessingDurationMinutes",
        COALESCE(min_processing_duration_minutes, 0) as "minProcessingDurationMinutes"
      FROM queue_analytics 
      WHERE date BETWEEN $1 AND $2 
      ORDER BY date, hour
    `;
        const result = await database_1.pool.query(query, [startDate, endDate]);
        return result.rows;
    }
    /**
     * Get daily summaries for a date range
     */
    static async getDailySummaries(startDate, endDate) {
        const query = `
      SELECT 
        date,
        total_customers as "totalCustomers",
        priority_customers as "priorityCustomers",
        avg_wait_time_minutes as "avgWaitTimeMinutes",
        avg_service_time_minutes as "avgServiceTimeMinutes",
        peak_hour as "peakHour",
        peak_queue_length as "peakQueueLength",
        customers_served as "customersServed",
        busiest_counter_id as "busiestCounterId",
        COALESCE(avg_processing_duration_minutes, 0) as "avgProcessingDurationMinutes",
        COALESCE(total_processing_count, 0) as "totalProcessingCount",
        COALESCE(max_processing_duration_minutes, 0) as "maxProcessingDurationMinutes",
        COALESCE(min_processing_duration_minutes, 0) as "minProcessingDurationMinutes"
      FROM daily_queue_summary 
      WHERE date BETWEEN $1 AND $2 
      ORDER BY date DESC
    `;
        const result = await database_1.pool.query(query, [startDate, endDate]);
        return result.rows;
    }
    /**
     * Export analytics data to different formats
     */
    static async exportAnalytics(startDate, endDate, type = 'daily') {
        if (type === 'hourly') {
            return await this.getQueueAnalytics(startDate, endDate);
        }
        else {
            return await this.getDailySummaries(startDate, endDate);
        }
    }
}
exports.QueueAnalyticsService = QueueAnalyticsService;
//# sourceMappingURL=QueueAnalyticsService.js.map