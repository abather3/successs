const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'escashop',
  user: 'postgres',
  password: 'postgres',
});

async function addDoctorField() {
  try {
    console.log('Adding doctor_assigned field to customers table...');
    await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS doctor_assigned VARCHAR(255)');
    console.log('Successfully added doctor_assigned field!');
  } catch (error) {
    console.error('Error adding doctor_assigned field:', error);
  } finally {
    await pool.end();
  }
}

addDoctorField();
