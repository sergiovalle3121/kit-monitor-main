# CIDE engine (self-hosted inference)

This folder runs **CIDE**'s brain: a self-hosted, **OpenAI-compatible** inference
server that Axos OS talks to. No external AI vendor is involved — prompts and
business data stay on your infrastructure.

## Quick start

```bash
# from the repo root
docker compose -f infra/cide/docker-compose.yml up -d      # start Ollama
docker exec -it cide-ollama ollama pull qwen2.5:7b          # pull the model once
```

Point the API at it (defaults already match a local Ollama):

```bash
CIDE_BASE_URL=http://localhost:11434/v1
# CIDE_API_KEY=        # only if your engine requires a bearer token
```

Verify the engine is up:

```bash
curl http://localhost:11434/v1/models
```

## Models (all Apache-2.0)

| Tag | Hardware | Notes |
|---|---|---|
| `qwen2.5:7b` (default) | CPU or small GPU | Strong tool-use + Spanish |
| `qwen2.5:14b` | GPU | Stronger reasoning |
| `qwen2.5:32b` | GPU | Escalation tier |
| `mistral:7b` | CPU/GPU | Lightweight alternative |

Switch the active model in **/dashboard/admin/ai** (admin only).

## Scaling to GPU / production

- On an NVIDIA host, uncomment the `deploy` block in `docker-compose.yml`
  (needs the NVIDIA Container Toolkit).
- Or run a dedicated **vLLM**/**TGI** cluster and set `CIDE_BASE_URL` to it. The
  app code is identical — the engine is just a URL.

Model weights are **pulled at deploy time** and live in the `cide-models`
Docker volume; they are never committed to git.
