import { pool, connectDatabase } from './config/database';
import fs from 'fs';
import path from 'path';
import { runSystemSettingsMigration } from './database/migrations/system_settings';

async function runMigrations() {
  try {
    console.log('Starting database migrations...');
    
    // Ensure database connection is established
    await connectDatabase();
    
    // Run consolidated migrations from the cleaned-up directory
    const consolidatedMigrationsPath = path.join(__dirname, '../../database/migrations_consolidated');
    let files: string[] = [];
    
    console.log('📁 Looking for consolidated migrations...');
    
    try {
      files = fs.readdirSync(consolidatedMigrationsPath).filter(file => file.endsWith('.sql')).sort();
      console.log(`Found ${files.length} consolidated migration files`);
    } catch (error) {
      console.log('No consolidated migrations directory found - using fallback');
      
      // Fallback to old system if consolidated migrations don't exist
      const databasePath = path.join(__dirname, 'database');
      let rootFiles: string[] = [];
      
      try {
        rootFiles = fs.readdirSync(databasePath).filter(file => file.endsWith('.sql') && file.startsWith('migrate-'));
      } catch (error) {
        console.log('No root database directory found');
      }
      
      for (const file of rootFiles.sort()) {
        const filePath = path.join(databasePath, file);
        console.log(`Running root SQL migration: ${file}`);
        try {
          const sql = fs.readFileSync(filePath, { encoding: 'utf-8' });
          await pool.query(sql);
          console.log(`✓ Completed: ${file}`);
        } catch (error) {
          console.error(`✗ Failed to run migration ${file}:`, error);
          throw error;
        }
      }
      
      // Then run old migrations directory
      const oldMigrationsPath = path.join(__dirname, 'database', 'migrations');
      try {
        const oldFiles = fs.readdirSync(oldMigrationsPath).filter(file => file.endsWith('.sql')).sort();
        for (const file of oldFiles) {
          const filePath = path.join(oldMigrationsPath, file);
          console.log(`Running SQL migration: ${file}`);
          try {
            const sql = fs.readFileSync(filePath, { encoding: 'utf-8' });
            await pool.query(sql);
            console.log(`✓ Completed: ${file}`);
          } catch (error) {
            console.error(`✗ Failed to run migration ${file}:`, error);
            throw error;
          }
        }
      } catch (error) {
        console.log('No old migrations directory found');
      }
      
      return; // Skip consolidated migration processing
    }

    // Process consolidated migrations
    for (const file of files) {
      const filePath = path.join(consolidatedMigrationsPath, file);
      console.log(`🚀 Running consolidated migration: ${file}`);
      try {
        const sql = fs.readFileSync(filePath, { encoding: 'utf-8' });
        await pool.query(sql);
        console.log(`✅ Completed: ${file}`);
      } catch (error) {
        console.error(`❌ Failed to run migration ${file}:`, error);
        throw error;
      }
    }

    // Run TypeScript migrations
    try {
      await runSystemSettingsMigration();
      console.log('✓ Completed: system_settings.ts');
    } catch (error) {
      console.error('✗ Failed to run system settings migration:', error);
      throw error;
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    // Close database connection
    if (pool && pool.end) {
      await pool.end();
    }
  }
}

runMigrations()
  .then(() => {
    console.log('Migration process completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration process failed:', error);
    process.exit(1);
  });
