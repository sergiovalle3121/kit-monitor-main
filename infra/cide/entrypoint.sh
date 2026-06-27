#!/usr/bin/env sh
# CIDE engine entrypoint — starts Ollama and ensures the model is present.
#
# Ollama's OpenAI-compatible chat endpoint does NOT auto-pull a model: a request
# for a tag that was never pulled returns 404. So on boot we start the server,
# wait until it answers, pull the configured model (idempotent — a no-op if the
# weights are already in the volume), then hand the server the foreground so the
# container's lifecycle tracks it.
#
# Env:
#   CIDE_MODEL   model tag(s) to ensure, space-separated (default: qwen2.5:7b)
#   OLLAMA_HOST  bind address (set to 0.0.0.0:11434 so Railway's private network
#                can reach it; Ollama defaults to 127.0.0.1 which is unreachable
#                from other services).
set -e

: "${CIDE_MODEL:=qwen2.5:7b}"
export OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}"

echo "[cide] starting Ollama on ${OLLAMA_HOST}…"
ollama serve &
OLLAMA_PID=$!

# Wait for the server to accept connections before pulling.
echo "[cide] waiting for engine to come up…"
i=0
until ollama list >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[cide] engine did not come up in time" >&2
    exit 1
  fi
  sleep 1
done

# Pull each requested model (idempotent; cached in the mounted volume).
for model in $CIDE_MODEL; do
  echo "[cide] ensuring model '${model}' is present…"
  ollama pull "$model"
done

echo "[cide] ready — model(s): ${CIDE_MODEL}"

# Hand the foreground back to the server so Railway tracks its lifecycle.
wait "$OLLAMA_PID"
