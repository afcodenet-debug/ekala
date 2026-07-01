#!/bin/bash

# =============================================================================
# Script d'Installation Automatique - Système de Billing V1.1
# =============================================================================
# Ce script installe et configure automatiquement le système de billing
# Il vérifie les prérequis, installe PostgreSQL si nécessaire, et seed les données
# =============================================================================

set -e  # Arrêter en cas d'erreur

echo "🚀 Installation du Système de Billing V1.1"
echo "=========================================="
echo ""

# Couleurs pour les messages
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour afficher les messages
log_info() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# =============================================================================
# Étape 1: Vérifier les prérequis
# =============================================================================
echo "📋 Étape 1: Vérification des prérequis..."
echo ""

# Vérifier Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js n'est pas installé. Installez-le depuis https://nodejs.org/"
    exit 1
fi
log_info "Node.js $(node --version) détecté"

# Vérifier npm
if ! command -v npm &> /dev/null; then
    log_error "npm n'est pas installé."
    exit 1
fi
log_info "npm $(npm --version) détecté"

# =============================================================================
# Étape 2: Vérifier/Installer PostgreSQL
# =============================================================================
echo ""
echo "📦 Étape 2: Vérification de PostgreSQL..."
echo ""

# Vérifier si psql est disponible
if ! command -v psql &> /dev/null; then
    log_warn "PostgreSQL n'est pas installé ou pas dans le PATH"
    echo ""
    echo "Pour installer PostgreSQL sur macOS:"
    echo "  1. Via Homebrew (recommandé):"
    echo "     brew install postgresql@14"
    echo "     brew services start postgresql@14"
    echo ""
    echo "  2. Via Postgres.app:"
    echo "     https://postgresapp.com/"
    echo ""
    
    read -p "Voulez-vous installer PostgreSQL via Homebrew? (y/n) " -n 1 -r
    echo ""
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if ! command -v brew &> /dev/null; then
            log_error "Homebrew n'est pas installé. Installez-le depuis https://brew.sh/"
            exit 1
        fi
        
        log_info "Installation de PostgreSQL via Homebrew..."
        brew install postgresql@14
        brew services start postgresql@14
        
        # Ajouter au PATH pour cette session
        export PATH="/usr/local/opt/postgresql@14/bin:$PATH"
        
        log_info "PostgreSQL installé et démarré"
    else
        log_error "PostgreSQL est requis. Installez-le manuellement et réessayez."
        exit 1
    fi
else
    log_info "PostgreSQL détecté: $(psql --version)"
fi

# =============================================================================
# Étape 3: Configurer la base de données
# =============================================================================
echo ""
echo "🗄️  Étape 3: Configuration de la base de données..."
echo ""

# Demander les credentials
read -p "Nom d'utilisateur PostgreSQL (défaut: postgres): " DB_USER
DB_USER=${DB_USER:-postgres}

read -p "Nom de la base de données (défaut: ekala_db): " DB_NAME
DB_NAME=${DB_NAME:-ekala_db}

# Créer la base de données si elle n'existe pas
echo ""
log_info "Création de la base de données '$DB_NAME'..."
psql -U "$DB_USER" -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
log_info "Base de données '$DB_NAME' prête"

# =============================================================================
# Étape 4: Installer les dépendances npm
# =============================================================================
echo ""
echo "📚 Étape 4: Installation des dépendances..."
echo ""

log_info "Installation des packages npm..."
npm install
log_info "Dépendances installées"

# =============================================================================
# Étape 5: Exécuter la migration SQL
# =============================================================================
echo ""
echo "🔧 Étape 5: Exécution de la migration SQL..."
echo ""

log_info "Exécution de 048_subscription_voucher_system.sql..."
psql -U "$DB_USER" -d "$DB_NAME" -f backend/migrations/048_subscription_voucher_system.sql
log_info "Migration SQL exécutée avec succès"

# =============================================================================
# Étape 6: Seed des données
# =============================================================================
echo ""
echo "🌱 Étape 6: Seed des données (plans et vouchers)..."
echo ""

# Créer un script de seed temporaire qui utilise les bonnes credentials
cat > scripts/seed_with_credentials.js << EOF
const { Pool } = require('pg');

const pool = new Pool({
  user: '$DB_USER',
  host: 'localhost',
  database: '$DB_NAME',
  port: 5432,
});

async function seed() {
  const client = await pool.connect();
  
  try {
    console.log('📦 Seeding plans...');
    
    // Insérer les plans
    await client.query(\`
      INSERT INTO plans (id, name, description, price_monthly, price_yearly, duration_days, features, max_users, max_products, max_orders_per_month)
      VALUES 
        ('basic', 'Basic', 'Plan Basic - Fonctionnalités essentielles', 29, 290, 30, 
         '["1 utilisateur", "100 produits", "Support email"]'::jsonb, 1, 100, 500),
        ('pro', 'Pro', 'Plan Pro - Pour les professionnels', 99, 990, 30,
         '["10 utilisateurs", "1000 produits", "Support prioritaire", "Rapports avancés", "API access"]'::jsonb, 10, 1000, 10000),
        ('enterprise', 'Enterprise', 'Plan Enterprise - Pour les grandes entreprises', 299, 2990, 30,
         '["Utilisateurs illimités", "Produits illimités", "Support 24/7", "API access", "Custom branding", "SLA garanti"]'::jsonb, -1, -1, -1)
      ON CONFLICT (id) DO NOTHING;
    \`);
    
    console.log('✅ 3 plans créés (Basic, Pro, Enterprise)');
    
    // Générer des vouchers
    const voucherCodes = [];
    const prefixes = ['BASIC', 'PRO', 'ENTERPRISE'];
    const suffixes = ['ALPHA', 'BETA', 'GAMMA', 'DELTA', 'EPSILON'];
    
    for (const prefix of prefixes) {
      for (let i = 1; i <= 5; i++) {
        const suffix = suffixes[i - 1];
        const code = \`\${prefix}-2024-\${suffix}-\${String(i).padStart(3, '0')}\`;
        voucherCodes.push({ code, plan_id: prefix.toLowerCase() });
      }
    }
    
    // Ajouter des vouchers spéciaux
    const specialVouchers = [
      { code: 'WELCOME-2024-SPECIAL-001', plan_id: 'pro' },
      { code: 'LAUNCH-2024-PROMO-001', plan_id: 'enterprise' },
      { code: 'TRIAL-2024-BASIC-001', plan_id: 'basic' },
      { code: 'TRIAL-2024-PRO-001', plan_id: 'pro' },
      { code: 'TRIAL-2024-ENTERPRISE-001', plan_id: 'enterprise' },
      { code: 'PROMO-2024-SUMMER-001', plan_id: 'pro' },
      { code: 'PROMO-2024-WINTER-001', plan_id: 'enterprise' },
      { code: 'TEST-2024-ADMIN-001', plan_id: 'enterprise' },
    ];
    
    voucherCodes.push(...specialVouchers);
    
    console.log('📦 Création de 23 vouchers...');
    
    for (const voucher of voucherCodes) {
      await client.query(\`
        INSERT INTO vouchers (code, plan_id, is_used, expires_at)
        VALUES (\$1, \$2, false, NOW() + INTERVAL '1 year')
        ON CONFLICT (code) DO NOTHING;
      \`, [voucher.code, voucher.plan_id]);
    }
    
    console.log(\`✅ \${voucherCodes.length} vouchers créés\`);
    
    // Vérifier les données
    const planCount = await client.query('SELECT COUNT(*) FROM plans');
    const voucherCount = await client.query('SELECT COUNT(*) FROM vouchers');
    
    console.log('');
    console.log('📊 Résumé:');
    console.log(\`   - Plans: \${planCount.rows[0].count}\`);
    console.log(\`   - Vouchers: \${voucherCount.rows[0].count}\`);
    console.log('');
    console.log('✅ Seed complété avec succès!');
    
  } catch (error) {
    console.error('❌ Erreur lors du seed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
EOF

log_info "Exécution du seed..."
node scripts/seed_with_credentials.js

# Nettoyer le script temporaire
rm scripts/seed_with_credentials.js

log_info "Données seedées avec succès"

# =============================================================================
# Étape 7: Vérification finale
# =============================================================================
echo ""
echo "🔍 Étape 7: Vérification finale..."
echo ""

log_info "Vérification des tables..."
psql -U "$DB_USER" -d "$DB_NAME" -c "\d subscriptions" > /dev/null 2>&1 && log_info "Table subscriptions créée" || log_error "Table subscriptions manquante"
psql -U "$DB_USER" -d "$DB_NAME" -c "\d vouchers" > /dev/null 2>&1 && log_info "Table vouchers créée" || log_error "Table vouchers manquante"
psql -U "$DB_USER" -d "$DB_NAME" -c "\d plans" > /dev/null 2>&1 && log_info "Table plans créée" || log_error "Table plans manquante"

log_info "Vérification des données..."
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as plan_count FROM plans;" -t | grep -q 3 && log_info "3 plans présents" || log_warn "Nombre de plans incorrect"
psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT COUNT(*) as voucher_count FROM vouchers;" -t | grep -q 23 && log_info "23 vouchers présents" || log_warn "Nombre de vouchers incorrect"

# =============================================================================
# Étape 8: Instructions finales
# =============================================================================
echo ""
echo "=========================================="
echo "🎉 Installation terminée avec succès!"
echo "=========================================="
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. Démarrer le serveur backend:"
echo "   npm run dev"
echo ""
echo "2. Ouvrir le frontend (dans un autre terminal):"
echo "   npm run dev:frontend"
echo ""
echo "3. Tester l'API:"
echo "   curl http://localhost:3001/api/v1/subscription/status/16"
echo ""
echo "4. Ouvrir le navigateur:"
echo "   http://localhost:5173"
echo ""
echo "📚 Documentation:"
echo "   - docs/INTEGRATION_COMPLETE.md"
echo "   - docs/FRONTEND_INTEGRATION_COMPLETE.md"
echo "   - docs/NEXT_STEPS_EXECUTION.md"
echo ""
echo "🔧 Configuration de la base de données:"
echo "   - Host: localhost"
echo "   - Port: 5432"
echo "   - Database: $DB_NAME"
echo "   - User: $DB_USER"
echo ""
echo "✅ Le système est prêt à être utilisé!"
echo ""