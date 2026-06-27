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

## Deploying on Railway (turning CIDE on in production)

This folder ships a `Dockerfile` (+ `entrypoint.sh`, `railway.json`) so the
engine deploys as its **own Railway service** that the API reaches over the
private network. The entrypoint binds `0.0.0.0`, starts Ollama, and **pulls the
model on boot** — no manual `ollama pull` step.

1. **New service → Deploy from repo**, root `infra/cide` (it picks up
   `railway.json` / `Dockerfile`). Optionally set `CIDE_MODEL` (default
   `qwen2.5:7b`; on a CPU-only plan `qwen2.5:1.5b` answers faster).
2. **Add a volume** mounted at `/root/.ollama` so the weights survive restarts
   (without one, the model re-pulls on every cold start — correct, just slower).
3. **Point the API at it.** On the API service set:
   ```
   CIDE_BASE_URL=http://<cide-service-name>.railway.internal:11434/v1
   AI_MOCK=0
   ```
   Use the **private** `.railway.internal` host, not the public domain.
4. **Verify.** Open **/dashboard/admin/ai → "Probar conexión"**. Green
   "motor en línea" means the API reached the engine and the model is loaded.

> CPU note: `qwen2.5:7b` runs on CPU but is slow (tens of seconds/turn). For a
> responsive production experience, run the engine on a GPU host or point
> `CIDE_BASE_URL` at a GPU **vLLM**/**TGI** endpoint — the app code is identical.
> Raise `CIDE_TIMEOUT_MS` on the API if you keep CPU inference.

## Scaling to GPU / production

- On an NVIDIA host, uncomment the `deploy` block in `docker-compose.yml`
  (needs the NVIDIA Container Toolkit).
- Or run a dedicated **vLLM**/**TGI** cluster and set `CIDE_BASE_URL` to it. The
  app code is identical — the engine is just a URL.

Model weights are **pulled at deploy time** and live in the `cide-models`
Docker volume; they are never committed to git.
