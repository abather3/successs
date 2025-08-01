"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = exports.sqlitePool = exports.initializeSQLiteDatabase = exports.connectSQLiteDatabase = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
let db = null;
exports.db = db;
const connectSQLiteDatabase = async () => {
    if (db) {
        return db;
    }
    const dbPath = path_1.default.join(__dirname, '../../escashop.db');
    exports.db = db = await (0, sqlite_1.open)({
        filename: dbPath,
        driver: sqlite3_1.default.Database
    });
    console.log('SQLite database connection established');
    return db;
};
exports.connectSQLiteDatabase = connectSQLiteDatabase;
const initializeSQLiteDatabase = async () => {
    const database = await (0, exports.connectSQLiteDatabase)();
    // Create users table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      status TEXT NOT NULL DEFAULT 'active',
      reset_token TEXT,
      reset_token_expiry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create other necessary tables
    await database.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      or_number TEXT NOT NULL,
      name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT,
      age INTEGER NOT NULL,
      address TEXT NOT NULL,
      occupation TEXT,
      distribution_info TEXT NOT NULL,
      sales_agent_id INTEGER,
      doctor_assigned TEXT,
      prescription TEXT,
      grade_type TEXT NOT NULL,
      lens_type TEXT NOT NULL,
      frame_code TEXT,
      payment_info TEXT NOT NULL,
      remarks TEXT,
      priority_flags TEXT NOT NULL,
      queue_status TEXT NOT NULL,
      token_number INTEGER NOT NULL,
      priority_score INTEGER,
      estimated_time TEXT,
      manual_position INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sales_agent_id) REFERENCES users(id)
    )
  `);
    await database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      or_number TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_mode TEXT NOT NULL,
      sales_agent_id INTEGER,
      cashier_id INTEGER,
      transaction_date DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (sales_agent_id) REFERENCES users(id),
      FOREIGN KEY (cashier_id) REFERENCES users(id)
    )
  `);
    await database.exec(`
    CREATE TABLE IF NOT EXISTS queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'waiting',
      estimated_time INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
    await database.exec(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
    await database.exec(`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      delivery_status TEXT,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )
  `);
    await database.exec(`
    CREATE TABLE IF NOT EXISTS system_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create grade_types table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS grade_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create lens_types table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS lens_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create counters table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS counters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      current_customer_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (current_customer_id) REFERENCES customers(id)
    )
  `);
    // Create daily_reports table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS daily_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_cash REAL DEFAULT 0,
      total_gcash REAL DEFAULT 0,
      total_maya REAL DEFAULT 0,
      total_credit_card REAL DEFAULT 0,
      total_bank_transfer REAL DEFAULT 0,
      petty_cash_start REAL DEFAULT 0,
      petty_cash_end REAL DEFAULT 0,
      expenses TEXT DEFAULT '[]',
      funds TEXT DEFAULT '[]',
      cash_turnover REAL DEFAULT 0,
      transaction_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create SMS templates table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS sms_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      template_content TEXT NOT NULL,
      variables TEXT DEFAULT '[]',
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    // Create queue_events table for analytics
    await database.exec(`
    CREATE TABLE IF NOT EXISTS queue_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      counter_id INTEGER,
      queue_position INTEGER,
      wait_time_minutes INTEGER,
      service_time_minutes INTEGER,
      is_priority BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (counter_id) REFERENCES counters(id)
    )
  `);
    // Create queue_analytics table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS queue_analytics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      hour INTEGER NOT NULL,
      total_customers INTEGER DEFAULT 0,
      priority_customers INTEGER DEFAULT 0,
      avg_wait_time_minutes REAL DEFAULT 0,
      avg_service_time_minutes REAL DEFAULT 0,
      peak_queue_length INTEGER DEFAULT 0,
      customers_served INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, hour)
    )
  `);
    // Create daily_queue_summary table
    await database.exec(`
    CREATE TABLE IF NOT EXISTS daily_queue_summary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      total_customers INTEGER DEFAULT 0,
      priority_customers INTEGER DEFAULT 0,
      avg_wait_time_minutes REAL DEFAULT 0,
      avg_service_time_minutes REAL DEFAULT 0,
      peak_hour INTEGER DEFAULT 0,
      peak_queue_length INTEGER DEFAULT 0,
      customers_served INTEGER DEFAULT 0,
      busiest_counter_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (busiest_counter_id) REFERENCES counters(id)
    )
  `);
    // Create admin user if it doesn't exist
    const adminUser = await database.get('SELECT * FROM users WHERE email = ?', ['admin@escashop.com']);
    if (!adminUser) {
        await database.run(`
      INSERT INTO users (email, full_name, password_hash, role, status, created_at, updated_at) 
      VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
            'admin@escashop.com',
            'System Administrator',
            '$argon2id$v=19$m=65536,t=3,p=1$cm4QAbhLsLexS9VCv4oeFw$M/cyI82HfCUBa26PUDxZj5ciXK3CUfHnuJlvrvfyDBo',
            'admin',
            'active'
        ]);
        console.log('Admin user created successfully');
        console.log('Email: admin@escashop.com');
        console.log('Password: admin123');
    }
    // Insert default grade types
    const gradeTypes = [
        'No Grade',
        'Single Grade (SV)',
        'Single Vision-Reading (SV-READING)',
        'Single Vision Hi-Cylinder (SV-HC)',
        'Process Single Vision (PROC-SV)',
        'Progressive (PROG)',
        'Process-Progressive (PROC-PROG)',
        'Doble Vista (KK)',
        'Process Doble Vista (PROC-KK)',
        'Single Vision-Ultra Thin 1.61 (SV-UTH 1.61)',
        'Single Vision-Ultra Thin 1.67 (SV-UTH 1.67)',
        'Flat-Top (F.T)',
        'Process Flat-Top (Proc-F.T)',
        'Ultra-Thin High Cylinder 1.61 (UTH 1.61 HC)',
        'Ultra-Thin High Cylinder 1.67 (UTH 1.67 HC)',
        'Process High Cylinder Ultra Thin 1.61 (PROC-HC-UTH 1.61)',
        'Process High Cylinder Ultra Thin 1.67 (PROC-HC-UTH 1.67)',
        'other'
    ];
    for (const gradeType of gradeTypes) {
        await database.run(`
      INSERT OR IGNORE INTO grade_types (name, description) 
      VALUES (?, ?)
    `, [gradeType, `${gradeType} grade type`]);
    }
    // Insert default lens types
    const lensTypes = [
        'non-coated (ORD)',
        'anti-radiation (MC)',
        'photochromic anti-radiation (TRG)',
        'anti-blue light (BB)',
        'photochromic anti-blue light (BTS)',
        'ambermatic tinted (AMB)',
        'essilor',
        'hoya'
    ];
    for (const lensType of lensTypes) {
        await database.run(`
      INSERT OR IGNORE INTO lens_types (name, description) 
      VALUES (?, ?)
    `, [lensType, `${lensType} lens type`]);
    }
    // Insert default counters
    await database.run(`
    INSERT OR IGNORE INTO counters (name, display_order, is_active) 
    VALUES ('Counter 1', 1, 1)
  `);
    await database.run(`
    INSERT OR IGNORE INTO counters (name, display_order, is_active) 
    VALUES ('Counter 2', 2, 1)
  `);
    console.log('Default data initialized successfully');
};
exports.initializeSQLiteDatabase = initializeSQLiteDatabase;
// SQLite adapter for existing services
exports.sqlitePool = {
    query: async (text, params) => {
        const database = await (0, exports.connectSQLiteDatabase)();
        if (text.trim().toUpperCase().startsWith('SELECT')) {
            const rows = await database.all(text, params);
            return { rows, rowCount: rows.length };
        }
        else {
            const result = await database.run(text, params);
            return { rows: [], rowCount: result.changes || 0 };
        }
    }
};
//# sourceMappingURL=database-sqlite.js.map