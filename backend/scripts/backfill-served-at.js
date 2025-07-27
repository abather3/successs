#!/usr/bin/env node

/**
 * Back-fill script for served_at column in customers table
 * Step 3: Handle existing data for served_at
 * 
 * This script updates existing completed customers to have their served_at
 * timestamp set to their updated_at value, which is when they were marked as completed.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/escashop';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});

async function backfillServedAt() {
  const client = await pool.connect();
  
  try {
    console.log('Starting served_at back-fill migration...');
    
    await client.query('BEGIN');
    
    // First, check current status
    console.log('Checking current status...');
    const statusCheck = await client.query(`
      SELECT 
        queue_status,
        COUNT(*) as total_customers,
        COUNT(served_at) as customers_with_served_at,
        COUNT(*) - COUNT(served_at) as customers_missing_served_at
      FROM customers
      WHERE queue_status IN ('completed', 'cancelled')
      GROUP BY queue_status
      ORDER BY queue_status;
    `);
    
    console.log('Current status:');
    console.table(statusCheck.rows);
    
    // Back-fill completed customers
    console.log('Back-filling served_at for completed customers...');
    const completedUpdate = await client.query(`
      UPDATE customers
      SET served_at = updated_at
      WHERE served_at IS NULL
        AND queue_status = 'completed'
        AND updated_at IS NOT NULL;
    `);
    
    console.log(`Updated ${completedUpdate.rowCount} completed customers with served_at timestamp`);
    
    // Optionally back-fill cancelled customers (uncomment if desired)
    /*
    console.log('Back-filling served_at for cancelled customers...');
    const cancelledUpdate = await client.query(`
      UPDATE customers
      SET served_at = updated_at
      WHERE served_at IS NULL
        AND queue_status = 'cancelled'
        AND updated_at IS NOT NULL;
    `);
    
    console.log(`Updated ${cancelledUpdate.rowCount} cancelled customers with served_at timestamp`);
    */
    
    // Check final status
    console.log('Checking final status...');
    const finalCheck = await client.query(`
      SELECT 
        queue_status,
        COUNT(*) as total_customers,
        COUNT(served_at) as customers_with_served_at,
        COUNT(*) - COUNT(served_at) as customers_missing_served_at
      FROM customers
      WHERE queue_status IN ('completed', 'cancelled')
      GROUP BY queue_status
      ORDER BY queue_status;
    `);
    
    console.log('Final status:');
    console.table(finalCheck.rows);
    
    await client.query('COMMIT');
    console.log('Back-fill migration completed successfully!');
    
    // Show some sample results
    const sampleResults = await client.query(`
      SELECT 
        id,
        name,
        queue_status,
        created_at,
        updated_at,
        served_at,
        EXTRACT(EPOCH FROM (served_at - created_at))/60 as service_time_minutes
      FROM customers
      WHERE queue_status = 'completed'
        AND served_at IS NOT NULL
      ORDER BY served_at DESC
      LIMIT 5;
    `);
    
    console.log('Sample completed customers with served_at:');
    console.table(sampleResults.rows.map(row => ({
      id: row.id,
      name: row.name,
      status: row.queue_status,
      created: new Date(row.created_at).toLocaleString(),
      served: new Date(row.served_at).toLocaleString(),
      service_time: Math.round(row.service_time_minutes) + ' minutes'
    })));
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Back-fill migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    await backfillServedAt();
    console.log('\n✅ Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the migration
if (require.main === module) {
  main();
}

module.exports = { backfillServedAt };
