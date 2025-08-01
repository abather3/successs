const argon2 = require('argon2');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/escashop',
  ssl: false,
});

async function createAdminUser() {
  try {
    console.log('🚀 Creating admin user with Argon2 hash...');
    
    const hashedPassword = await argon2.hash('admin123', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MiB
      timeCost: 3,
      parallelism: 1
    });
    
    console.log('✅ Password hashed successfully');
    
    const query = `
      INSERT INTO users (email, full_name, password_hash, role, status)
      VALUES ($1, $2, $3, $4, $5)
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
    
    console.log('✅ Admin user created successfully:');
    console.log('   ID:', result.rows[0].id);
    console.log('   Email:', result.rows[0].email);
    console.log('   Name:', result.rows[0].full_name);
    console.log('   Role:', result.rows[0].role);
    console.log('   Status:', result.rows[0].status);
    console.log('🔐 Password: admin123');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

createAdminUser();
