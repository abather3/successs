import { pool } from '../config/database';
import fs from 'fs';
import path from 'path';
import { runSystemSettingsMigration } from './migrations/system_settings';
import { SettingsService } from '../services/settings';

export async function initializeDatabase() {
  try {
    // First, run the SMS templates migration to clean up any existing issues
    const migrationPath = path.join(__dirname, 'migrate-sms-templates.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Running SMS templates migration...');
    await pool.query(migrationSql);
    console.log('SMS templates migration completed successfully');
    
    // Run the estimated_time column migration
    const estimatedTimeMigrationPath = path.join(__dirname, 'migrate-estimated-time.sql');
    const estimatedTimeMigrationSql = fs.readFileSync(estimatedTimeMigrationPath, 'utf8');
    
    console.log('Running estimated_time migration...');
    await pool.query(estimatedTimeMigrationSql);
    console.log('Estimated time migration completed successfully');
    
    // Run the transactions table migration
    const transactionsMigrationPath = path.join(__dirname, 'migrations', 'transactions-table.sql');
    const transactionsMigrationSql = fs.readFileSync(transactionsMigrationPath, 'utf8');
    
    console.log('Running transactions table migration...');
    await pool.query(transactionsMigrationSql);
    console.log('Transactions table migration completed successfully');
    
    // Run the daily reports table migration
    const dailyReportsMigrationPath = path.join(__dirname, 'migrations', 'daily-reports-table.sql');
    const dailyReportsMigrationSql = fs.readFileSync(dailyReportsMigrationPath, 'utf8');
    
    console.log('Running daily reports table migration...');
    await pool.query(dailyReportsMigrationSql);
    console.log('Daily reports table migration completed successfully');
    
    // Run the funds column migration to ensure backward compatibility
    const fundsColumnMigrationPath = path.join(__dirname, 'migrations', 'add-funds-column.sql');
    const fundsColumnMigrationSql = fs.readFileSync(fundsColumnMigrationPath, 'utf8');
    
    console.log('Running funds column migration...');
    await pool.query(fundsColumnMigrationSql);
    console.log('Funds column migration completed successfully');
    
    // Run the activity logs table migration
    const activityLogsMigrationPath = path.join(__dirname, 'migrations', 'activity-logs-table.sql');
    const activityLogsMigrationSql = fs.readFileSync(activityLogsMigrationPath, 'utf8');
    
    console.log('Running activity logs table migration...');
    await pool.query(activityLogsMigrationSql);
    console.log('Activity logs table migration completed successfully');
    
    // Run the customer notifications table migration
    const customerNotificationsMigrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '009_create_customer_notifications.sql');
    const customerNotificationsMigrationSql = fs.readFileSync(customerNotificationsMigrationPath, 'utf8');
    
    console.log('Running customer notifications table migration...');
    await pool.query(customerNotificationsMigrationSql);
    console.log('Customer notifications table migration completed successfully');
    
    // Run the customer notifications performance indexes migration
    const notificationIndexesMigrationPath = path.join(__dirname, '..', '..', 'database', 'migrations', '011_add_performance_indexes_customer_notifications.sql');
    const notificationIndexesMigrationSql = fs.readFileSync(notificationIndexesMigrationPath, 'utf8');
    
    console.log('Running customer notifications performance indexes migration...');
    await pool.query(notificationIndexesMigrationSql);
    console.log('Customer notifications performance indexes migration completed successfully');
    
    // Run the processing status migration
    const processingStatusMigrationPath = path.join(__dirname, 'migrations', 'V2025_07_Processing_Status.sql');
    const processingStatusMigrationSql = fs.readFileSync(processingStatusMigrationPath, 'utf8');
    
    console.log('Running processing status migration...');
    await pool.query(processingStatusMigrationSql);
    console.log('Processing status migration completed successfully');
    
    // Run the system settings migration
    await runSystemSettingsMigration();
    
    // Read and execute the main SQL initialization file
    const sqlPath = path.join(__dirname, 'init.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL commands
    await pool.query(sql);
    
    // Initialize default settings
    await SettingsService.initializeDefaultSettings();
    
    console.log('Database initialization completed successfully');
    
    // Test the counters table structure
    const testQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'counters' 
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(testQuery);
    console.log('Counters table structure:', result.rows);
    
    // Test the SMS templates table structure
    const smsTemplatesQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'sms_templates' 
      ORDER BY ordinal_position;
    `;
    
    const smsResult = await pool.query(smsTemplatesQuery);
    console.log('SMS templates table structure:', smsResult.rows);
    
    // Test the customers table structure to verify estimated_time column
    const customersQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customers' 
      ORDER BY ordinal_position;
    `;
    
    const customersResult = await pool.query(customersQuery);
    console.log('Customers table structure:', customersResult.rows);
    
    // Test the daily_reports table structure
    const dailyReportsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'daily_reports' 
      ORDER BY ordinal_position;
    `;
    
    const dailyReportsResult = await pool.query(dailyReportsQuery);
    console.log('Daily reports table structure:', dailyReportsResult.rows);
    
    // Test the transactions table structure
    const transactionsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' 
      ORDER BY ordinal_position;
    `;
    
    const transactionsResult = await pool.query(transactionsQuery);
    console.log('Transactions table structure:', transactionsResult.rows);
    
    // Test the customer_notifications table structure
    const customerNotificationsQuery = `
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'customer_notifications' 
      ORDER BY ordinal_position;
    `;
    
    const customerNotificationsResult = await pool.query(customerNotificationsQuery);
    console.log('Customer notifications table structure:', customerNotificationsResult.rows);
    
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

