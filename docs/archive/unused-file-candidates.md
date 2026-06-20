# Candidatos de archivos sin uso bajo `apps/` — AXOS OS

> **Solo lista. No se borró nada.** La eliminación requiere tu confirmación.

## Metodología

Se escanearon **803 archivos fuente** (`apps/api/src/**`, `apps/web/src/**`),
excluyendo entrypoints por convención de framework (Next.js `page/layout/route`,
`middleware.ts`; NestJS `*.module/*.controller/*.service` cableados por metadata;
entidades; `seed*`; scripts), specs/tests, `*.d.ts`, configs, migraciones y barrels.

Para cada candidato se extrajeron sus **símbolos exportados** y se buscó cualquier
referencia (`import`/`export from`/`require`/uso del símbolo o del basename) en todo
el repo. Un archivo se marca **sin uso** solo si tiene **0 referencias** fuera de sí
mismo. Resultado verificado dos veces (agente + grep manual de confirmación).

> Nota: **no** se probó borrándolos (los rieles prohíben borrar sin tu OK). Pero al
> tener **0 importadores**, retirarlos **no puede** romper la compilación de otros
> módulos — nada los referencia. Tampoco están registrados como filtros/interceptores
> globales ni en metadata de módulos (el grep de su símbolo da 0).

## Candidatos (5)

### Backend — `apps/api/src` (3)

| Archivo | Qué es | Exporta | Evidencia |
| --- | --- | --- | --- |
| `common/filters/http-exception.filter.ts` | `ExceptionFilter` global de Nest (nunca registrado) | `HttpExceptionFilter` | 0 referencias al símbolo y al path |
| `common/interceptors/response.interceptor.ts` | `NestInterceptor` que envuelve respuestas (nunca registrado) | `ResponseInterceptor` | 0 referencias al símbolo y al path |
| `modules/ncr/dto/ncr.dto.ts` | DTOs de validación para NCR | `CreateNcrDto`, `UpdateNcrStatusDto` | 0 referencias; `NcrController` usa `any` en vez de estos DTOs |

### Frontend — `apps/web/src` (2)

| Archivo | Qué es | Exporta | Evidencia |
| --- | --- | --- | --- |
| `components/TCodePalette.tsx` | Command palette (búsqueda por TCode) | `TCodePalette` | 0 referencias al símbolo |
| `app/dashboard/production/production.utils.ts` | Helpers de WO/OEE co-localizados (no es entrypoint de ruta) | `groupWorkOrdersByStatus`, `getWorkOrderProgress`, `calculateOee`, `workOrderStatuses`, `moveWorkOrder` | 0 referencias a símbolos ni al path |

## Notas / decisión tuya

- Los dos de `common/` (filter + interceptor) parecen **scaffolding de Nest que nunca
  se cableó** (`useGlobalFilters`/`APP_FILTER` no los usan). Candidatos claros.
- `ncr.dto.ts`: el controller de NCR quedó con `any`. Borrarlo es seguro hoy; lo
  *correcto a futuro* podría ser **usar** estos DTOs en el controller en vez de
  borrarlos (mejora de type-safety). Es tu decisión.
- `production.utils.ts` y `TCodePalette.tsx`: features que quedaron desconectadas.

**Total: 5 de 803 archivos (0.62%).** Ninguno fue borrado.
