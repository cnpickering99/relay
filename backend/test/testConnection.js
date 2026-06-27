// testConnection.js
//
// Quick standalone script to verify the database connection works.
// Run with: node testConnection.js

const pool = require('./../data/db');

async function testConnection() {
  console.log('Testing database connection...');


  try {
    // 1. Basic connectivity check
    const timeResult = await pool.query('SELECT NOW() AS current_time;');
    console.log('✅ Connected successfully.');
    console.log('   Server time:', timeResult.rows[0].current_time);

    // 2. Confirm the users table exists and is reachable
    const countResult = await pool.query('SELECT COUNT(*) AS user_count FROM public.users;');
    console.log(`✅ public.users table reachable. Row count: ${countResult.rows[0].user_count}`);

    // 3. Sanity-check the expected columns exist
    const columnsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users'
      ORDER BY ordinal_position;
    `);
    console.log('✅ Columns found in public.users:');
    columnsResult.rows.forEach((col) => {
      console.log(`   - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log('\nAll connection checks passed.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Connection test failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testConnection();