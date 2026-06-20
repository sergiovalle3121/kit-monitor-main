# RUNBOOK — Sembrar el DEMO en producción (Railway · servicio `vigilant-unity`)

> Validado en un dry-run LOCAL contra Postgres 16 (espejo del smoke de CI).
> Modo **SEGURO**: `synchronize=true`, `migrationsRun=false` (las migraciones de
> timestamp duplicado **NO** corren). NO setear `SYNCHRONIZE=false`.

---

## 0) PRE-VUELO (obligatorio, en la consola de `vigilant-unity`)

1. **Confirmar el modo seguro de migraciones.** En *Variables* del servicio:
   - `SYNCHRONIZE` debe estar **AUSENTE** o `=true`.  ❌ Si está en `false`, ABORTA:
     en ese modo `migrationsRun=true` y correrían las 8 parejas de migración con
     timestamp duplicado (20260616000000, etc.) → riesgo real. No sigas.
   - `MIGRATIONS_RUN` no necesita tocarse (con `synchronize=true` queda `false` igual).

2. **Confirmar que prod no tiene ya el demo.** `cd apps/api` y corre el verify:
   ```bash
   cd apps/api && node dist/seed/seed-verify.js
   ```
   - Esperado en una base SIN demo: muchas líneas ❌ ("no encontrado") y **exit 1**.
     Eso CONFIRMA que el demo no está sembrado todavía. (El verify chequea el
     golden path, no "vacío": rojo = aún no hay demo = adelante.)
   - Si saliera **verde / exit 0**, el demo YA está → no hace falta resembrar
     (de todos modos el seed es idempotente).

   Sonda alterna de "vacío" (opcional), por si quieres números crudos:
   ```bash
   node -e "const{Client}=require('pg');const c=new Client({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}});c.connect().then(async()=>{for(const t of ['material_master','pm_product_models','bom_headers'])console.log(t,(await c.query('select count(*) from '+t)).rows[0].count);await c.end();})"
   ```

---

## 1) SEMBRAR (comando exacto)

`DATABASE_URL` y `NODE_ENV=production` ya los inyecta Railway. Solo agregas
`ALLOW_SEED_DEMO=true` (salta el guard anti-prod) y **NO** pones `SYNCHRONIZE`.

```bash
cd apps/api
ALLOW_SEED_DEMO=true node dist/seed/seed-demo.js
```

- Usa `dist/` compilado (no requiere `ts-node` ni `src/`). Garantizado presente:
  es el mismo build que `node dist/main.js` arranca en prod.
- Salida esperada (exit 0): `creados=` con los conteos y al final
  `Candado dominio público (post-seed): base limpia ✔` + `✅ Seed DEMO completado`.
- Es **idempotente**: si lo corres dos veces, la 2ª dice `creados=0 / ya existían=…`.

### Si truena el escaneo post-seed
El seed escanea TODA la base al final y lanza `🚫 DATOS PROHIBIDOS` si encuentra
nombres de empresa real / prefijos tipo `OP-` (datos NO-demo preexistentes). Los
datos demo YA quedaron insertados; solo se saltó el resumen. Si prod tuviera datos
reales y quieres ignorar ese escaneo:
```bash
ALLOW_SEED_DEMO=true SKIP_PUBLIC_DOMAIN_ASSERT=true node dist/seed/seed-demo.js
```

---

## 2) VERIFICAR (post-seed)

```bash
cd apps/api
node dist/seed/seed-demo.js >/dev/null 2>&1; node dist/seed/seed-verify.js
```
o directo:
```bash
node dist/seed/seed-verify.js
```
- Esperado: `✅ GOLDEN PATH OK — 28 verificaciones pasaron.` y **exit 0**
  (8 modelos ACTIVE, 8 BOMs ACTIVE, 4 planes publicados con kit explotado,
  inventario valuado > 0).

---

## 3) ROLLBACK (si algo sale mal)

Borra SOLO lo marcado como demo (identidad determinística: modelos `AX-*`, partes
del catálogo, almacenes `AX-WH-*`, órdenes `AX-WO-*`, correos `@axos.example`).
No toca datos reales. No está bloqueado por entorno (por diseño).

```bash
cd apps/api
node dist/seed/seed-demo-clear.js
```
- Esperado: lista `✔ tabla: N eliminadas`, `Total eliminado: … filas demo`,
  `✅ Limpieza DEMO completada`, **exit 0**.

---

## Apéndice — qué inserta (medido en el dry-run, base limpia → 707 filas)

| Tabla                  | Filas | Nota |
|------------------------|------:|------|
| material_master        |    96 | 91 partes hoja + 5 sub-ensambles (el resumen del script dice 91) |
| enterprise_warehouses  |     3 | AX-WH-* |
| enterprise_customers   |     4 | sub-marcas Axos |
| enterprise_programs    |     4 | |
| suppliers              |    12 | |
| erp_supplier_prices    |   113 | upsert idempotente (estable en re-corridas) |
| pm_product_models      |     8 | AX-DRIVE/POWER/SENSE/COMM/MOTOR/GATE/METER/NODE |
| bom_headers            |    13 | 8 modelos + 5 sub-ensambles |
| bom_components         |   129 | líneas de BOM |
| plans                  |     8 | 4 publicados (kit explotado) |
| kits / kit_materials   | 4 / 52| explosión BOM × cantidad del plan |
| inventory_movements    |   146 | 91 recepciones + 52 consumos + 3 holds QA |
| inventory_positions    |    94 | |
| sf_work_orders         |    10 | piso: RELEASED/STAGED/IN_EXECUTION/COMPLETED |
| sf_quality_holds       |     2 | |
| sf_downtime_events     |     5 | |
| users (@axos.example)  |     4 | contraseña demo: `AxosDemo#2025` |
| **Ruteos / routings**  | **0** | el seed NO crea ruteos |

Valuación de inventario sembrada: **$120,495.04 USD**.
