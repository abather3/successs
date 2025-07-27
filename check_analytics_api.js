const { Pool } = require('pg');
const fetch = require('node-fetch');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function checkAnalyticsAPI() {
  try {
    console.log('🔍 Checking recent queue events in database...');
    
    const recentEvents = await pool.query(`
      SELECT 
        qe.id,
        qe.customer_id,
        qe.event_type,
        qe.queue_position,
        qe.wait_time_minutes,
        qe.service_time_minutes,
        qe.is_priority,
        qe.created_at,
        c.name as customer_name,
        c.or_number,
        co.name as counter_name
      FROM queue_events qe
      LEFT JOIN customers c ON qe.customer_id = c.id
      LEFT JOIN counters co ON qe.counter_id = co.id
      WHERE qe.created_at >= CURRENT_DATE
      ORDER BY qe.created_at DESC
      LIMIT 10
    `);
    
    console.log('📊 Recent events in database:');
    recentEvents.rows.forEach(row => {
      console.log(`  - ${row.event_type}: ${row.customer_name || 'Unknown'} (ID: ${row.customer_id}) at ${row.created_at}`);
    });
    
    console.log('\n🌐 Testing Analytics API...');
    
    // Test the analytics API endpoint
    const response = await fetch('http://localhost:5000/api/analytics/queue-activities', {
      headers: {
        'Authorization': `Bearer ${process.env.JWT_SECRET}`, // This won't work, but let's see the error
        'Content-Type': 'application/json'
      }
    });
    
    console.log('API Response Status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ API Response:', data);
    } else {
      const errorText = await response.text();
      console.log('❌ API Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

checkAnalyticsAPI();
