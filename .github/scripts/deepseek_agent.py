"""
Agente DeepSeek para GitHub Actions.

Disparado por un comentario en un issue/PR con el formato:

    /deepseek <archivos separados por coma> :: <instrucción>

Ejemplos:
    /deepseek apps/web/src/app/page.tsx :: agrega un botón de logout en el header
    /deepseek apps/api/src/app.module.ts, apps/api/src/main.ts :: habilita CORS para axonos.up.railway.app

El agente:
  1. Lee SOLO los archivos que indiques (no manda todo el repo: sería caro y no cabe).
  2. Le pide a DeepSeek el contenido nuevo completo de esos (u otros) archivos.
  3. Crea una rama nueva `deepseek/issue-<n>` y abre un Pull Request con los cambios.
  4. Comenta en el issue con el resultado (link al PR o el error).

Nunca hace push directo a la rama por defecto: siempre via PR, para que puedas revisar.
"""

import os
import re
import json
import subprocess
import requests
from openai import OpenAI

# ── Configuración / entorno ─────────────────────────────────────────────
API_KEY = os.environ["DEEPSEEK_API_KEY"]
COMMENT_BODY = os.environ["COMMENT_BODY"]
ISSUE_NUMBER = os.environ["ISSUE_NUMBER"]
COMMENT_ID = os.environ.get("COMMENT_ID", "")
REPO = os.environ["REPO"]  # "owner/repo"
DEFAULT_BRANCH = os.environ.get("DEFAULT_BRANCH", "main")
GH_TOKEN = os.environ["GITHUB_TOKEN"]

GH_API = f"https://api.github.com/repos/{REPO}"
GH_HEADERS = {
    "Authorization": f"token {GH_TOKEN}",
    "Accept": "application/vnd.github+json",
}

# Límites de seguridad
MAX_FILE_BYTES = 200_000          # no mandamos archivos enormes como contexto
MAX_CONTEXT_CHARS = 120_000       # ~40K tokens; deja margen en la ventana de DeepSeek
MAX_OUTPUT_TOKENS = 8192          # límite real de salida de deepseek-chat


def post_comment(body: str) -> None:
    """Deja un comentario en el issue con el resultado."""
    try:
        requests.post(
            f"{GH_API}/issues/{ISSUE_NUMBER}/comments",
            headers=GH_HEADERS,
            json={"body": body},
            timeout=30,
        )
    except Exception as exc:  # noqa: BLE001
        print(f"No se pudo comentar: {exc}")


def fail(message: str) -> None:
    """Comenta el error y termina."""
    print(message)
    post_comment(f"🔴 **DeepSeek Agent**\n\n{message}")
    raise SystemExit(0)  # exit 0 para no marcar el job en rojo por un error de uso


# ── 1. Parsear el comando ───────────────────────────────────────────────
# Formato canónico: /deepseek <archivos> :: <instrucción>
match = re.search(
    r"/deepseek\s+(?P<files>.*?)\s*::\s*(?P<instruction>.+)",
    COMMENT_BODY,
    re.IGNORECASE | re.DOTALL,
)
if not match:
    fail(
        "No entendí el comando. Usa este formato:\n\n"
        "```\n/deepseek ruta/archivo1.ts, ruta/archivo2.ts :: tu instrucción aquí\n```\n\n"
        "Ejemplo:\n```\n/deepseek apps/web/src/app/page.tsx :: cambia el título a 'Hola'\n```"
    )

files_str = match.group("files").strip()
instruction = match.group("instruction").strip()

archivos = [a.strip() for a in re.split(r"[,\n]+", files_str) if a.strip()]
if not archivos:
    fail(
        "Debes indicar al menos un archivo. El agente NO lee todo el repo "
        "(es muy grande y costoso). Indica las rutas exactas que quieres tocar."
    )

# Validación anti path-traversal
for a in archivos:
    if a.startswith("/") or ".." in a.split("/"):
        fail(f"Ruta no permitida: `{a}`. Usa rutas relativas dentro del repo.")


# ── 2. Construir contexto con los archivos indicados ────────────────────
contexto = ""
faltantes = []
for archivo in archivos:
    if os.path.exists(archivo):
        size = os.path.getsize(archivo)
        if size > MAX_FILE_BYTES:
            fail(f"El archivo `{archivo}` es muy grande ({size} bytes). Máx {MAX_FILE_BYTES}.")
        with open(archivo, "r", encoding="utf-8", errors="replace") as f:
            contenido = f.read()
        contexto += f"\n### ARCHIVO EXISTENTE: {archivo}\n```\n{contenido}\n```\n"
    else:
        # Archivo a crear
        faltantes.append(archivo)
        contexto += f"\n### ARCHIVO A CREAR (no existe aún): {archivo}\n```\n(vacío)\n```\n"

if len(contexto) > MAX_CONTEXT_CHARS:
    fail(
        f"El contexto ({len(contexto)} chars) supera el límite ({MAX_CONTEXT_CHARS}). "
        "Indica menos archivos o más pequeños."
    )


# ── 3. Llamar a DeepSeek ────────────────────────────────────────────────
client = OpenAI(api_key=API_KEY, base_url="https://api.deepseek.com")

system = (
    "Eres un ingeniero de software senior. Aplicas el cambio solicitado al código dado.\n"
    "Reglas estrictas:\n"
    "- Devuelve ÚNICAMENTE un objeto JSON válido, sin texto antes ni después, sin markdown.\n"
    '- Formato exacto: {"cambios": [{"archivo": "ruta/relativa", "contenido": "contenido COMPLETO del archivo"}], "resumen": "qué hiciste en 1-2 frases"}\n'
    "- 'contenido' debe ser el archivo completo ya modificado, no un diff ni un fragmento.\n"
    "- Solo incluye en 'cambios' los archivos que realmente modificas o creas.\n"
    "- No rompas la sintaxis. Mantén el estilo del código existente."
)
user = f"Instrucción del usuario:\n{instruction}\n\nCódigo fuente relevante:\n{contexto}"

try:
    resp = client.chat.completions.create(
        model="deepseek-chat",
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0.1,
        max_tokens=MAX_OUTPUT_TOKENS,
        response_format={"type": "json_object"},
    )
except Exception as exc:  # noqa: BLE001
    fail(f"Error llamando a la API de DeepSeek: `{exc}`")

raw = resp.choices[0].message.content.strip()
raw = re.sub(r"^```(?:json)?\s*", "", raw)
raw = re.sub(r"\s*```$", "", raw)

try:
    data = json.loads(raw)
    cambios = data["cambios"]
    assert isinstance(cambios, list) and cambios
except Exception as exc:  # noqa: BLE001
    fail(f"DeepSeek no devolvió un JSON válido de cambios: `{exc}`\n\nRespuesta cruda:\n```\n{raw[:1500]}\n```")

resumen = data.get("resumen", instruction[:120])


# ── 4. Aplicar cambios ──────────────────────────────────────────────────
escritos = []
for cambio in cambios:
    ruta = cambio["archivo"].strip()
    if ruta.startswith("/") or ".." in ruta.split("/"):
        print(f"Saltando ruta no permitida devuelta por el modelo: {ruta}")
        continue
    os.makedirs(os.path.dirname(ruta) or ".", exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(cambio["contenido"])
    escritos.append(ruta)

if not escritos:
    fail("DeepSeek no produjo cambios aplicables.")


# ── 5. Crear rama + commit + push + PR ──────────────────────────────────
def run(*args: str) -> None:
    subprocess.run(args, check=True)


rama = f"deepseek/issue-{ISSUE_NUMBER}"
run("git", "config", "user.name", "deepseek-agent[bot]")
run("git", "config", "user.email", "deepseek-agent@users.noreply.github.com")
run("git", "checkout", "-B", rama)
run("git", "add", "-A")

# ¿hay algo que commitear?
if subprocess.run(["git", "diff", "--cached", "--quiet"]).returncode == 0:
    fail("Los cambios de DeepSeek son idénticos al código actual; no hay nada que commitear.")

run("git", "commit", "-m", f"deepseek: {resumen[:60]}")
run("git", "push", "-f", "origin", rama)

# Crear (o reutilizar) el PR
pr_body = (
    f"Cambios generados por **DeepSeek** desde el comentario del issue "
    f"#{ISSUE_NUMBER}.\n\n**Instrucción:**\n> {instruction}\n\n"
    f"**Resumen del modelo:** {resumen}\n\n"
    f"**Archivos modificados:**\n" + "\n".join(f"- `{a}`" for a in escritos)
)
r = requests.post(
    f"{GH_API}/pulls",
    headers=GH_HEADERS,
    json={
        "title": f"DeepSeek: {resumen[:70]}",
        "head": rama,
        "base": DEFAULT_BRANCH,
        "body": pr_body,
    },
    timeout=30,
)

if r.status_code == 201:
    pr_url = r.json()["html_url"]
    post_comment(f"✅ **DeepSeek Agent** abrió un PR con los cambios: {pr_url}")
    print(f"PR creado: {pr_url}")
elif r.status_code == 422 and "A pull request already exists" in r.text:
    post_comment(f"✅ **DeepSeek Agent** actualizó la rama `{rama}` (el PR ya existía).")
else:
    post_comment(
        f"⚠️ Subí los cambios a la rama `{rama}` pero no pude crear el PR "
        f"automáticamente:\n```\n{r.text[:800]}\n```\nÁbrelo a mano desde GitHub."
    )
