const { pool } = require('./dist/config/database');

async function analyzeDashboardDataDiscrepancy() {
  console.log('🔍 DASHBOARD DATA DISCREPANCY ANALYSIS');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  
  try {
    // 1. RAW DATABASE CUSTOMER COUNT
    console.log('\n1️⃣  RAW DATABASE ANALYSIS');
    console.log('-'.repeat(40));
    
    const totalCustomers = await client.query('SELECT COUNT(*) as count FROM customers');
    console.log(`📊 Total customers in database: ${totalCustomers.rows[0].count}`);
    
    // Break down by date ranges
    const dateBreakdown = await client.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        array_agg(DISTINCT queue_status) as statuses
      FROM customers 
      GROUP BY DATE(created_at) 
      ORDER BY date DESC
    `);
    
    console.log('\n📅 Customers by date:');
    dateBreakdown.rows.forEach(row => {
      console.log(`   ${row.date}: ${row.count} customers (statuses: ${row.statuses.join(', ')})`);
    });

    // 2. HISTORICAL ANALYTICS DATA SOURCE INVESTIGATION
    console.log('\n2️⃣  HISTORICAL ANALYTICS DATA INVESTIGATION');
    console.log('-'.repeat(40));
    
    // Check what data the dashboard might be pulling from
    
    // A) Daily Queue Summary (most likely source for historical analytics)
    const dailySummary = await client.query(`
      SELECT 
        date,
        total_customers,
        customers_served,
        avg_wait_time_minutes,
        created_at
      FROM daily_queue_summary 
      ORDER BY date DESC
    `);
    
    console.log(`📈 Daily Queue Summary records: ${dailySummary.rows.length}`);
    if (dailySummary.rows.length > 0) {
      console.log('   Recent daily summaries:');
      dailySummary.rows.slice(0, 5).forEach(row => {
        console.log(`   ${row.date}: ${row.total_customers} customers, ${row.customers_served} served, avg wait: ${row.avg_wait_time_minutes || 'N/A'}min`);
      });
    } else {
      console.log('   ⚠️  No daily queue summary records found!');
    }

    // B) Customer History (archived customers)
    const customerHistory = await client.query(`
      SELECT 
        DATE(archived_at) as date,
        COUNT(*) as archived_count,
        array_agg(DISTINCT queue_status) as statuses
      FROM customer_history 
      GROUP BY DATE(archived_at)
      ORDER BY date DESC
    `);
    
    console.log(`\n🗄️  Customer History records: ${customerHistory.rows.length}`);
    if (customerHistory.rows.length > 0) {
      console.log('   Archived customers by date:');
      customerHistory.rows.forEach(row => {
        console.log(`   ${row.date}: ${row.archived_count} archived (statuses: ${row.statuses.join(', ')})`);
      });
    } else {
      console.log('   ⚠️  No customer history records found!');
    }

    // C) Queue Analytics (hourly aggregated data)
    const queueAnalytics = await client.query(`
      SELECT 
        date,
        SUM(customers_served) as total_served_by_date,
        COUNT(*) as hourly_records
      FROM queue_analytics 
      GROUP BY date
      ORDER BY date DESC
    `);
    
    console.log(`\n📊 Queue Analytics records: ${queueAnalytics.rows.length}`);
    if (queueAnalytics.rows.length > 0) {
      console.log('   Analytics by date:');
      queueAnalytics.rows.forEach(row => {
        console.log(`   ${row.date}: ${row.total_served_by_date} served, ${row.hourly_records} hourly records`);
      });
    } else {
      console.log('   ⚠️  No queue analytics records found!');
    }

    // 3. TIME PERIOD ANALYSIS (2025-06-29 to 2025-07-29)
    console.log('\n3️⃣  TIME PERIOD ANALYSIS (Dashboard shows: 2025-06-29 to 2025-07-29)');
    console.log('-'.repeat(40));
    
    const periodAnalysis = await client.query(`
      SELECT 
        COUNT(*) as customers_in_period,
        COUNT(*) FILTER (WHERE queue_status = 'completed') as completed,
        COUNT(*) FILTER (WHERE queue_status = 'cancelled') as cancelled,
        COUNT(*) FILTER (WHERE queue_status = 'waiting') as waiting,
        COUNT(*) FILTER (WHERE queue_status = 'serving') as serving,
        COUNT(*) FILTER (WHERE queue_status = 'processing') as processing
      FROM customers 
      WHERE created_at >= '2025-06-29' AND created_at <= '2025-07-29 23:59:59'
    `);
    
    const period = periodAnalysis.rows[0];
    console.log(`📊 Customers in dashboard period (June 29 - July 29):`);
    console.log(`   Total: ${period.customers_in_period}`);
    console.log(`   Completed: ${period.completed}`);
    console.log(`   Cancelled: ${period.cancelled}`);
    console.log(`   Waiting: ${period.waiting}`);
    console.log(`   Serving: ${period.serving}`);
    console.log(`   Processing: ${period.processing}`);

    // 4. DASHBOARD METRICS ANALYSIS
    console.log('\n4️⃣  DASHBOARD METRICS ANALYSIS');
    console.log('-'.repeat(40));
    
    // Dashboard shows: 14 Total Customers, 0m Avg Wait Time, 2 Successful Resets, 0 Failed Resets, 100% Success Rate
    
    // A) Check if 14 might be from a specific calculation
    const possibleSources = await client.query(`
      SELECT 
        'daily_queue_summary' as source,
        SUM(total_customers) as total_customers,
        SUM(customers_served) as total_served,
        AVG(avg_wait_time_minutes) as avg_wait_time
      FROM daily_queue_summary
      WHERE date >= '2025-06-29' AND date <= '2025-07-29'
      
      UNION ALL
      
      SELECT 
        'customer_history' as source,
        COUNT(*) as total_customers,
        COUNT(*) FILTER (WHERE queue_status = 'completed') as total_served,
        0 as avg_wait_time
      FROM customer_history
      WHERE archived_at >= '2025-06-29' AND archived_at <= '2025-07-29 23:59:59'
      
      UNION ALL
      
      SELECT 
        'queue_events_unique_customers' as source,
        COUNT(DISTINCT customer_id) as total_customers,
        COUNT(*) FILTER (WHERE event_type = 'served') as total_served,
        0 as avg_wait_time
      FROM queue_events
      WHERE created_at >= '2025-06-29' AND created_at <= '2025-07-29 23:59:59'
    `);
    
    console.log('🔍 Possible data sources for dashboard:');
    possibleSources.rows.forEach(row => {
      console.log(`   ${row.source}: ${row.total_customers} customers, ${row.total_served} served, avg wait: ${row.avg_wait_time || 'N/A'}min`);
    });

    // 5. RESET LOGS ANALYSIS
    console.log('\n5️⃣  RESET LOGS ANALYSIS');
    console.log('-'.repeat(40));
    
    const resetEvents = await client.query(`
      SELECT 
        event_type,
        COUNT(*) as count,
        MIN(created_at) as first_occurrence,
        MAX(created_at) as last_occurrence
      FROM queue_events 
      WHERE event_type LIKE '%reset%' OR event_type = 'queue_reset'
      GROUP BY event_type
      ORDER BY count DESC
    `);
    
    if (resetEvents.rows.length > 0) {
      console.log('📋 Reset events found:');
      resetEvents.rows.forEach(row => {
        console.log(`   ${row.event_type}: ${row.count} occurrences (${row.first_occurrence} to ${row.last_occurrence})`);
      });
    } else {
      console.log('   ⚠️  No reset events found in queue_events table');
    }

    // Look for reset activity in other ways
    const systemLogs = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE remarks LIKE '%Queue Reset%') as reset_remarks_count,
        COUNT(*) FILTER (WHERE remarks LIKE '%reset%') as general_reset_count
      FROM customers
    `);
    
    console.log(`\n📝 Reset activity in customer remarks:`);
    console.log(`   Queue Reset remarks: ${systemLogs.rows[0].reset_remarks_count}`);
    console.log(`   General reset remarks: ${systemLogs.rows[0].general_reset_count}`);

    // 6. SUMMARY AND HYPOTHESIS
    console.log('\n6️⃣  DISCREPANCY ANALYSIS SUMMARY');
    console.log('-'.repeat(40));
    
    console.log('🔍 Findings:');
    console.log(`   • Database shows: ${totalCustomers.rows[0].count} total customers`);
    console.log(`   • Dashboard shows: 14 total customers`);
    console.log(`   • Discrepancy: ${totalCustomers.rows[0].count - 14} customers`);
    
    console.log('\n💡 Possible explanations:');
    console.log('   1. Dashboard pulls from daily_queue_summary (currently empty/limited)');
    console.log('   2. Dashboard filters by specific date range or status');
    console.log('   3. Dashboard counts only archived/processed customers');
    console.log('   4. Dashboard has caching issues');
    console.log('   5. Dashboard counts unique customers from queue_events');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
  } finally {
    client.release();
  }
}

// Run analysis
analyzeDashboardDataDiscrepancy().catch(console.error);
