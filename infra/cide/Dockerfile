# CIDE engine — self-hosted, OpenAI-compatible inference for Axos OS.
#
# Builds a deployable Ollama service (Railway, Fly, any Docker host) that serves
# an open-weight model behind the OpenAI-compatible API at :11434/v1. The Axos OS
# backend points CIDE_BASE_URL at it — no external AI vendor is involved.
#
# The entrypoint binds 0.0.0.0 (so the private network can reach it) and pulls
# the model on boot. On platforms with a persistent volume, mount it at
# /root/.ollama so weights survive restarts; without one, the model re-pulls on
# each cold start (slower boot, but still correct).
FROM ollama/ollama:latest

# Keep a model resident so the first request each session is not a cold load.
ENV OLLAMA_KEEP_ALIVE=30m \
    OLLAMA_HOST=0.0.0.0:11434 \
    CIDE_MODEL=qwen2.5:7b

EXPOSE 11434

COPY entrypoint.sh /usr/local/bin/cide-entrypoint.sh
RUN chmod +x /usr/local/bin/cide-entrypoint.sh

# Override the base image's ENTRYPOINT (which is `ollama`) so our script runs.
ENTRYPOINT ["/usr/local/bin/cide-entrypoint.sh"]
