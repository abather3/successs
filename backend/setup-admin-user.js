const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'escashop',
  password: 'postgres',
  port: 5432,
});

async function checkDatabase() {
  try {
    console.log('🔍 Checking database structure...');
    
    // Check if users table exists
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `;
    
    const tables = await pool.query(tablesQuery);
    console.log('📋 Available tables:');
    tables.rows.forEach(row => console.log(`   - ${row.table_name}`));
    
    // Check if users table exists
    const usersTableExists = tables.rows.some(row => row.table_name === 'users');
    
    if (!usersTableExists) {
      console.log('⚠️  Users table does not exist. Creating...');
      await createUsersTable();
    } else {
      console.log('✅ Users table exists');
    }
    
    // Check if admin user exists
    const adminExists = await checkAdminUser();
    
    if (!adminExists) {
      console.log('⚠️  Admin user does not exist. Creating...');
      await createAdminUser();
    } else {
      console.log('✅ Admin user exists');
    }
    
    console.log('🎉 Database setup complete!');
    console.log('📧 Admin email: admin@escashop.com');
    console.log('🔐 Admin password: admin123');
    
  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await pool.end();
  }
}

async function createUsersTable() {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      full_name VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'cashier',
      status VARCHAR(50) NOT NULL DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  
  await pool.query(createTableQuery);
  console.log('✅ Users table created successfully');
}

async function checkAdminUser() {
  try {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, ['admin@escashop.com']);
    return result.rows.length > 0;
  } catch (error) {
    return false;
  }
}

async function createAdminUser() {
  const hashedPassword = await bcrypt.hash('admin123', 12);
  
  const query = `
    INSERT INTO users (email, full_name, password_hash, role, status)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, full_name, role, status;
  `;
  
  const values = [
    'admin@escashop.com',
    'System Administrator',
    hashedPassword,
    'admin',
    'active'
  ];
  
  const result = await pool.query(query, values);
  
  if (result.rows.length > 0) {
    console.log('✅ Admin user created successfully');
    console.log('   Email:', result.rows[0].email);
    console.log('   Name:', result.rows[0].full_name);
    console.log('   Role:', result.rows[0].role);
  } else {
    console.log('ℹ️  Admin user already exists');
  }
}

// Run the setup
checkDatabase();
