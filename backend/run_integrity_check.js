const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  user: 'postgres',
  host: 'localhost',
  database: 'escashop',
  password: 'postgres',
  port: 5432,
});

// Function to clean SQL and remove comments
function cleanSQL(sql) {
  // Remove block comments /* ... */
  sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  
  // Remove line comments -- ...
  sql = sql.replace(/--.*$/gm, '');
  
  // Remove empty lines and trim
  sql = sql.replace(/^\s*$/gm, '').trim();
  
  return sql;
}

// Function to split SQL into executable statements
function splitSQL(sql) {
  const statements = [];
  const lines = sql.split('\n');
  let currentStatement = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Skip empty lines
    if (!trimmedLine) continue;
    
    currentStatement += line + '\n';
    
    // If line ends with semicolon, it's end of statement
    if (trimmedLine.endsWith(';')) {
      statements.push(currentStatement.trim());
      currentStatement = '';
    }
  }
  
  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }
  
  return statements.filter(stmt => stmt.length > 0);
}

async function runIntegrityCheck() {
  try {
    console.log('🔍 Running database integrity check...');
    console.log('='.repeat(60));
    
    const fs = require('fs');
    const path = require('path');

    // Path to the SQL script
    const scriptPath = path.join(__dirname, 'database_integrity_check.sql');
    const scriptSQL = fs.readFileSync(scriptPath, 'utf8');
    
    // Clean and split SQL
    const cleanedSQL = cleanSQL(scriptSQL);
    const statements = splitSQL(cleanedSQL);
    
    console.log(`📋 Found ${statements.length} SQL statements to execute`);
    console.log('='.repeat(60));

    let queryCount = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        queryCount++;
        console.log(`\n🔍 Executing Query ${queryCount}:`);
        
        try {
          const result = await pool.query(statement);
          
          if (result.rows && result.rows.length > 0) {
            console.log(`✅ Results found: ${result.rows.length} rows`);
            
            // Display results in a readable format
            if (result.rows.length <= 10) {
              console.table(result.rows);
            } else {
              console.log('📊 Sample of results (first 10 rows):');
              console.table(result.rows.slice(0, 10));
              console.log(`... and ${result.rows.length - 10} more rows`);
            }
          } else {
            console.log('✅ Query executed successfully - No rows returned');
          }
        } catch (queryError) {
          console.error(`❌ Error in query ${queryCount}:`, queryError.message);
          console.log('Query:', statement.substring(0, 100) + '...');
        }
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Database integrity check completed!');
    
  } catch (error) {
    console.error('❌ Error during the integrity check:', error);
  } finally {
    await pool.end();
  }
}

runIntegrityCheck();

