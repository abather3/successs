const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/escashop'
});

async function getTableSchema(tableName) {
  try {
    const query = `
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = $1
      ORDER BY ordinal_position;
    `;
    
    const result = await pool.query(query, [tableName]);
    return result.rows;
  } catch (error) {
    console.error(`Error getting schema for table ${tableName}:`, error);
    return [];
  }
}

async function getAllTables() {
  try {
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;
    
    const result = await pool.query(query);
    return result.rows.map(row => row.table_name);
  } catch (error) {
    console.error('Error getting table list:', error);
    return [];
  }
}

async function checkColumnExists(tableName, columnName) {
  try {
    const query = `
      SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = $2
      );
    `;
    
    const result = await pool.query(query, [tableName, columnName]);
    return result.rows[0].exists;
  } catch (error) {
    console.error(`Error checking column ${tableName}.${columnName}:`, error);
    return false;
  }
}

async function main() {
  try {
    console.log('=== DATABASE SCHEMA AUDIT ===\n');
    
    // 1. Get all tables
    console.log('1. Getting all tables...');
    const tables = await getAllTables();
    console.log('Found tables:', tables.join(', '));
    console.log('');

    // 2. Check specific tables of interest
    const targetTables = ['customers', 'activities', 'activity_logs'];
    
    for (const tableName of targetTables) {
      if (tables.includes(tableName)) {
        console.log(`=== TABLE: ${tableName} ===`);
        const schema = await getTableSchema(tableName);
        schema.forEach(col => {
          console.log(`${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}`);
        });
        console.log('');
      } else {
        console.log(`TABLE ${tableName}: NOT FOUND`);
        console.log('');
      }
    }

    // 3. Check for specific fields
    console.log('=== CHECKING FOR SPECIFIC FIELDS ===');
    
    // Check for 'served_at' field
    console.log('Searching for "served_at" field:');
    for (const tableName of tables) {
      const exists = await checkColumnExists(tableName, 'served_at');
      if (exists) {
        console.log(`  FOUND: ${tableName}.served_at`);
        const schema = await getTableSchema(tableName);
        const servedAtCol = schema.find(col => col.column_name === 'served_at');
        if (servedAtCol) {
          console.log(`    Type: ${servedAtCol.data_type}${servedAtCol.character_maximum_length ? `(${servedAtCol.character_maximum_length})` : ''}`);
          console.log(`    Nullable: ${servedAtCol.is_nullable}`);
          console.log(`    Default: ${servedAtCol.column_default || 'None'}`);
        }
      }
    }
    
    // Check for 'ip_address' field
    console.log('\nSearching for "ip_address" field:');
    for (const tableName of tables) {
      const exists = await checkColumnExists(tableName, 'ip_address');
      if (exists) {
        console.log(`  FOUND: ${tableName}.ip_address`);
        const schema = await getTableSchema(tableName);
        const ipCol = schema.find(col => col.column_name === 'ip_address');
        if (ipCol) {
          console.log(`    Type: ${ipCol.data_type}${ipCol.character_maximum_length ? `(${ipCol.character_maximum_length})` : ''}`);
          console.log(`    Nullable: ${ipCol.is_nullable}`);
          console.log(`    Default: ${ipCol.column_default || 'None'}`);
        }
      }
    }

    // 4. Generate full schema dump
    console.log('\n=== GENERATING FULL SCHEMA ===');
    let fullSchema = '-- Production Database Schema Dump\n';
    fullSchema += `-- Generated on: ${new Date().toISOString()}\n\n`;
    
    for (const tableName of tables) {
      const schema = await getTableSchema(tableName);
      fullSchema += `-- Table: ${tableName}\n`;
      schema.forEach(col => {
        fullSchema += `-- ${col.column_name}: ${col.data_type}${col.character_maximum_length ? `(${col.character_maximum_length})` : ''} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'} ${col.column_default ? `DEFAULT ${col.column_default}` : ''}\n`;
      });
      fullSchema += '\n';
    }
    
    fs.writeFileSync('production_schema_dump.txt', fullSchema);
    console.log('Full schema saved to: production_schema_dump.txt');
    
  } catch (error) {
    console.error('Error in main:', error);
  } finally {
    await pool.end();
  }
}

main();
