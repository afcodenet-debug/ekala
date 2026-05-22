#!/usr/bin/env python3
"""
migrate_sqlite_to_supabase.py

One-time baseline migration tool.
Reads the live SQLite (data/database.db) and generates:
  - A pure SQL file with INSERT statements (supabase_data.sql)
  - Or (if you pass SUPABASE_DB_URL) directly inserts into Supabase Postgres.

Usage (generate SQL):
    python migrate_sqlite_to_supabase.py --output supabase_data.sql

Usage (direct insert - requires psycopg2):
    pip install psycopg2-binary
    SUPABASE_DB_URL="postgresql://postgres.xxx:pass@db.xxx.supabase.co:5432/postgres" \
    python migrate_sqlite_to_supabase.py --insert

After running, execute the generated .sql (or the inserts) against your Supabase project,
then run the sequence reset commands printed at the end.

This keeps exact same primary keys so the existing sync logic (sync_queue, record_id, etc.)
continues to work without remapping.
"""

import sqlite3
import sys
import os
import json
from datetime import datetime
from typing import Any, Dict, List

SQLITE_DB = "data/database.db"
OUTPUT_SQL = "supabase_data.sql"

# Columns that should be treated as boolean (0/1 in SQLite -> true/false in Postgres)
BOOL_COLUMNS = {
    "products": {"is_available"},
    "menu_categories": {"is_active"},
    "menu_items": {"is_available"},
    "users": {"is_active"},
    "restaurant_tables": set(),  # status is text
    "inventory_sessions": set(),
    # add more as you discover them from PRAGMA or your schema
}

# Columns that are JSON in Postgres (stored as TEXT/JSON string in SQLite)
JSON_COLUMNS = {
    "audit_trail": {"old_values", "new_values"},
    "sync_queue": {"data"},
    "orders": {"items"},           # legacy
}

def pg_value(val: Any, table: str, col: str) -> str:
    """Convert SQLite value to Postgres literal for INSERT."""
    if val is None:
        return "NULL"

    # Boolean conversion
    if table in BOOL_COLUMNS and col in BOOL_COLUMNS[table]:
        return "TRUE" if val else "FALSE"

    # JSON conversion
    if table in JSON_COLUMNS and col in JSON_COLUMNS[table]:
        try:
            parsed = json.loads(val) if isinstance(val, str) else val
            return f"'{json.dumps(parsed, ensure_ascii=False).replace(chr(39), chr(39)+chr(39))}'::jsonb"
        except Exception:
            # fallback as text
            safe = str(val).replace("'", "''")
            return f"'{safe}'::jsonb"

    if isinstance(val, (int, float)):
        return str(val)

    if isinstance(val, str):
        # Escape single quotes for Postgres
        safe = val.replace("'", "''")
        return f"'{safe}'"

    if isinstance(val, datetime):
        return f"'{val.isoformat()}'"

    # Fallback
    safe = str(val).replace("'", "''")
    return f"'{safe}'"


def get_tables_in_fk_order(cursor) -> List[str]:
    """Return tables in a safe insertion order (parents before children)."""
    # Hard-coded safe order based on our schema analysis (add more if FKs change)
    order = [
        "users",
        "categories",
        "suppliers",
        "restaurant_tables",
        "products",
        "menu_categories",
        "menu_items",
        "customers",
        "settings",
        "_migrations",
        "inventory_sessions",
        "orders",
        "order_items",
        "sales",
        "sale_items",
        "expenses",
        "inventory_movements",
        "stock_adjustments",
        "stock_adjustment_items",
        "purchase_orders",
        "purchase_order_items",
        "audit_trail",
        "app_logs",
        "sync_queue",
        "sync_metadata",
    ]
    # Only return tables that actually exist
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    existing = {r[0] for r in cursor.fetchall()}
    return [t for t in order if t in existing]


def generate_inserts():
    conn = sqlite3.connect(SQLITE_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    tables = get_tables_in_fk_order(cursor)

    with open(OUTPUT_SQL, "w", encoding="utf-8") as f:
        f.write("-- ============================================================================\n")
        f.write("-- SUPABASE DATA INSERTS (baseline mirror from SQLite)\n")
        f.write(f"-- Generated: {datetime.now().isoformat()}\n")
        f.write("-- Run AFTER supabase_migration.sql (schema)\n")
        f.write("-- ============================================================================\n\n")
        f.write("BEGIN;\n\n")

        for table in tables:
            cursor.execute(f"SELECT * FROM {table}")
            rows = cursor.fetchall()
            if not rows:
                f.write(f"-- {table}: 0 rows\n\n")
                continue

            cols = [col for col in rows[0].keys()]
            f.write(f"-- === {table} ({len(rows)} rows) ===\n")

            for row in rows:
                values = []
                for col in cols:
                    val = row[col]
                    values.append(pg_value(val, table, col))

                col_list = ", ".join(cols)
                val_list = ", ".join(values)
                f.write(f"INSERT INTO {table} ({col_list}) VALUES ({val_list});\n")

            f.write("\n")

        f.write("COMMIT;\n\n")
        f.write("-- After import, reset sequences so future inserts continue correctly:\n")
        for table in tables:
            f.write(f"SELECT setval('{table}_id_seq', (SELECT COALESCE(MAX(id), 0) FROM {table}));\n")

        f.write("\n-- Done. Your Supabase DB should now be an identical mirror of the SQLite baseline.\n")

    print(f"Generated {OUTPUT_SQL} with data for {len(tables)} tables.")
    conn.close()


def direct_insert(supabase_url: str):
    """Directly insert into Supabase (requires psycopg2)."""
    try:
        import psycopg2
        from psycopg2.extras import execute_batch
    except ImportError:
        print("pip install psycopg2-binary first")
        sys.exit(1)

    # ... (implementation left as exercise / can be expanded)
    print("Direct insert path not fully implemented in this template.")
    print("Use the generated supabase_data.sql instead (recommended for safety).")


if __name__ == "__main__":
    if "--insert" in sys.argv:
        url = os.environ.get("SUPABASE_DB_URL")
        if not url:
            print("Set SUPABASE_DB_URL environment variable")
            sys.exit(1)
        direct_insert(url)
    else:
        generate_inserts()
