-- Backfill de tenant_id (equivalente SQL del script Node backfill-tenant.js).
--
-- Para correr SIN setup local: pégalo en Railway → servicio Postgres →
-- pestaña "Database" (query) o "Console" (psql). Corre dentro de la red de
-- Railway, así que no hay bloqueo de firewall.
--
-- Es dinámico: recorre TODAS las tablas de `public` que tengan columna
-- `tenant_id` (o `tenantId`) y rellena las filas en NULL. Idempotente.
-- Cambia 'default' por tu id de tenant si quieres otro nombre.

-- ──────────────────────────────────────────────────────────────────────────
-- PASO 1 · DRY-RUN — solo cuenta cuántas filas tocaría (NO cambia nada).
-- Devuelve una tabla: table_name | column_name | null_rows
-- ──────────────────────────────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  (xpath(
    '/row/cnt/text()',
    query_to_xml(
      format('SELECT COUNT(*) AS cnt FROM public.%I WHERE %I IS NULL',
             table_name, column_name),
      false, true, ''
    )
  ))[1]::text::bigint AS null_rows
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('tenant_id', 'tenantId')
ORDER BY null_rows DESC NULLS LAST, table_name;

-- ──────────────────────────────────────────────────────────────────────────
-- PASO 2 · APLICAR — rellena las filas NULL con 'default'.
-- (Corre esto solo cuando el dry-run se vea bien.)
-- ──────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r       RECORD;
  n       BIGINT;
  total   BIGINT := 0;
  tenant  TEXT   := 'default';   -- ← cámbialo si quieres otro id de tenant
BEGIN
  FOR r IN
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND column_name IN ('tenant_id', 'tenantId')
    ORDER BY table_name, column_name
  LOOP
    EXECUTE format('UPDATE public.%I SET %I = %L WHERE %I IS NULL',
                   r.table_name, r.column_name, tenant, r.column_name);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE '% . % : % fila(s) -> %', r.table_name, r.column_name, n, tenant;
      total := total + n;
    END IF;
  END LOOP;
  RAISE NOTICE 'LISTO. Total filas actualizadas: %', total;
END $$;

-- ──────────────────────────────────────────────────────────────────────────
-- PASO 3 · VERIFICAR — vuelve a correr el SELECT del PASO 1.
-- Debe devolver 0 en null_rows para todas las tablas.
-- ──────────────────────────────────────────────────────────────────────────
