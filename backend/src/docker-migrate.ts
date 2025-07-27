import { pool, connectDatabase } from './config/database';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface MigrationFile {
  version: string;
  name: string;
  filepath: string;
  checksum: string;
}

class DockerMigrationRunner {
  private containerId: string;
  private lockAcquired: boolean = false;

  constructor() {
    // Generate unique container/process identifier
    this.containerId = `${process.env.HOSTNAME || 'local'}-${process.pid}-${Date.now()}`;
  }

  private async acquireMigrationLock(): Promise<boolean> {
    const maxRetries = 30; // 30 seconds max wait
    const retryDelay = 1000; // 1 second

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Try to acquire the lock
        await pool.query(`
          INSERT INTO migration_locks (locked_by, locked_at) 
          VALUES ($1, CURRENT_TIMESTAMP)
        `, [this.containerId]);
        
        this.lockAcquired = true;
        console.log(`🔒 Migration lock acquired by ${this.containerId}`);
        return true;
      } catch (error: any) {
        if (error.code === '23505') { // Unique constraint violation
          // Lock already exists, check if it's stale
          const result = await pool.query(`
            SELECT locked_by, locked_at, 
                   EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - locked_at)) as age_seconds
            FROM migration_locks WHERE id = 1
          `);

          if (result.rows.length > 0) {
            const lock = result.rows[0];
            const ageSeconds = parseInt(lock.age_seconds);
            
            // If lock is older than 5 minutes, it's probably stale
            if (ageSeconds > 300) {
              console.log(`🔓 Found stale lock from ${lock.locked_by}, breaking it...`);
              await pool.query('DELETE FROM migration_locks WHERE id = 1');
              continue; // Try again
            }
            
            console.log(`⏳ Migration in progress by ${lock.locked_by}, waiting... (attempt ${attempt}/${maxRetries})`);
          }
        } else {
          console.error('Error acquiring lock:', error);
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    console.error('❌ Failed to acquire migration lock after maximum retries');
    return false;
  }

  private async releaseMigrationLock(): Promise<void> {
    if (this.lockAcquired) {
      try {
        await pool.query('DELETE FROM migration_locks WHERE locked_by = $1', [this.containerId]);
        console.log(`🔓 Migration lock released by ${this.containerId}`);
        this.lockAcquired = false;
      } catch (error) {
        console.error('Error releasing lock:', error);
      }
    }
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  private async ensureBaseTables(): Promise<void> {
    // Run the comprehensive base schema first
    const baseSchemaPath = path.join(__dirname, '../../database/docker-migration-system.sql');
    
    if (fs.existsSync(baseSchemaPath)) {
      console.log('📋 Running base schema setup...');
      const sql = fs.readFileSync(baseSchemaPath, 'utf-8');
      await pool.query(sql);
      console.log('✅ Base schema setup completed');
    } else {
      // Fallback: create minimal required tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          version VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(500) NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          execution_time_ms INTEGER,
          checksum VARCHAR(64),
          rollback_sql TEXT,
          status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('running', 'completed', 'failed', 'rolled_back'))
        );

        CREATE TABLE IF NOT EXISTS migration_locks (
          id INTEGER PRIMARY KEY DEFAULT 1,
          locked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          locked_by VARCHAR(255),
          migration_version VARCHAR(255),
          CONSTRAINT single_lock CHECK (id = 1)
        );
      `);
    }
  }

  private async getMigrationFiles(): Promise<MigrationFile[]> {
    const migrations: MigrationFile[] = [];
    
    // Use ONLY the consolidated migrations directory
    const sources = [
      { dir: path.join(__dirname, '../../database/migrations_consolidated'), prefix: '' }
    ];
    
    console.log('📁 Looking for migrations in consolidated directory...');

    for (const source of sources) {
      if (!fs.existsSync(source.dir)) continue;

      const files = fs.readdirSync(source.dir)
        .filter(file => file.endsWith('.sql') && file.startsWith(source.prefix))
        .sort();

      for (const file of files) {
        const filepath = path.join(source.dir, file);
        const content = fs.readFileSync(filepath, 'utf-8');
        const checksum = this.calculateChecksum(content);

        migrations.push({
          version: file.replace(/\.(sql|ts)$/, ''),
          name: file,
          filepath,
          checksum
        });
      }
    }

    // Remove duplicates based on version, keeping the first occurrence
    const seen = new Set<string>();
    return migrations.filter(migration => {
      if (seen.has(migration.version)) return false;
      seen.add(migration.version);
      return true;
    });
  }

  private async isMigrationApplied(version: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1 AND status = $2',
      [version, 'completed']
    );
    return result.rows.length > 0;
  }

  private async markMigrationAsApplied(migration: MigrationFile, executionTime: number): Promise<void> {
    await pool.query(`
      INSERT INTO schema_migrations (version, name, execution_time_ms, checksum, status) 
      VALUES ($1, $2, $3, $4, 'completed')
      ON CONFLICT (version) DO UPDATE SET
        execution_time_ms = $3,
        checksum = $4,
        status = 'completed',
        applied_at = CURRENT_TIMESTAMP
    `, [migration.version, migration.name, executionTime, migration.checksum]);
  }

  private async runSingleMigration(migration: MigrationFile): Promise<void> {
    const startTime = Date.now();
    
    console.log(`🚀 Running migration: ${migration.name}`);
    
    try {
      // Mark as running
      await pool.query(`
        INSERT INTO schema_migrations (version, name, checksum, status) 
        VALUES ($1, $2, $3, 'running')
        ON CONFLICT (version) DO UPDATE SET
          status = 'running',
          applied_at = CURRENT_TIMESTAMP
      `, [migration.version, migration.name, migration.checksum]);

      // Read and execute migration
      const sql = fs.readFileSync(migration.filepath, 'utf-8');
      
      // Split on semicolons and execute each statement
      const statements = sql.split(';').filter(stmt => stmt.trim().length > 0);
      
      for (const statement of statements) {
        if (statement.trim()) {
          await pool.query(statement);
        }
      }

      const executionTime = Date.now() - startTime;
      await this.markMigrationAsApplied(migration, executionTime);
      
      console.log(`✅ Completed: ${migration.name} (${executionTime}ms)`);
    } catch (error: any) {
      console.error(`❌ Failed: ${migration.name}`, error);
      
      // Mark as failed
      await pool.query(`
        UPDATE schema_migrations 
        SET status = 'failed', applied_at = CURRENT_TIMESTAMP 
        WHERE version = $1
      `, [migration.version]);

      // Check if it's a non-critical error we can ignore
      const ignorableErrors = [
        '42701', // column already exists
        '42P07', // relation already exists
        '42710', // object already exists
        '23505'  // unique constraint violation (duplicate key)
      ];

      if (ignorableErrors.includes(error.code)) {
        console.log(`⚠️  Ignoring non-critical error in ${migration.name}: ${error.message}`);
        const executionTime = Date.now() - startTime;
        await this.markMigrationAsApplied(migration, executionTime);
        return;
      }

      throw error;
    }
  }

  public async runMigrations(): Promise<void> {
    try {
      console.log('🐳 Starting Docker-optimized database migrations...');
      
      // Establish database connection
      await connectDatabase();
      console.log('📡 Database connection established');

      // Wait for database to be fully ready
      await this.waitForDatabase();

      // Ensure base tables exist
      await this.ensureBaseTables();

      // Acquire migration lock
      if (!(await this.acquireMigrationLock())) {
        console.log('⏭️  Another migration is in progress, exiting...');
        return;
      }

      // Get all migration files
      const migrations = await this.getMigrationFiles();
      console.log(`📁 Found ${migrations.length} migration files`);

      // Run migrations in order
      let appliedCount = 0;
      for (const migration of migrations) {
        if (await this.isMigrationApplied(migration.version)) {
          console.log(`⏭️  Skipping (already applied): ${migration.name}`);
          continue;
        }

        await this.runSingleMigration(migration);
        appliedCount++;
      }

      console.log(`🎉 Migration completed successfully! Applied ${appliedCount} new migrations.`);
      
    } catch (error) {
      console.error('💥 Migration failed:', error);
      throw error;
    } finally {
      await this.releaseMigrationLock();
    }
  }

  private async waitForDatabase(): Promise<void> {
    const maxAttempts = 30;
    const delayMs = 1000;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await pool.query('SELECT 1');
        console.log('✅ Database is ready');
        return;
      } catch (error) {
        console.log(`⏳ Waiting for database... (attempt ${attempt}/${maxAttempts})`);
        if (attempt === maxAttempts) {
          throw new Error('Database connection timeout after maximum attempts');
        }
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }
}

// Main execution
async function main() {
  const runner = new DockerMigrationRunner();
  
  try {
    await runner.runMigrations();
    console.log('🏁 Migration process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('💀 Migration process failed:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  if (pool && pool.end) {
    await pool.end();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  if (pool && pool.end) {
    await pool.end();
  }
  process.exit(0);
});

if (require.main === module) {
  main();
}

export { DockerMigrationRunner };
