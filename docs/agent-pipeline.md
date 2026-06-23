# Pipeline de agentes 24/7 — AXOS OS

Bucle autónomo que va vaciando un backlog de tareas pequeñas: un worker
programado toma issues etiquetados `agent-task`, los implementa siguiendo las
reglas duras de [`CLAUDE.md`](../CLAUDE.md) y abre **PRs draft contra `staging`**.
**Nunca mergea**: un humano revisa y mergea. Todo es **aditivo** y `main` nunca se
toca de forma automática.

---

## Piezas

| Archivo | Qué hace |
|---|---|
| [`CLAUDE.md`](../CLAUDE.md) | Reglas duras que TODO agente sigue cada corrida (aditivo, base `staging`, zonas prohibidas, reuso, citar paths reales). |
| [`.github/workflows/agent-worker.yml`](../.github/workflows/agent-worker.yml) | Worker programado (cron cada 4 h + `workflow_dispatch`). Máximo **un** agente a la vez. |
| [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | CI existente (build · test · lint · smoke). **Extendido** para correr también en PRs/push a `staging`. |
| [`.github/CODEOWNERS`](../.github/CODEOWNERS) | Exige review de `@Sergiovalle3121` en migraciones, tenant, auth, security, `owner.ts` y `/.github/`. |
| [`.github/ISSUE_TEMPLATE/agent-task.md`](../.github/ISSUE_TEMPLATE/agent-task.md) | Plantilla del backlog (objetivo, paths reales, criterio aditivo, Done, qué NO tocar). |

## El bucle, paso a paso

1. **Disparo**: `schedule` (cron `0 */4 * * *`, cada 4 h) o `workflow_dispatch` manual.
2. **Serialización**: `concurrency: { group: axos-agent-worker, cancel-in-progress: false }`
   ⇒ como mucho **un** agente a la vez; una corrida nueva espera a que termine la
   anterior. Esto evita divergencia por dos agentes tocando `staging` en paralelo.
3. **Checkout** de `staging` con `fetch-depth: 0` + `npm ci`.
4. **Selección**: el agente toma con `gh` el issue `agent-task` abierto **más
   antiguo** que no tenga ya `agent-in-progress`. Si no hay ninguno, termina sin hacer nada.
5. **Reclamo**: etiqueta ese issue con `agent-in-progress` (lock simple).
6. **Implementación**: rama nueva desde `staging`, cambios **aditivos**, reusando
   primitivos (`components/ui`, `components/workspace`) y respetando `seesAllAreas`.
7. **Puertas**: `npm run build` y `npm run lint`. Si fallan, comenta el error,
   libera `agent-in-progress` y termina (sin PR).
8. **PR draft**: si pasan, abre `gh pr create --draft --base staging`, vincula el
   issue (`Closes #N`) y etiqueta el PR `agent-pr`. **No mergea.**
9. **Gate humano**: tú revisas. CI corre en el PR (ver nota ⚠️ abajo); CODEOWNERS
   exige tu review en zonas críticas. Mergeas tú, con squash, cuando esté verde.

## Diseño de seguridad

- **Aditivo siempre** + **base `staging`, nunca `main`** + **nunca auto-merge** (CLAUDE.md §1–2).
- **Un agente a la vez** (concurrency).
- **PRs draft + chicos** (un issue por PR), revisables.
- **CODEOWNERS** fuerza tu review en migraciones / tenant / auth / security / `owner.ts` / `.github/`.
- **Permisos mínimos** del token del worker: `contents`, `pull-requests`, `issues` (write).
- 🔒 **Sin debug logging.** El repo es **público** ⇒ los logs de Actions son
  visibles. El worker **no** habilita `ACTIONS_STEP_DEBUG` / `ACTIONS_RUNNER_DEBUG`
  ni flags `--verbose` / `show_full_output`. **No los actives.**

> ⚠️ **Gotcha de CI en PRs del worker.** Un PR creado con el `GITHUB_TOKEN` por
> defecto **no dispara** otros workflows (protección anti-recursión de GitHub), así
> que `ci.yml` podría **no** correr automáticamente en el PR del agente. Opciones:
> (a) al revisar, marca el draft como "Ready for review" / cierra-reabre / push de
> un commit vacío para forzar CI; o (b) configura un PAT dedicado
> (`secrets.AGENT_GITHUB_TOKEN`) y úsalo para `gh pr create` en el worker, con lo
> que CI sí se dispara. La branch protection igual **bloquea el merge** mientras el
> check requerido no esté verde, así que nunca se cuela sin gate.

---

# ✋ PASOS MANUALES (solo el admin/owner puede hacerlos)

Yo (el agente) **no** puedo hacer estos pasos. Hazlos en este orden. **No actives
el worker hasta completar el #4.**

- [ ] **1. Instalar la GitHub App de Claude.** En el repo, corre
  `/install-github-app` desde Claude Code, o instala
  <https://github.com/apps/claude> sobre `Sergiovalle3121/axos-os` y dale permisos
  **Contents (R/W)**, **Issues (R/W)** y **Pull requests (R/W)**.

- [ ] **2. Secret `ANTHROPIC_API_KEY`.** Settings → Secrets and variables →
  Actions → New repository secret → nombre `ANTHROPIC_API_KEY`, valor = tu API key
  de Anthropic. (El worker lo lee como `secrets.ANTHROPIC_API_KEY`.)

- [ ] **3. Crear los labels** `agent-task`, `agent-in-progress`, `agent-pr`.
  No pude crearlos por API (el MCP solo lee labels). El worker los auto-crea en su
  primer run, pero para empezar a etiquetar issues ya, córrelos tú (idempotente):
  ```bash
  gh label create agent-task        -R Sergiovalle3121/axos-os --color 1D76DB --description "Tarea del backlog lista para el worker autónomo"
  gh label create agent-in-progress -R Sergiovalle3121/axos-os --color FBCA04 --description "Tomada por el worker (en curso)"
  gh label create agent-pr          -R Sergiovalle3121/axos-os --color 0E8A16 --description "PR abierto por el worker autónomo"
  ```

- [ ] **4. Branch protection (BLOQUEANTE — hazlo ANTES de activar el worker).**
  Settings → Branches → Add rule, para **`main`** y para **`staging`**:
  - ✅ Require a pull request before merging — **prohíbe push directo**.
  - ✅ Require status checks to pass before merging → marca como **required** el
    check de CI: **`Build · Test · Lint · Smoke`** (workflow "CI").
  - ✅ Require branches to be up to date before merging.
  - ✅ Require review from Code Owners (activa el bloqueo de `CODEOWNERS`).
  - En **`main`** además: ✅ Require approvals (≥1) y, idealmente, ✅ Include
    administrators. (En `staging` el review humano lo aporta CODEOWNERS + tu merge.)

  > ⚠️ Si activas el worker **sin** branch protection, un PR del agente podría
  > mergearse sin gate. **Primero protege, luego activa.**

- [ ] **5. Activar el worker.** Ya está como `workflow_dispatch` + cron cada 4 h.
  Para una primera prueba controlada: Actions → "Agent Worker (24/7)" → Run
  workflow (con al menos un issue `agent-task` abierto). El cron corre solo una vez
  hecho el merge de este PR a `staging` y, más adelante, a `main`.

- [ ] **6. (Opcional) PAT para CI en PRs del worker.** Si quieres que CI corra
  automáticamente en los PRs del agente, crea un PAT con scope `repo`, guárdalo como
  secret `AGENT_GITHUB_TOKEN` y cámbialo en `agent-worker.yml` (ver gotcha ⚠️ arriba).

## Cómo cargar el backlog

Abre issues con la plantilla **"Agent task (backlog 24/7)"** (New issue → elige la
plantilla). Ya trae el label `agent-task`. Llena objetivo, paths reales, criterio
aditivo, Done y "qué NO tocar". El worker los procesa **del más antiguo al más nuevo**.
