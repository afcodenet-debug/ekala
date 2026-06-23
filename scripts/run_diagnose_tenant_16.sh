#!/bin/bash

# Diagnostic du Tenant #16
# Ce script vérifie les données réelles et détermine le statut d'abonnement

echo "═══════════════════════════════════════════════════════════════"
echo "  DIAGNOSTIC TENANT #16 — Page /billing"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Vérifier si Node.js est installé
if ! command -v node &> /dev/null; then
    echo "❌ Node.js n'est pas installé"
    exit 1
fi

# Vérifier si better-sqlite3 est installé
if ! node -e "require('better-sqlite3')" 2>/dev/null; then
    echo "⚠️  better-sqlite3 n'est pas installé"
    echo "   Installation en cours..."
    npm install better-sqlite3 --save-dev
fi

# Exécuter le diagnostic
echo "🔍 Lancement du diagnostic..."
echo ""

node scripts/diagnose_tenant_16.js

exit_code=$?

if [ $exit_code -eq 0 ]; then
    echo ""
    echo "✅ Diagnostic terminé avec succès"
else
    echo ""
    echo "❌ Erreur lors du diagnostic (code: $exit_code)"
fi

exit $exit_code

</parameter>
</parameter>
</parameter>
</write_to_file>