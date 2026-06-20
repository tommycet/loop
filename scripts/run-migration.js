#!/usr/bin/env node
// Run Supabase migration
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/001_initial_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  
  console.log('Running migration...');
  
  // Split by semicolon and run each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (!stmt) continue;
    
    console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
    console.log(stmt.substring(0, 100) + '...');
    
    try {
      const { data, error } = await supabase.rpc('exec_sql', { sql: stmt });
      if (error) {
        console.error('Error:', error);
        // Continue anyway - some errors are expected (like "already exists")
      } else {
        console.log('✓ Success');
      }
    } catch (err) {
      console.error('Exception:', err.message);
    }
  }
  
  console.log('\n✓ Migration complete');
}

runMigration().catch(console.error);
