require('dotenv').config();
const { Pool } = require('pg');

async function addSampleCustomers() {
  const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'escashop',
    password: process.env.DB_PASSWORD || 'postgres',
    port: process.env.DB_PORT || 5432,
  });

  try {
    console.log('Adding sample customers for queue testing...');
    
    // Check if we already have customers in the queue
    const existingCustomers = await pool.query("SELECT COUNT(*) FROM customers WHERE queue_status = 'waiting'");
    
    if (parseInt(existingCustomers.rows[0].count) > 0) {
      console.log('📋 Sample customers already exist in the queue');
      return;
    }
    
    // Add sample customers
    const customers = [
      {
        name: 'John Doe',
        or_number: '20250109-001',
        contact_number: '09123456789',
        priority_flags: { senior_citizen: true, pregnant: false, pwd: false },
        queue_status: 'waiting',
        sales_agent_id: 1
      },
      {
        name: 'Jane Smith',
        or_number: '20250109-002',
        contact_number: '09987654321',
        priority_flags: { senior_citizen: false, pregnant: false, pwd: false },
        queue_status: 'waiting',
        sales_agent_id: 1
      },
      {
        name: 'Maria Garcia',
        or_number: '20250109-003',
        contact_number: '09555123456',
        priority_flags: { senior_citizen: false, pregnant: true, pwd: false },
        queue_status: 'waiting',
        sales_agent_id: 1
      },
      {
        name: 'Carlos Rodriguez',
        or_number: '20250109-004',
        contact_number: '09444567890',
        priority_flags: { senior_citizen: false, pregnant: false, pwd: true },
        queue_status: 'waiting',
        sales_agent_id: 1
      }
    ];

    for (const customer of customers) {
      const query = `
        INSERT INTO customers (
          name, or_number, contact_number, priority_flags, queue_status, 
          sales_agent_id, prescription, payment_info, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING id, name, or_number;
      `;
      
      const result = await pool.query(query, [
        customer.name,
        customer.or_number,
        customer.contact_number,
        JSON.stringify(customer.priority_flags),
        customer.queue_status,
        customer.sales_agent_id,
        JSON.stringify({}), // empty prescription
        JSON.stringify({})  // empty payment_info
      ]);
      
      console.log(`✅ Added customer: ${result.rows[0].name} (${result.rows[0].or_number})`);
    }

    // Add a default counter if none exists
    const existingCounters = await pool.query("SELECT COUNT(*) FROM counters");
    if (parseInt(existingCounters.rows[0].count) === 0) {
      await pool.query(`
        INSERT INTO counters (name, is_active, created_at, updated_at) 
        VALUES ('Counter 1', true, NOW(), NOW())
      `);
      console.log('✅ Added default counter');
    }

    console.log('🎉 Sample customers added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding sample customers:', error);
  } finally {
    await pool.end();
  }
}

addSampleCustomers();
