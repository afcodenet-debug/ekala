/**
 * scripts/fix_null_product_names.js
 *
 * Backfill script: fixes products with NULL or empty name in Supabase.
 *
 * These invalid records cause sync errors ("null value in column 'name'")
 * when the GenericSyncService attempts to push them to Supabase.
 *
 * Usage:
 *   node scripts/fix_null_product_names.js
 *
 * Environment variables (required):
 *   SUPABASE_URL         - Your Supabase project URL
 *   SUPABASE_ANON_KEY    - Your Supabase anonymous (service) key
 */

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  // 1. Find products with NULL or empty name
  const { data: products, error: fetchError } = await supabase
    .from('products')
    .select('id, name')
    .or('name.is.null,name.eq.');

  if (fetchError) {
    console.error('❌ Error fetching products:', fetchError.message);
    process.exit(1);
  }

  if (!products || products.length === 0) {
    console.log('✅ No products with null/empty names found. Nothing to fix.');
    return;
  }

  console.log(`🔍 Found ${products.length} product(s) with null/empty names.`);

  // 2. Fix each product
  let fixed = 0;
  for (const product of products) {
    const newName = `Produit ${product.id}`;
    const { error: updateError } = await supabase
      .from('products')
      .update({ name: newName })
      .eq('id', product.id);

    if (updateError) {
      console.error(`❌ Failed to fix product #${product.id}:`, updateError.message);
    } else {
      console.log(`✅ Fixed product #${product.id} → "${newName}"`);
      fixed++;
    }
  }

  console.log(`\n✅ ${fixed}/${products.length} products fixed.`);
}

main().catch((err) => {
  console.error('❌ Unexpected error:', err);
  process.exit(1);
});
