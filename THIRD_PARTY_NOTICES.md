# AXOS OS — Third-Party Notices

Atribuciones de código de terceros y dependencias. Solo se permiten licencias
permisivas: MIT, Apache-2.0, BSD-2/3, ISC. Prohibido copyleft (GPL/AGPL/LGPL).

## Política

- Se prefiere reimplementar patrones a copiar/pegar.
- Si se copia un fragmento, se conserva su header de licencia y se registra aquí
  (autor + licencia + URL).
- Dependencia npm nueva → debe ser permisiva y justificarse en `DECISIONS.md`.

## Fragmentos de código de terceros copiados

_Ninguno hasta ahora._ Todo el código de esta sesión es original, escrito para
seguir las convenciones del repo.

## Dependencias npm añadidas

**Sesión CIDE:** _Ninguna._ El cliente de CIDE (`cide-provider.ts`) usa el `fetch`
nativo de Node 20+, sin SDK externo. De hecho esa sesión **retira** una
dependencia: `@anthropic-ai/sdk` (ya no se usa; CIDE no llama a Anthropic).

**PR "Workspace Industrial" (kit de UI):**

| Dependencia | Licencia | Uso | URL |
|---|---|---|---|
| `@tanstack/react-table` | MIT | Núcleo **headless** de la `DataTable` del kit (orden, filtro por columna, búsqueda, paginación, selección). Solo lógica de tabla; el estilo es propio (Tailwind + token `glass`). | https://github.com/TanStack/table |

Permisiva (MIT). Arrastra `@tanstack/table-core` (mismo proyecto, también MIT).
Justificación en `DECISIONS.md` §23.

## Modelos de IA (CIDE) — pesos descargados en runtime

CIDE corre sobre modelos **open-source** servidos por un motor self-hosted
(Ollama por defecto). Los pesos **no se incluyen en el repo**; el motor los
descarga en el deploy. Todos los modelos por defecto son permisivos:

| Modelo | Licencia | Origen |
|---|---|---|
| Qwen2.5-Instruct (7B / 14B / 32B) | Apache-2.0 | https://huggingface.co/Qwen |
| Mistral-7B-Instruct | Apache-2.0 | https://huggingface.co/mistralai |

El motor de inferencia recomendado, **Ollama** (https://ollama.com), es MIT y se
ejecuta como contenedor (`infra/cide/docker-compose.yml`); no es una dependencia
npm del monorepo.

## Integraciones retiradas en esta sesión

- **Anthropic Claude** (`@anthropic-ai/sdk`, `ANTHROPIC_API_KEY`, llaves BYO):
  eliminado a favor de CIDE self-hosted.
- **Agente DeepSeek** (GitHub Action + script Python con `openai`/`requests`
  contra la API de DeepSeek): eliminado por completo.
