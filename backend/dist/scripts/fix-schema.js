"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const database_1 = require("../config/database");
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
async function fixSchema() {
    try {
        console.log('🔧 Fixing database schema for daily queue reset...');
        // Read the SQL file
        const sqlFilePath = path_1.default.join(__dirname, '../../../fix_queue_reset_schema_v2.sql');
        const sql = (0, fs_1.readFileSync)(sqlFilePath, 'utf8');
        // Execute the SQL
        await database_1.pool.query(sql);
        console.log('✅ Database schema updated successfully!');
        console.log('📋 Added:');
        console.log('  - Missing columns (served_at, carried_forward, reset_at, status, last_reset_at)');
        console.log('  - System user (id: -1)');
        console.log('  - Required tables (daily_reset_log, daily_queue_history, etc.)');
        console.log('  - Fixed foreign key constraints');
    }
    catch (error) {
        console.error('❌ Failed to fix schema:', error);
        process.exit(1);
    }
    finally {
        await database_1.pool.end();
        process.exit(0);
    }
}
fixSchema();
//# sourceMappingURL=fix-schema.js.map