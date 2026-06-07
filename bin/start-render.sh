#!/bin/bash
set -euo pipefail

# =============================================================================
# Render start script for the public QR Menu service (ekala-api)
# Uses Litestream to restore a near-real-time replica of the main SQLite DB.
#
# This is the RECOMMENDED setup for the public menu on Render while the
# primary write path (table creation, qr_token generation) remains in the
# local SQLite of the main POS application.
#
# When you are ready to move restaurant_tables + products + categories to
# Supabase as the single source of truth, simply flip the two env vars on
# this Render service and the menu route will switch automatically.
# =============================================================================

DATA_DIR="${DATA_DIR:-data}"
DB_PATH="${DATA_DIR}/database.db"
LITESTREAM_VERSION="${LITESTREAM_VERSION:-0.3.13}"
LITESTREAM_BIN="/tmp/litestream"

echo "[Render] Public QR Menu service starting..."
echo "[Render] DATA_DIR=$DATA_DIR"
echo "[Render] DB_PATH=$DB_PATH"
echo "[Render] USE_SUPABASE_TABLES=${USE_SUPABASE_TABLES:-false}"
echo "[Render] USE_SUPABASE_PRODUCTS=${USE_SUPABASE_PRODUCTS:-false}"

# --- Ensure data directory exists -------------------------------------------
mkdir -p "$DATA_DIR"

# --- Download Litestream binary (cached in /tmp across deploys) -------------
if [[ ! -f "$LITESTREAM_BIN" ]]; then
  echo "[Litestream] Downloading v${LITESTREAM_VERSION}..."
  curl -sSL "https://github.com/benbjohnson/litestream/releases/download/v${LITESTREAM_VERSION}/litestream-v${LITESTREAM_VERSION}-linux-amd64.tar.gz" \
    | tar -xz -C /tmp litestream
  chmod +x "$LITESTREAM_BIN"
  echo "[Litestream] Binary ready"
fi

# --- Restore the latest replica if one exists --------------------------------
# The replica URL is passed via LITESTREAM_REPLICA_URL (s3://bucket/path or r2://...)
if [[ -n "${LITESTREAM_REPLICA_URL:-}" ]]; then
  echo "[Litestream] Restoring from ${LITESTREAM_REPLICA_URL} ..."
  "$LITESTREAM_BIN" restore \
    -if-replica-exists \
    -v \
    -o "$DB_PATH" \
    "$LITESTREAM_REPLICA_URL" || true
  echo "[Litestream] Restore complete (or no replica yet)"
else
  echo "[Litestream] LITESTREAM_REPLICA_URL not set – starting with empty/local DB (dev mode)"
fi

# --- Start the Express server -------------------------------------------------
echo "[Render] Starting Node server..."
exec node dist/server/server/server.js
