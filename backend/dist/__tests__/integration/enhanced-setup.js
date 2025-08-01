"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnhancedTestSetup = void 0;
require("dotenv/config");
const database_1 = require("../../config/database");
const types_1 = require("../../types");
// Enhanced test setup with real database connections and minimal mocking
class EnhancedTestSetup {
    constructor() {
        this.testData = new Map();
    }
    static getInstance() {
        if (!EnhancedTestSetup.instance) {
            EnhancedTestSetup.instance = new EnhancedTestSetup();
        }
        return EnhancedTestSetup.instance;
    }
    async setupTestEnvironment() {
        // Setup test database connection
        process.env.NODE_ENV = 'integration_test';
        process.env.JWT_SECRET = 'integration-test-jwt-secret';
        process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret';
        process.env.JWT_EXPIRES_IN = '30m';
        process.env.JWT_REFRESH_EXPIRES_IN = '7d';
        // Create isolated test schema
        const testSchema = `test_${Date.now()}`;
        await this.createTestSchema(testSchema);
        return testSchema;
    }
    async createTestSchema(schemaName) {
        const client = await database_1.pool.connect();
        try {
            await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
            // Create necessary tables for integration tests
            await this.createTables(client, schemaName);
        }
        finally {
            client.release();
        }
    }
    async createTables(client, schemaName) {
        // Users table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'active',
        last_login TIMESTAMP,
        login_attempts INTEGER DEFAULT 0,
        locked_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Customers table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.customers (
        id SERIAL PRIMARY KEY,
        or_number VARCHAR(255) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        contact_number VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        age INTEGER,
        address TEXT,
        occupation VARCHAR(255),
        distribution_info VARCHAR(50) NOT NULL,
        sales_agent_id INTEGER REFERENCES ${schemaName}.users(id),
        doctor_assigned VARCHAR(255),
        prescription JSONB DEFAULT '{}',
        grade_type VARCHAR(100),
        lens_type VARCHAR(100),
        frame_code VARCHAR(100),
        estimated_time JSONB DEFAULT '{"days": 1, "hours": 0, "minutes": 0}',
        payment_info JSONB DEFAULT '{}',
        remarks TEXT,
        priority_flags JSONB DEFAULT '{"senior_citizen": false, "pregnant": false, "pwd": false}',
        queue_status VARCHAR(50) NOT NULL DEFAULT 'waiting',
        token_number INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Transactions table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.transactions (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER REFERENCES ${schemaName}.customers(id) ON DELETE CASCADE,
        or_number VARCHAR(255) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        sales_agent_id INTEGER REFERENCES ${schemaName}.users(id),
        cashier_id INTEGER REFERENCES ${schemaName}.users(id),
        transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        paid_amount DECIMAL(10,2) DEFAULT 0,
        balance_amount DECIMAL(10,2) DEFAULT 0,
        payment_status VARCHAR(50) DEFAULT 'unpaid',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Payment settlements table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.payment_settlements (
        id SERIAL PRIMARY KEY,
        transaction_id INTEGER REFERENCES ${schemaName}.transactions(id) ON DELETE CASCADE,
        amount DECIMAL(10,2) NOT NULL,
        payment_mode VARCHAR(50) NOT NULL,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        cashier_id INTEGER REFERENCES ${schemaName}.users(id),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Activity logs table
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ${schemaName}.users(id),
        action VARCHAR(255) NOT NULL,
        details JSONB DEFAULT '{}',
        ip_address INET,
        user_agent TEXT,
        session_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        // Sessions table for multi-device session management
        await client.query(`
      CREATE TABLE IF NOT EXISTS ${schemaName}.user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES ${schemaName}.users(id) ON DELETE CASCADE,
        session_token VARCHAR(255) UNIQUE NOT NULL,
        device_info JSONB DEFAULT '{}',
        ip_address INET,
        expires_at TIMESTAMP NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    }
    async createTestUsers(schemaName) {
        const client = await database_1.pool.connect();
        try {
            // Create super admin
            const superAdminResult = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['superadmin@test.com', '$2b$10$hashedpassword', 'Super Admin Test', types_1.UserRole.SUPER_ADMIN, types_1.UserStatus.ACTIVE]);
            // Create admin
            const adminResult = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['admin@test.com', '$2b$10$hashedpassword', 'Admin Test', types_1.UserRole.ADMIN, types_1.UserStatus.ACTIVE]);
            // Create sales agents
            const salesAgent1Result = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['sales1@test.com', '$2b$10$hashedpassword', 'Sales Agent 1', types_1.UserRole.SALES, types_1.UserStatus.ACTIVE]);
            const salesAgent2Result = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['sales2@test.com', '$2b$10$hashedpassword', 'Sales Agent 2', types_1.UserRole.SALES, types_1.UserStatus.ACTIVE]);
            // Create cashiers
            const cashier1Result = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['cashier1@test.com', '$2b$10$hashedpassword', 'Cashier 1', types_1.UserRole.CASHIER, types_1.UserStatus.ACTIVE]);
            const cashier2Result = await client.query(`
        INSERT INTO ${schemaName}.users (email, password, full_name, role, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `, ['cashier2@test.com', '$2b$10$hashedpassword', 'Cashier 2', types_1.UserRole.CASHIER, types_1.UserStatus.ACTIVE]);
            this.testData.set('superAdminId', superAdminResult.rows[0].id);
            this.testData.set('adminId', adminResult.rows[0].id);
            this.testData.set('salesAgent1Id', salesAgent1Result.rows[0].id);
            this.testData.set('salesAgent2Id', salesAgent2Result.rows[0].id);
            this.testData.set('cashier1Id', cashier1Result.rows[0].id);
            this.testData.set('cashier2Id', cashier2Result.rows[0].id);
            return {
                superAdminId: superAdminResult.rows[0].id,
                adminId: adminResult.rows[0].id,
                salesAgent1Id: salesAgent1Result.rows[0].id,
                salesAgent2Id: salesAgent2Result.rows[0].id,
                cashier1Id: cashier1Result.rows[0].id,
                cashier2Id: cashier2Result.rows[0].id
            };
        }
        finally {
            client.release();
        }
    }
    async createTestCustomers(schemaName, salesAgentId, count = 5) {
        const client = await database_1.pool.connect();
        const customerIds = [];
        try {
            for (let i = 1; i <= count; i++) {
                const result = await client.query(`
          INSERT INTO ${schemaName}.customers (
            or_number, name, contact_number, email, age, address,
            distribution_info, sales_agent_id, prescription, grade_type,
            lens_type, estimated_time, payment_info, priority_flags,
            queue_status, token_number
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING id
        `, [
                    `TEST-OR-${Date.now()}-${i}`,
                    `Test Customer ${i}`,
                    `123456789${i}`,
                    `customer${i}@test.com`,
                    25 + i,
                    `Test Address ${i}`,
                    'pickup',
                    salesAgentId,
                    JSON.stringify({ od: '-2.00', os: '-2.50' }),
                    'single',
                    'regular',
                    JSON.stringify({ days: 1, hours: 0, minutes: 0 }),
                    JSON.stringify({ mode: types_1.PaymentMode.CASH, amount: 1000 + (i * 100) }),
                    JSON.stringify({ senior_citizen: i % 3 === 0, pregnant: false, pwd: i % 4 === 0 }),
                    types_1.QueueStatus.WAITING,
                    i
                ]);
                customerIds.push(result.rows[0].id);
            }
            this.testData.set('customerIds', customerIds);
            return customerIds;
        }
        finally {
            client.release();
        }
    }
    async createTestTransactions(schemaName, customerIds, salesAgentId, cashierId) {
        const client = await database_1.pool.connect();
        const transactionIds = [];
        try {
            for (let i = 0; i < customerIds.length; i++) {
                const customerId = customerIds[i];
                const amount = 1000 + (i * 100);
                const result = await client.query(`
          INSERT INTO ${schemaName}.transactions (
            customer_id, or_number, amount, payment_mode,
            sales_agent_id, cashier_id, payment_status, balance_amount
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          RETURNING id
        `, [
                    customerId,
                    `TXN-${Date.now()}-${i}`,
                    amount,
                    types_1.PaymentMode.CASH,
                    salesAgentId,
                    cashierId,
                    types_1.PaymentStatus.UNPAID,
                    amount
                ]);
                transactionIds.push(result.rows[0].id);
            }
            this.testData.set('transactionIds', transactionIds);
            return transactionIds;
        }
        finally {
            client.release();
        }
    }
    getTestData(key) {
        return this.testData.get(key);
    }
    async cleanupTestSchema(schemaName) {
        const client = await database_1.pool.connect();
        try {
            await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        }
        finally {
            client.release();
        }
    }
    async simulateNetworkDelay(min = 100, max = 500) {
        const delay = Math.floor(Math.random() * (max - min + 1)) + min;
        return new Promise(resolve => setTimeout(resolve, delay));
    }
    async simulateNetworkFailure(failureRate = 0.1) {
        return Math.random() < failureRate;
    }
    generateConcurrentOperations(operationCount, operation) {
        return Array.from({ length: operationCount }, () => operation());
    }
}
exports.EnhancedTestSetup = EnhancedTestSetup;
exports.default = EnhancedTestSetup;
//# sourceMappingURL=enhanced-setup.js.map