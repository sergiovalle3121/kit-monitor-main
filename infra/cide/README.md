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

## GPU tier — vLLM (production-grade, fast)

CPU Ollama works, but for snappy production answers run the engine on a GPU with
**vLLM**. It serves the **same OpenAI-compatible API**, so switching is a pure
`CIDE_BASE_URL` swap — **zero app code change**. Ships ready in
[`docker-compose.gpu.yml`](./docker-compose.gpu.yml).

**The drop-in trick:** `--served-model-name` aliases the HuggingFace weights to
the same tag the catalog uses (`qwen2.5:7b`), so the backend keeps sending the
same model id. Prefer to serve a raw HF id (e.g. `Qwen/Qwen2.5-14B-Instruct`)?
Register it on the API with `CIDE_EXTRA_MODELS` (see below) — still no code change.

On an **NVIDIA GPU host** (with the NVIDIA Container Toolkit):

```bash
# pick the weights + how it's exposed (defaults: 7B aliased to qwen2.5:7b)
export CIDE_HF_MODEL=Qwen/Qwen2.5-14B-Instruct   # HF weights to load
export CIDE_MODEL=qwen2.5:14b                     # tag the API will request
docker compose -f infra/cide/docker-compose.gpu.yml up -d
curl http://localhost:8000/v1/models             # verify it's serving
```

Then point the API at it and pick the model in the admin panel:

```
CIDE_BASE_URL=http://<gpu-host>:8000/v1
AI_MOCK=0
# CIDE_API_KEY=...        # only if you enabled --api-key in the compose file
```

Managed GPU hosts (no Docker host of your own):

- **RunPod / Lambda / Vast.ai:** deploy the `vllm/vllm-openai:latest` image (or
  a "vLLM" template), pass the same args as the compose `command:`, expose
  `:8000`, and set `CIDE_BASE_URL` to the pod's public/HTTP endpoint + `/v1`.
- **Always set `--api-key`** when the endpoint is publicly reachable, and mirror
  it in `CIDE_API_KEY` on the API.

VRAM rule of thumb (bf16, single GPU): 7B ≈ 16GB, 14B ≈ 28GB, 32B ≈ 64GB. Tight
on VRAM → add `--quantization awq` (with an `-AWQ` checkpoint) or lower
`--max-model-len`; for 32B+ across GPUs add `--tensor-parallel-size N`.

### Registering an arbitrary served model (any engine)

If your engine exposes a model id that isn't in the built-in catalog, register
it on the **API** service (comma-separated) — it then appears in the admin model
picker and passes validation, no code change:

```
CIDE_EXTRA_MODELS=Qwen/Qwen2.5-14B-Instruct,Qwen/Qwen2.5-72B-Instruct
CIDE_DEFAULT_MODEL=Qwen/Qwen2.5-14B-Instruct
```

> Keep registered models **permissively licensed** (Apache-2.0 / MIT / BSD) per
> `THIRD_PARTY_NOTICES.md`. Note Qwen2.5-3B and -72B use the Qwen license, not
> Apache-2.0 — clear it before relying on them.

## Scaling notes

- On an NVIDIA host you can also uncomment the `deploy` block in the CPU
  `docker-compose.yml` to give Ollama the GPU, but **vLLM is the recommended
  GPU path** (higher throughput, better batching).
- The engine is just a URL: dev on CPU Ollama, scale to a vLLM/TGI cluster in
  prod by changing `CIDE_BASE_URL`.

Model weights are **pulled at deploy time** (into the `cide-models` Ollama volume
or the `cide-hf-cache` vLLM volume); they are never committed to git.
