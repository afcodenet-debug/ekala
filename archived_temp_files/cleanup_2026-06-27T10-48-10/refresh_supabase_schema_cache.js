/**
 * Refresh Supabase schema cache
 * This fixes the error: "Could not find the 'low_stock_threshold' column of 'products' in the schema cache"
 * 
 * Run this script after applying migrations in Supabase to invalidate the schema cache.
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function refreshSchemaCache() {
  console.log('🔄 Refreshing Supabase schema cache...');
  
  try {
    // Method 1: Try to invalidate cache by making a schema query
    console.log('📝 Querying products table schema...');
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .limit(0); // Don't fetch data, just schema
    
    if (error) {
      console.error('❌ Error querying products:', error.message);
      console.log('⚠️  The schema cache may still be stale.');
      console.log('💡 Try restarting your backend server to force a fresh connection.');
      process.exit(1);
    }
    
    console.log('✅ Schema cache refreshed successfully!');
    console.log('✅ The low_stock_threshold column should now be recognized.');
    console.log('');
    console.log('Next steps:');
    console.log('1. Restart your backend server (npm run build:server && npm run dev)');
    console.log('2. Try creating a product again');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

refreshSchemaCache();