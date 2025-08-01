"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./config/database");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const system_settings_1 = require("./database/migrations/system_settings");
async function runMigrations() {
    try {
        console.log('Starting database migrations...');
        // Ensure database connection is established
        await (0, database_1.connectDatabase)();
        // Run consolidated migrations from the cleaned-up directory
        const consolidatedMigrationsPath = path_1.default.join(__dirname, '../../database/migrations_consolidated');
        let files = [];
        console.log('📁 Looking for consolidated migrations...');
        try {
            files = fs_1.default.readdirSync(consolidatedMigrationsPath).filter(file => file.endsWith('.sql')).sort();
            console.log(`Found ${files.length} consolidated migration files`);
        }
        catch (error) {
            console.log('No consolidated migrations directory found - using fallback');
            // Fallback to old system if consolidated migrations don't exist
            const databasePath = path_1.default.join(__dirname, 'database');
            let rootFiles = [];
            try {
                rootFiles = fs_1.default.readdirSync(databasePath).filter(file => file.endsWith('.sql') && file.startsWith('migrate-'));
            }
            catch (error) {
                console.log('No root database directory found');
            }
            for (const file of rootFiles.sort()) {
                const filePath = path_1.default.join(databasePath, file);
                console.log(`Running root SQL migration: ${file}`);
                try {
                    const sql = fs_1.default.readFileSync(filePath, { encoding: 'utf-8' });
                    await database_1.pool.query(sql);
                    console.log(`✓ Completed: ${file}`);
                }
                catch (error) {
                    console.error(`✗ Failed to run migration ${file}:`, error);
                    throw error;
                }
            }
            // Then run old migrations directory
            const oldMigrationsPath = path_1.default.join(__dirname, 'database', 'migrations');
            try {
                const oldFiles = fs_1.default.readdirSync(oldMigrationsPath).filter(file => file.endsWith('.sql')).sort();
                for (const file of oldFiles) {
                    const filePath = path_1.default.join(oldMigrationsPath, file);
                    console.log(`Running SQL migration: ${file}`);
                    try {
                        const sql = fs_1.default.readFileSync(filePath, { encoding: 'utf-8' });
                        await database_1.pool.query(sql);
                        console.log(`✓ Completed: ${file}`);
                    }
                    catch (error) {
                        console.error(`✗ Failed to run migration ${file}:`, error);
                        throw error;
                    }
                }
            }
            catch (error) {
                console.log('No old migrations directory found');
            }
            return; // Skip consolidated migration processing
        }
        // Process consolidated migrations
        for (const file of files) {
            const filePath = path_1.default.join(consolidatedMigrationsPath, file);
            console.log(`🚀 Running consolidated migration: ${file}`);
            try {
                const sql = fs_1.default.readFileSync(filePath, { encoding: 'utf-8' });
                await database_1.pool.query(sql);
                console.log(`✅ Completed: ${file}`);
            }
            catch (error) {
                console.error(`❌ Failed to run migration ${file}:`, error);
                throw error;
            }
        }
        // Run TypeScript migrations
        try {
            await (0, system_settings_1.runSystemSettingsMigration)();
            console.log('✓ Completed: system_settings.ts');
        }
        catch (error) {
            console.error('✗ Failed to run system settings migration:', error);
            throw error;
        }
        console.log('✅ All migrations completed successfully');
    }
    catch (error) {
        console.error('❌ Migration failed:', error);
        throw error;
    }
    finally {
        // Close database connection
        if (database_1.pool && database_1.pool.end) {
            await database_1.pool.end();
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
//# sourceMappingURL=migrate.js.map