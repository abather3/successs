const { pool } = require('./dist/config/database');
const argon2 = require('argon2');

async function createAdmin() {
  try {
    console.log('🔐 Creating admin user...');
    
    // Hash password
    const hashedPassword = await argon2.hash('admin123', {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MiB
      timeCost: 3,
      parallelism: 1
    });
    
    // Create admin user
    const query = `
      INSERT INTO users (email, full_name, password_hash, role, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = $3,
        role = $4,
        status = $5,
        updated_at = CURRENT_TIMESTAMP
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
      console.log('✅ Admin user created/updated successfully');
      console.log('   Email:', result.rows[0].email);
      console.log('   Name:', result.rows[0].full_name);
      console.log('   Role:', result.rows[0].role);
      console.log('   Status:', result.rows[0].status);
    }
    
    // Close pool
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
}

createAdmin();
