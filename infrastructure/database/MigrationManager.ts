import { Pool, PoolClient } from 'pg';
import fs from 'fs/promises';
import path from 'path';

export interface Migration {
  id: string;
  version: string;
  name: string;
  upScript: string;
  downScript: string;
  checksum: string;
  appliedAt?: Date;
  rolledBackAt?: Date;
}

export interface MigrationRecord {
  id: string;
  version: string;
  name: string;
  checksum: string;
  applied_at: Date;
  rolled_back_at?: Date;
}

export class MigrationManager {
  private pool: Pool;
  private migrations: Map<string, Migration> = new Map();
  private migrationsPath: string;

  constructor(
    connectionConfig: any,
    migrationsPath: string = './backend/src/database/migrations'
  ) {
    this.pool = new Pool(connectionConfig);
    this.migrationsPath = path.resolve(migrationsPath);
    this.initialize();
  }

  private async initialize(): Promise<void> {
    await this.ensureMigrationTable();
    await this.loadMigrations();
  }

  private async ensureMigrationTable(): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id VARCHAR(255) PRIMARY KEY,
          version VARCHAR(50) NOT NULL,
          name VARCHAR(255) NOT NULL,
          checksum VARCHAR(64) NOT NULL,
          applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          rolled_back_at TIMESTAMP NULL,
          UNIQUE(version)
        );
      `);

      // Create migration log table for detailed tracking
      await client.query(`
        CREATE TABLE IF NOT EXISTS migration_log (
          id SERIAL PRIMARY KEY,
          migration_id VARCHAR(255) NOT NULL,
          action VARCHAR(20) NOT NULL, -- 'up', 'down'
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP NULL,
          error_message TEXT NULL,
          executed_by VARCHAR(100) DEFAULT 'system'
        );
      `);

      console.log('Migration tables ensured');
    } finally {
      client.release();
    }
  }

  private async loadMigrations(): Promise<void> {
    try {
      const files = await fs.readdir(this.migrationsPath);
      const migrationFiles = files.filter(file => 
        file.endsWith('.sql') && file.includes('_up_') || file.includes('_down_')
      );

      // Group migrations by ID
      const migrationGroups = new Map<string, { up?: string; down?: string }>();

      for (const file of migrationFiles) {
        const match = file.match(/^(\d{3}_\w+)_(up|down)\.sql$/);
        if (match) {
          const [, id, direction] = match;
          if (!migrationGroups.has(id)) {
            migrationGroups.set(id, {});
          }
          migrationGroups.get(id)![direction as 'up' | 'down'] = file;
        }
      }

      // Load migration content
      for (const [id, files] of migrationGroups) {
        if (files.up && files.down) {
          const upScript = await fs.readFile(
            path.join(this.migrationsPath, files.up), 
            'utf-8'
          );
          const downScript = await fs.readFile(
            path.join(this.migrationsPath, files.down), 
            'utf-8'
          );

          const version = id.split('_')[0];
          const name = id.substring(4); // Remove version prefix

          const migration: Migration = {
            id,
            version,
            name,
            upScript,
            downScript,
            checksum: this.calculateChecksum(upScript + downScript)
          };

          this.migrations.set(id, migration);
        }
      }

      console.log(`Loaded ${this.migrations.size} migrations`);
    } catch (error) {
      console.error('Failed to load migrations:', error);
      throw error;
    }
  }

  private calculateChecksum(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public async migrate(targetVersion?: string): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get applied migrations
      const appliedResult = await client.query(`
        SELECT * FROM schema_migrations 
        WHERE rolled_back_at IS NULL 
        ORDER BY version ASC
      `);
      
      const appliedMigrations = new Set(
        appliedResult.rows.map((row: MigrationRecord) => row.id)
      );

      // Get migrations to apply
      const sortedMigrations = Array.from(this.migrations.values())
        .sort((a, b) => a.version.localeCompare(b.version));

      const migrationsToApply = sortedMigrations.filter(migration => {
        if (appliedMigrations.has(migration.id)) {
          return false;
        }
        
        if (targetVersion && migration.version > targetVersion) {
          return false;
        }
        
        return true;
      });

      console.log(`Applying ${migrationsToApply.length} migrations`);

      for (const migration of migrationsToApply) {
        await this.applyMigration(client, migration);
      }

      await client.query('COMMIT');
      console.log('All migrations applied successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration failed, rolled back transaction:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async applyMigration(client: PoolClient, migration: Migration): Promise<void> {
    console.log(`Applying migration: ${migration.id} - ${migration.name}`);

    // Log migration start
    const logResult = await client.query(`
      INSERT INTO migration_log (migration_id, action) 
      VALUES ($1, 'up') 
      RETURNING id
    `, [migration.id]);
    
    const logId = logResult.rows[0].id;

    try {
      // Execute migration
      await client.query(migration.upScript);

      // Record successful migration
      await client.query(`
        INSERT INTO schema_migrations (id, version, name, checksum, applied_at)
        VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      `, [migration.id, migration.version, migration.name, migration.checksum]);

      // Update log
      await client.query(`
        UPDATE migration_log 
        SET completed_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [logId]);

      console.log(`✓ Applied migration: ${migration.id}`);
    } catch (error) {
      // Log error
      await client.query(`
        UPDATE migration_log 
        SET completed_at = CURRENT_TIMESTAMP, error_message = $2 
        WHERE id = $1
      `, [logId, error.message]);

      throw error;
    }
  }

  public async rollback(targetVersion?: string, steps?: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');

      // Get applied migrations in reverse order
      const appliedResult = await client.query(`
        SELECT * FROM schema_migrations 
        WHERE rolled_back_at IS NULL 
        ORDER BY version DESC
      `);

      let migrationsToRollback = appliedResult.rows as MigrationRecord[];

      if (targetVersion) {
        // Rollback to specific version
        migrationsToRollback = migrationsToRollback.filter(
          (migration: MigrationRecord) => migration.version > targetVersion
        );
      } else if (steps) {
        // Rollback specific number of steps
        migrationsToRollback = migrationsToRollback.slice(0, steps);
      } else {
        // Rollback one step by default
        migrationsToRollback = migrationsToRollback.slice(0, 1);
      }

      console.log(`Rolling back ${migrationsToRollback.length} migrations`);

      for (const migrationRecord of migrationsToRollback) {
        const migration = this.migrations.get(migrationRecord.id);
        if (!migration) {
          throw new Error(`Migration ${migrationRecord.id} not found in loaded migrations`);
        }

        await this.rollbackMigration(client, migration);
      }

      await client.query('COMMIT');
      console.log('Rollback completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Rollback failed:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  private async rollbackMigration(client: PoolClient, migration: Migration): Promise<void> {
    console.log(`Rolling back migration: ${migration.id} - ${migration.name}`);

    // Log rollback start
    const logResult = await client.query(`
      INSERT INTO migration_log (migration_id, action) 
      VALUES ($1, 'down') 
      RETURNING id
    `, [migration.id]);
    
    const logId = logResult.rows[0].id;

    try {
      // Execute rollback script
      await client.query(migration.downScript);

      // Mark migration as rolled back
      await client.query(`
        UPDATE schema_migrations 
        SET rolled_back_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [migration.id]);

      // Update log
      await client.query(`
        UPDATE migration_log 
        SET completed_at = CURRENT_TIMESTAMP 
        WHERE id = $1
      `, [logId]);

      console.log(`✓ Rolled back migration: ${migration.id}`);
    } catch (error) {
      // Log error
      await client.query(`
        UPDATE migration_log 
        SET completed_at = CURRENT_TIMESTAMP, error_message = $2 
        WHERE id = $1
      `, [logId, error.message]);

      throw error;
    }
  }

  public async getStatus(): Promise<{
    applied: Migration[];
    pending: Migration[];
    rolledBack: Migration[];
  }> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT * FROM schema_migrations 
        ORDER BY version ASC
      `);

      const records = result.rows as MigrationRecord[];
      const applied: Migration[] = [];
      const rolledBack: Migration[] = [];
      const pending: Migration[] = [];
      
      const appliedIds = new Set<string>();

      for (const record of records) {
        const migration = this.migrations.get(record.id);
        if (migration) {
          migration.appliedAt = record.applied_at;
          migration.rolledBackAt = record.rolled_back_at || undefined;
          
          if (record.rolled_back_at) {
            rolledBack.push(migration);
          } else {
            applied.push(migration);
            appliedIds.add(migration.id);
          }
        }
      }

      // Find pending migrations
      for (const migration of this.migrations.values()) {
        if (!appliedIds.has(migration.id)) {
          pending.push(migration);
        }
      }

      pending.sort((a, b) => a.version.localeCompare(b.version));

      return { applied, pending, rolledBack };
    } finally {
      client.release();
    }
  }

  public async createMigration(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').substring(0, 14);
    const version = timestamp.substring(0, 3); // Use first 3 digits as version
    const id = `${version}_${name.replace(/\s+/g, '_').toLowerCase()}`;

    const upFile = path.join(this.migrationsPath, `${id}_up.sql`);
    const downFile = path.join(this.migrationsPath, `${id}_down.sql`);

    const upTemplate = `-- Migration: ${name}
-- Version: ${version}
-- Direction: UP

-- Add your migration SQL here
-- Example:
-- CREATE TABLE example_table (
--   id SERIAL PRIMARY KEY,
--   name VARCHAR(255) NOT NULL,
--   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
-- );
`;

    const downTemplate = `-- Migration: ${name}
-- Version: ${version}
-- Direction: DOWN (Rollback)

-- Add your rollback SQL here
-- This should reverse the changes made in the UP migration
-- Example:
-- DROP TABLE IF EXISTS example_table;
`;

    await fs.mkdir(this.migrationsPath, { recursive: true });
    await fs.writeFile(upFile, upTemplate);
    await fs.writeFile(downFile, downTemplate);

    console.log(`Created migration files:`);
    console.log(`  UP:   ${upFile}`);
    console.log(`  DOWN: ${downFile}`);

    return id;
  }

  public async validateMigrations(): Promise<boolean> {
    const client = await this.pool.connect();
    
    try {
      const result = await client.query(`
        SELECT id, checksum FROM schema_migrations 
        WHERE rolled_back_at IS NULL
      `);

      let isValid = true;

      for (const record of result.rows) {
        const migration = this.migrations.get(record.id);
        if (!migration) {
          console.error(`Migration ${record.id} not found in filesystem`);
          isValid = false;
          continue;
        }

        if (migration.checksum !== record.checksum) {
          console.error(`Checksum mismatch for migration ${record.id}`);
          isValid = false;
        }
      }

      return isValid;
    } finally {
      client.release();
    }
  }

  public async close(): Promise<void> {
    await this.pool.end();
  }
}

// Example migration files to create
export async function createExampleMigrations(migrationsPath: string): Promise<void> {
  await fs.mkdir(migrationsPath, { recursive: true });

  // Feature flag support migration
  const featureFlagUpScript = `
-- Add feature flag support to system
CREATE TABLE IF NOT EXISTS feature_flags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) UNIQUE NOT NULL,
  enabled BOOLEAN DEFAULT FALSE,
  description TEXT,
  environments TEXT[] DEFAULT ARRAY['development'],
  rollout_percentage INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_feature_flags_name ON feature_flags(name);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(enabled);

-- Insert default feature flags
INSERT INTO feature_flags (name, enabled, description) VALUES 
('legacy-express-middleware', false, 'Use legacy Express middleware version'),
('new-react-components', false, 'Enable new React component architecture'),
('enhanced-database-pooling', false, 'Use enhanced database connection pooling'),
('websocket-v2', false, 'Enable WebSocket v2 implementation')
ON CONFLICT (name) DO NOTHING;
  `;

  const featureFlagDownScript = `
-- Remove feature flag support
DROP TABLE IF EXISTS feature_flags;
  `;

  await fs.writeFile(
    path.join(migrationsPath, '001_feature_flags_up.sql'),
    featureFlagUpScript
  );

  await fs.writeFile(
    path.join(migrationsPath, '001_feature_flags_down.sql'),
    featureFlagDownScript
  );

  // Deployment tracking migration
  const deploymentTrackingUpScript = `
-- Add deployment tracking tables
CREATE TABLE IF NOT EXISTS deployments (
  id VARCHAR(255) PRIMARY KEY,
  version VARCHAR(50) NOT NULL,
  environment VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  rolled_back_at TIMESTAMP NULL,
  rollback_reason TEXT NULL,
  health_checks JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_deployments_version ON deployments(version);
CREATE INDEX IF NOT EXISTS idx_deployments_environment ON deployments(environment);
CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_deployed_at ON deployments(deployed_at);
  `;

  const deploymentTrackingDownScript = `
-- Remove deployment tracking
DROP TABLE IF EXISTS deployments;
  `;

  await fs.writeFile(
    path.join(migrationsPath, '002_deployment_tracking_up.sql'),
    deploymentTrackingUpScript
  );

  await fs.writeFile(
    path.join(migrationsPath, '002_deployment_tracking_down.sql'),
    deploymentTrackingDownScript
  );

  console.log('Created example migration files');
}
