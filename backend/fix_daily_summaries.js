const { pool } = require('./dist/config/database');

async function fixDailySummaries() {
  console.log('🔧 FIXING DAILY SUMMARIES - Dashboard Data Repair');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. ANALYZE MISSING DAILY SUMMARIES
    console.log('\n1️⃣  ANALYZING MISSING DAILY SUMMARIES');
    console.log('-'.repeat(40));
    
    // Get all dates that have customers but no daily summary
    const missingDates = await client.query(`
      SELECT 
        DATE(c.created_at) as missing_date,
        COUNT(*) as customer_count,
        array_agg(DISTINCT c.queue_status) as statuses
      FROM customers c
      LEFT JOIN daily_queue_summary dqs ON DATE(c.created_at) = dqs.date
      WHERE dqs.date IS NULL
      GROUP BY DATE(c.created_at)
      ORDER BY missing_date
    `);
    
    console.log(`📅 Found ${missingDates.rows.length} dates without daily summaries:`);
    missingDates.rows.forEach(row => {
      console.log(`   ${row.missing_date}: ${row.customer_count} customers (${row.statuses.join(', ')})`);
    });

    // 2. CREATE MISSING DAILY SUMMARIES
    console.log('\n2️⃣  CREATING MISSING DAILY SUMMARIES');
    console.log('-'.repeat(40));
    
    for (const dateRow of missingDates.rows) {
      const date = dateRow.missing_date;
      console.log(`\n📊 Processing ${date}...`);
      
      // Calculate comprehensive daily statistics
      const dailyStats = await client.query(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as customers_served,
          COUNT(*) FILTER (WHERE queue_status IN ('waiting', 'serving', 'processing')) as active_customers,
          COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled_customers,
          COUNT(*) FILTER (WHERE priority_flags::json->>'senior_citizen' = 'true' 
                          OR priority_flags::json->>'pwd' = 'true' 
                          OR priority_flags::json->>'pregnant' = 'true') as priority_customers,
          AVG(EXTRACT(EPOCH FROM (COALESCE(served_at, updated_at) - created_at)) / 60) as avg_wait_time_minutes,
          AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) FILTER (WHERE served_at IS NOT NULL) as avg_service_time_minutes,
          MAX(token_number) as peak_queue_length
        FROM customers 
        WHERE DATE(created_at) = $1
      `, [date]);
      
      const stats = dailyStats.rows[0];
      
      // Get peak hour (hour with most customers)
      const peakHourQuery = await client.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as customer_count
        FROM customers 
        WHERE DATE(created_at) = $1
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY customer_count DESC
        LIMIT 1
      `, [date]);
      
      const peakHour = peakHourQuery.rows.length > 0 ? peakHourQuery.rows[0].hour : 12;
      
      // Insert daily summary
      const insertResult = await client.query(`
        INSERT INTO daily_queue_summary (
          date,
          total_customers,
          priority_customers,
          avg_wait_time_minutes,
          avg_service_time_minutes,
          peak_hour,
          peak_queue_length,
          customers_served,
          busiest_counter_id,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, 1, NOW(), NOW()
        )
        ON CONFLICT (date) DO UPDATE SET
          total_customers = EXCLUDED.total_customers,
          priority_customers = EXCLUDED.priority_customers,
          avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
          avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
          peak_hour = EXCLUDED.peak_hour,
          peak_queue_length = EXCLUDED.peak_queue_length,
          customers_served = EXCLUDED.customers_served,
          updated_at = NOW()
        RETURNING *
      `, [
        date,
        parseInt(stats.total_customers),
        parseInt(stats.priority_customers || 0),
        parseFloat(stats.avg_wait_time_minutes || 0),
        parseFloat(stats.avg_service_time_minutes || 0),
        parseInt(peakHour),
        parseInt(stats.peak_queue_length || 0),
        parseInt(stats.customers_served || 0)
      ]);
      
      console.log(`   ✅ Created daily summary for ${date}:`);
      console.log(`      • Total customers: ${stats.total_customers}`);
      console.log(`      • Customers served: ${stats.customers_served}`);
      console.log(`      • Priority customers: ${stats.priority_customers || 0}`);
      console.log(`      • Avg wait time: ${parseFloat(stats.avg_wait_time_minutes || 0).toFixed(2)} minutes`);
      console.log(`      • Peak hour: ${peakHour}:00`);
      console.log(`      • Peak queue length: ${stats.peak_queue_length || 0}`);
    }

    // 3. VERIFY DASHBOARD DATA AFTER FIX
    console.log('\n3️⃣  VERIFYING DASHBOARD DATA AFTER FIX');
    console.log('-'.repeat(40));
    
    // Recalculate dashboard metrics
    const dashboardMetrics = await client.query(`
      SELECT 
        SUM(total_customers) as total_customers,
        SUM(customers_served) as total_served,
        AVG(avg_wait_time_minutes) as avg_wait_time,
        COUNT(*) as days_with_data,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
      FROM daily_queue_summary
      WHERE date >= '2025-06-29' AND date <= '2025-07-29'
    `);
    
    const metrics = dashboardMetrics.rows[0];
    console.log('📊 Updated Dashboard Metrics:');
    console.log(`   📈 Total Customers: ${metrics.total_customers} (was 14)`);
    console.log(`   ✅ Total Served: ${metrics.total_served}`);
    console.log(`   ⏱️  Avg Wait Time: ${parseFloat(metrics.avg_wait_time || 0).toFixed(2)} minutes (was showing 0m)`);
    console.log(`   📅 Days with data: ${metrics.days_with_data}`);
    console.log(`   🗓️  Date range: ${metrics.earliest_date} to ${metrics.latest_date}`);

    // 4. ADDITIONAL QUEUE ANALYTICS UPDATE
    console.log('\n4️⃣  UPDATING QUEUE ANALYTICS');
    console.log('-'.repeat(40));
    
    // Check if we need to create hourly analytics for missing dates
    const missingAnalytics = await client.query(`
      SELECT DISTINCT DATE(created_at) as date
      FROM customers c
      WHERE DATE(created_at) NOT IN (
        SELECT DISTINCT date FROM queue_analytics
      )
      ORDER BY date
    `);
    
    console.log(`📊 Found ${missingAnalytics.rows.length} dates missing hourly analytics`);
    
    for (const analyticsRow of missingAnalytics.rows) {
      const date = analyticsRow.date;
      
      // Create basic hourly analytics for each hour of the day
      const hourlyData = await client.query(`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as customers_served,
          COUNT(*) FILTER (WHERE priority_flags::json->>'senior_citizen' = 'true' 
                          OR priority_flags::json->>'pwd' = 'true' 
                          OR priority_flags::json->>'pregnant' = 'true') as priority_customers,
          AVG(EXTRACT(EPOCH FROM (COALESCE(served_at, updated_at) - created_at)) / 60) as avg_wait_time,
          AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) FILTER (WHERE served_at IS NOT NULL) as avg_service_time,
          MAX(token_number) as peak_queue_length
        FROM customers 
        WHERE DATE(created_at) = $1
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `, [date]);
      
      for (const hourData of hourlyData.rows) {
        await client.query(`
          INSERT INTO queue_analytics (
            date, hour, total_customers, priority_customers,
            avg_wait_time_minutes, avg_service_time_minutes,
            peak_queue_length, customers_served, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
          ON CONFLICT (date, hour) DO NOTHING
        `, [
          date,
          parseInt(hourData.hour),
          parseInt(hourData.total_customers),
          parseInt(hourData.priority_customers || 0),
          parseFloat(hourData.avg_wait_time || 0),
          parseFloat(hourData.avg_service_time || 0),
          parseInt(hourData.peak_queue_length || 0),
          parseInt(hourData.customers_served || 0)
        ]);
      }
      
      console.log(`   📊 Created hourly analytics for ${date} (${hourlyData.rows.length} hours)`);
    }

    await client.query('COMMIT');
    
    // 5. FINAL VERIFICATION
    console.log('\n5️⃣  FINAL VERIFICATION');
    console.log('-'.repeat(40));
    
    const finalCheck = await client.query(`
      SELECT 
        COUNT(*) as total_summaries,
        SUM(total_customers) as dashboard_total,
        AVG(avg_wait_time_minutes) as avg_wait
      FROM daily_queue_summary
    `);
    
    const check = finalCheck.rows[0];
    console.log('🎯 Final Results:');
    console.log(`   📊 Daily summaries created: ${check.total_summaries}`);
    console.log(`   👥 Dashboard total customers: ${check.dashboard_total} (should now match database)`);
    console.log(`   ⏱️  Average wait time: ${parseFloat(check.avg_wait || 0).toFixed(2)} minutes`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DAILY SUMMARIES REPAIR COMPLETED SUCCESSFULLY!');
    console.log('🔄 Please refresh your Historical Analytics Dashboard');
    console.log('='.repeat(60));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to fix daily summaries:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the fix
fixDailySummaries().catch(console.error);
