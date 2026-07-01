/**
 * Diagnostic script to understand why product creation fails
 * Checks both SQLite and Supabase for duplicate constraints
 */

const Database = require('better-sqlite3');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const DB_PATH = path.resolve(process.cwd(), 'data', 'database.db');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔍 Diagnosing product creation issue...\n');

  // 1. Check SQLite
  console.log('📊 Checking SQLite database...');
  try {
    const db = new Database(DB_PATH);
    
    // Check if Coca-Cola exists
    const cocaCola = db.prepare('SELECT * FROM products WHERE name = ?').get('Coca-Cola');
    console.log('Coca-Cola in SQLite:', cocaCola ? 'EXISTS' : 'NOT FOUND');
    
    // Check all products
    const allProducts = db.prepare('SELECT id, name, sku, tenant_id FROM products WHERE deleted_at IS NULL').all();
    console.log(`Total products in SQLite: ${allProducts.length}`);
    allProducts.forEach(p => console.log(`  - ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}, Tenant: ${p.tenant_id}`));
    
    // Check unique constraints
    console.log('\nChecking unique constraints in SQLite...');
    const indexes = db.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name='products'").all();
    indexes.forEach(idx => console.log('  Index:', idx.sql));
    
    db.close();
  } catch (error) {
    console.error('❌ SQLite error:', error.message);
  }

  // 2. Check Supabase
  console.log('\n📊 Checking Supabase...');
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    
    // Check if Coca-Cola exists in Supabase
    const { data: cocaColaSupabase, error: cocaError } = await supabase
      .from('products')
      .select('id, name, sku, tenant_id')
      .eq('name', 'Coca-Cola')
      .maybeSingle();
    
    console.log('Coca-Cola in Supabase:', cocaError ? `ERROR: ${cocaError.message}` : (cocaColaSupabase ? 'EXISTS' : 'NOT FOUND'));
    
    // Get all products
    const { data: allSupabase, error: listError } = await supabase
      .from('products')
      .select('id, name, sku, tenant_id')
      .limit(100);
    
    if (listError) {
      console.log('Error fetching Supabase products:', listError.message);
    } else {
      console.log(`Total products in Supabase: ${allSupabase?.length || 0}`);
      allSupabase?.forEach(p => console.log(`  - ID: ${p.id}, Name: ${p.name}, SKU: ${p.sku}, Tenant: ${p.tenant_id}`));
    }
    
  } catch (error) {
    console.error('❌ Supabase error:', error.message);
  }

  // 3. Check .env configuration
  console.log('\n⚙️  Current configuration:');
  console.log('USE_SUPABASE_PRODUCTS:', process.env.USE_SUPABASE_PRODUCTS);
  console.log('ENABLE_SUPABASE_SYNC:', process.env.ENABLE_SUPABASE_SYNC);

  console.log('\n💡 Analysis:');
  console.log('If the product does NOT exist in either database but you still get "duplicate" error,');
  console.log('the issue is likely in the validation logic in src/server/routes/products.ts');
  console.log('Check lines 188-199 for name/SKU duplicate validation.');
  
  console.log('\n✅ Diagnostic complete');
}

main().catch(console.error);