const { pool } = require('./dist/config/database');

async function syncDailyTables() {
  console.log('🔄 SYNCHRONIZING DAILY TABLES - Backend API Data Fix');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. ANALYZE DATA DISCREPANCY
    console.log('\n1️⃣  ANALYZING TABLE DATA DISCREPANCY');
    console.log('-'.repeat(40));
    
    const summaryData = await client.query(`
      SELECT date, total_customers, customers_served, avg_wait_time_minutes 
      FROM daily_queue_summary 
      ORDER BY date DESC
    `);
    
    const historyData = await client.query(`
      SELECT date, total_customers, avg_wait_time_minutes 
      FROM daily_queue_history 
      ORDER BY date DESC
    `);
    
    console.log('📊 Daily Queue Summary records:');
    summaryData.rows.forEach(row => {
      console.log(`   ${row.date}: ${row.total_customers} customers, ${row.customers_served} served, ${row.avg_wait_time_minutes}min wait`);
    });
    
    console.log('\n📈 Daily Queue History records:');
    historyData.rows.forEach(row => {
      console.log(`   ${row.date}: ${row.total_customers} customers, ${row.avg_wait_time_minutes}min wait`);
    });
    
    // 2. FIND MISSING DATES IN HISTORY TABLE
    console.log('\n2️⃣  FINDING MISSING DATES IN HISTORY TABLE');
    console.log('-'.repeat(40));
    
    const missingInHistory = await client.query(`
      SELECT s.date, s.total_customers, s.customers_served, s.priority_customers,
             s.avg_wait_time_minutes, s.avg_service_time_minutes, s.peak_hour, s.peak_queue_length
      FROM daily_queue_summary s
      LEFT JOIN daily_queue_history h ON s.date = h.date
      WHERE h.date IS NULL
      ORDER BY s.date
    `);
    
    console.log(`📅 Found ${missingInHistory.rows.length} dates missing from daily_queue_history:`);
    missingInHistory.rows.forEach(row => {
      console.log(`   ${row.date}: ${row.total_customers} customers need to be added`);
    });
    
    // 3. POPULATE MISSING RECORDS IN DAILY_QUEUE_HISTORY
    console.log('\n3️⃣  POPULATING MISSING RECORDS');
    console.log('-'.repeat(40));
    
    for (const record of missingInHistory.rows) {
      const date = record.date;
      console.log(`\n📊 Processing ${date}...`);
      
      // Get detailed customer statistics for this date
      const customerStats = await client.query(`
        SELECT 
          COUNT(*) as total_customers,
          COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting_customers,
          COUNT(*) FILTER (WHERE queue_status = 'serving') as serving_customers,
          COUNT(*) FILTER (WHERE queue_status = 'processing') as processing_customers,
          COUNT(*) FILTER (WHERE queue_status = 'completed') as completed_customers,
          COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled_customers,
          COUNT(*) FILTER (WHERE priority_flags::json->>'senior_citizen' = 'true' 
                          OR priority_flags::json->>'pwd' = 'true' 
                          OR priority_flags::json->>'pregnant' = 'true') as priority_customers,
          AVG(EXTRACT(EPOCH FROM (COALESCE(served_at, updated_at) - created_at)) / 60) as avg_wait_time,
          AVG(EXTRACT(EPOCH FROM (served_at - created_at)) / 60) FILTER (WHERE served_at IS NOT NULL) as avg_service_time,
          MAX(token_number) as peak_queue_length
        FROM customers 
        WHERE DATE(created_at) = $1
      `, [date]);
      
      const stats = customerStats.rows[0];
      
      // Get peak hour
      const peakHourQuery = await client.query(`
        SELECT EXTRACT(HOUR FROM created_at) as hour, COUNT(*) as count
        FROM customers 
        WHERE DATE(created_at) = $1
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY count DESC
        LIMIT 1
      `, [date]);
      
      const peakHour = peakHourQuery.rows.length > 0 ? peakHourQuery.rows[0].hour : 12;
      
      // Insert into daily_queue_history
      const insertResult = await client.query(`
        INSERT INTO daily_queue_history (
          date,
          total_customers,
          total_walk_ins,
          total_appointments,
          total_served,
          total_waiting,
          waiting_customers,
          serving_customers,
          processing_customers,
          completed_customers,
          cancelled_customers,
          priority_customers,
          avg_wait_time_minutes,
          avg_service_time_minutes,
          peak_hour,
          peak_queue_length,
          operating_hours,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 8, NOW(), NOW()
        )
        ON CONFLICT (date) DO UPDATE SET
          total_customers = EXCLUDED.total_customers,
          total_served = EXCLUDED.total_served,
          waiting_customers = EXCLUDED.waiting_customers,
          serving_customers = EXCLUDED.serving_customers,
          processing_customers = EXCLUDED.processing_customers,
          completed_customers = EXCLUDED.completed_customers,
          cancelled_customers = EXCLUDED.cancelled_customers,
          priority_customers = EXCLUDED.priority_customers,
          avg_wait_time_minutes = EXCLUDED.avg_wait_time_minutes,
          avg_service_time_minutes = EXCLUDED.avg_service_time_minutes,
          peak_hour = EXCLUDED.peak_hour,
          peak_queue_length = EXCLUDED.peak_queue_length,
          updated_at = NOW()
        RETURNING date, total_customers
      `, [
        date,
        parseInt(stats.total_customers || 0),
        parseInt(stats.total_customers || 0), // Assuming all are walk-ins for now
        0, // No appointments system currently
        parseInt(stats.completed_customers || 0),
        parseInt(stats.waiting_customers || 0),
        parseInt(stats.waiting_customers || 0),
        parseInt(stats.serving_customers || 0),
        parseInt(stats.processing_customers || 0),
        parseInt(stats.completed_customers || 0),
        parseInt(stats.cancelled_customers || 0),
        parseInt(stats.priority_customers || 0),
        parseFloat(stats.avg_wait_time || 0),
        parseFloat(stats.avg_service_time || 0),
        parseInt(peakHour),
        parseInt(stats.peak_queue_length || 0)
      ]);
      
      console.log(`   ✅ Added ${date} to daily_queue_history:`);
      console.log(`      • Total customers: ${stats.total_customers}`);
      console.log(`      • Completed: ${stats.completed_customers}`);
      console.log(`      • Cancelled: ${stats.cancelled_customers}`);
      console.log(`      • Avg wait time: ${parseFloat(stats.avg_wait_time || 0).toFixed(2)} minutes`);
      console.log(`      • Peak hour: ${peakHour}:00`);
    }
    
    await client.query('COMMIT');
    
    // 4. VERIFY BACKEND API DATA
    console.log('\n4️⃣  VERIFYING BACKEND API DATA');
    console.log('-'.repeat(40));
    
    // Test the historical dashboard query directly
    const dashboardQuery = `
      SELECT 
        date,
        total_customers as "totalCustomers",
        avg_wait_time_minutes as "avgWaitTime",
        completed_customers as "completedCustomers",
        cancelled_customers as "cancelledCustomers"
      FROM daily_queue_history
      WHERE date >= '2025-06-29' AND date <= '2025-07-29'
      ORDER BY date DESC
    `;
    
    const dashboardResult = await client.query(dashboardQuery);
    
    console.log('📊 Backend API will now return:');
    let totalCustomers = 0;
    let totalWaitTime = 0;
    
    dashboardResult.rows.forEach(row => {
      totalCustomers += row.totalCustomers || 0;
      totalWaitTime += parseFloat(row.avgWaitTime || 0);
      console.log(`   ${row.date}: ${row.totalCustomers} customers, ${parseFloat(row.avgWaitTime || 0).toFixed(2)}min wait, ${row.completedCustomers} completed, ${row.cancelledCustomers} cancelled`);
    });
    
    const avgWaitTime = dashboardResult.rows.length > 0 ? totalWaitTime / dashboardResult.rows.length : 0;
    
    console.log('\n📈 Dashboard Summary (Fixed):');
    console.log(`   📊 Total Customers: ${totalCustomers} (was showing 14)`);
    console.log(`   ⏱️  Avg Wait Time: ${avgWaitTime.toFixed(2)} minutes (was showing 0m)`);
    console.log(`   📅 Days with data: ${dashboardResult.rows.length}`);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ DAILY TABLES SYNCHRONIZATION COMPLETED!');
    console.log('🔄 The Historical Analytics Dashboard should now show correct data');
    console.log('💡 Please refresh your dashboard to see the updated values');
    console.log('='.repeat(60));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Failed to sync daily tables:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the sync
syncDailyTables().catch(console.error);
