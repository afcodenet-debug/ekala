- [ ] Monter les routes manquantes dans src/server/server.ts (tables, products, orders, expenses, dashboard)
- [ ] Vérifier que /api/menu reste inchangé
- [ ] Relancer l’app et confirmer que les endpoints /api/tables, /api/products, /api/orders/active, /api/orders, /api/expenses, /api/dashboard/summary retournent 200 (pas 404)

## Supabase orders sequence (CRITICAL - QR menu)
The hybrid SQLite + Supabase + sync setup frequently desynchronizes the `orders.id` sequence.
This causes "duplicate key violates orders_pkey" on public QR orders.

**One-time setup (run in Supabase SQL Editor):**
```sql
CREATE OR REPLACE FUNCTION public.advance_orders_sequence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM setval(
    pg_get_serial_sequence('public.orders', 'id'),
    COALESCE((SELECT MAX(id) FROM public.orders), 0) + 1,
    false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.advance_orders_sequence() TO service_role;
```

After running the above once, the QR checkout will automatically keep the sequence healthy on every customer order.

If the function does not exist yet, the first orders may still fail — run the SQL, then test the QR flow again.
