const { pool } = require('./dist/config/database');

async function testDeleteDailyReport() {
  try {
    // Connect to database
    await pool.connect();
    console.log('Connected to database');

    // First, check if the report exists
    const checkQuery = `SELECT * FROM daily_reports WHERE date = $1`;
    const checkResult = await pool.query(checkQuery, ['2025-07-27']);
    console.log('Report exists check:', checkResult.rows.length > 0);
    if (checkResult.rows.length > 0) {
      console.log('Report data:', checkResult.rows[0]);
    }

    // Now try to delete it
    const deleteQuery = `DELETE FROM daily_reports WHERE date = $1`;
    const deleteResult = await pool.query(deleteQuery, ['2025-07-27']);
    console.log('Delete result rowCount:', deleteResult.rowCount);
    console.log('Delete successful:', (deleteResult.rowCount ?? 0) > 0);

    // Check if it's gone
    const checkAfterResult = await pool.query(checkQuery, ['2025-07-27']);
    console.log('Report exists after delete:', checkAfterResult.rows.length > 0);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testDeleteDailyReport();
