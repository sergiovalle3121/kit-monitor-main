# Deuda Técnica — marcadores en código (TODO / FIXME / HACK)

> **Propósito:** visibilidad, no arreglo masivo. Este documento inventaría los
> marcadores de deuda **reales** en `apps/*/src` (excluyendo specs) para que la
> revisión de IT tenga una vista honesta de lo diferido y su razón.
>
> **Metodología:** un grep crudo de `TODO|FIXME|HACK|XXX` arroja ~20 archivos,
> pero **la enorme mayoría son la palabra española "TODO"** ("valida TODO el
> catálogo", "TODOS los usuarios") o placeholders de UI/XML (`SN-0000-XXXX`,
> `Moneda="XXX"` — código ISO-4217 válido), **no marcadores de deuda.** Filtrando
> a marcadores reales (comentarios `// TODO:` / `FIXME` / `HACK`), quedan **6**.
>
> **Decisión de alcance:** los 6 tocan *scope/tenancy* o *integración SAP*
> (lógica de negocio / seguridad) → por la regla de esta limpieza (higiene, no
> refactor; no tocar auth/tenancy/lógica) **se documentan pero NO se resuelven**
> aquí. No hay marcadores "triviales y seguros" que resolver sin entrar en
> lógica.

_Última actualización: 2026-07-01._

## Marcadores reales

| # | Archivo:línea | Qué dice | Categoría | Por qué se difiere |
| - | --- | --- | --- | --- |
| 1 | `apps/api/src/modules/kits/kits.service.ts:132` | `// TODO: Verify organizational scope if user is provided` | Tenancy / scope | En `findOne` de kit; añadir verificación de scope organizacional es lógica de autorización (tenancy). Fuera de alcance de higiene. |
| 2 | `apps/api/src/modules/production-runtime/production-runtime.service.ts:77` | `// TODO: Verify scope` | Tenancy / scope | Verificación de scope pendiente en runtime de producción. Lógica de autorización. |
| 3 | `apps/api/src/modules/production-runtime/production-runtime.service.ts:403` | `// TODO: Verify scope` | Tenancy / scope | Igual que #2, otra ruta del mismo servicio. |
| 4 | `apps/api/src/modules/production-runtime/production-runtime.service.ts:457` | `// TODO: Verify scope` | Tenancy / scope | Igual que #2, otra ruta del mismo servicio. |
| 5 | `apps/api/src/modules/inventory/warehouse.service.ts:510` | `TODO (integración SAP — fuera de alcance de este PR): una futura importación de pull-lists por archivo/API entraría por aquí…` | Integración SAP | Ya marcado en código como interfaz futura; NO integra SAP. Requiere trabajo de integración, no higiene. |
| 6 | `apps/api/src/modules/people/people.service.ts:300` | `Se deja como TODO del owner — NO se activa en este PR (additivo y seguro).` (gate de certificación `ENFORCE_CERT_GATE`, comentado) | Feature-flag / decisión del owner | Diferido deliberadamente por el owner; activar el gate de certificación es una decisión de negocio + auth. Documentado, no tocado. |

## No son deuda (falsos positivos frecuentes)

Para que futuras auditorías no los cuenten como deuda:

- La palabra española **"TODO"/"TODOS"** en comentarios y strings (p. ej.
  `seed-demo.ts`, `public-domain-guard.ts`, `dashboardAreas.ts`,
  `layout.tsx`, `DataTable.tsx`): significa "all/everything", no un marcador.
- `apps/api/src/modules/outbound/carta-porte-xml.ts:54` → `Moneda="XXX"`:
  código ISO-4217 "sin moneda" en una plantilla XML del SAT, no un marcador.
- `apps/web/src/app/dashboard/maintenance/maintenance.assets.tsx:573` →
  `placeholder="SN-0000-XXXX"`: patrón de UI (número de serie), no un marcador.

## Pre-existentes: errores de `tsc --noEmit` en specs (no bloquean CI)

`npm run typecheck` en el API (`tsc --noEmit -p tsconfig.json`) reporta **7
errores de tipo, todos en archivos `.spec.ts`** (código de prueba). Son
**pre-existentes** (independientes de esta limpieza: este PR no toca código del
API) y **CI no los detecta** porque el pipeline corre `nest build` + `jest`
(ambos verdes: 166 suites / 1173 tests pasan), no `tsc --noEmit` sobre specs.
Se **anotan, no se ocultan** (regla de higiene: no maquillar specs pre-fallando).

| Archivo:línea | Error |
| --- | --- |
| `apps/api/src/modules/erp-core/services/erp-pp.service.spec.ts:23` | TS2344: `Type 'T' does not satisfy the constraint 'ObjectLiteral'` |
| `apps/api/src/modules/event-ledger/event-ledger.service.spec.ts:32` | TS2769: `No overload matches this call` |
| `apps/api/src/modules/event-ledger/event-ledger.service.spec.ts:54` | TS2339: `Property 'id' does not exist on type 'LedgerEvent[]'` |
| `apps/api/src/modules/event-ledger/event-ledger.service.spec.ts:56` | TS2339: `Property 'id' does not exist on type 'LedgerEvent[]'` |
| `apps/api/src/modules/production-runtime/production-runtime-consume.spec.ts:108` | TS2493: `Tuple type '[]' of length '0' has no element at index '0'` |
| `apps/api/src/modules/production-runtime/production-runtime-consume.spec.ts:118` | TS18048: `'tx' is possibly 'undefined'` |
| `apps/api/src/modules/production-runtime/production-runtime-consume.spec.ts:120` | TS18048: `'tx' is possibly 'undefined'` |

**Plan sugerido:** corregir los tipos de esos specs en un PR separado y, si se
quiere, añadir `tsc --noEmit` como paso de CI. Fuera de alcance de higiene
(tocar lógica/tests de dominio: event-ledger, production-runtime).

## Cómo regenerar este inventario

```bash
# Marcadores reales (excluye la palabra española "TODO"):
grep -rnE '(//|/\*|\*)\s*(TODO|FIXME|HACK|XXX)\b|(TODO|FIXME|HACK|XXX):' \
  apps/*/src --include='*.ts' --include='*.tsx' | grep -v '\.spec\.'
```
