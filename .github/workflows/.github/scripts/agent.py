import os, re, json, subprocess, requests
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["DEEPSEEK_API_KEY"],
    base_url="https://api.deepseek.com"
)

comentario = os.environ["COMMENT_BODY"]
repo = os.environ["REPO"]
issue_number = os.environ["ISSUE_NUMBER"]
gh_token = os.environ["GITHUB_TOKEN"]

# Extraer instrucción del comentario
patron = r'/deepseek\s+(?P<accion>editar|crear-rama)\s*(?P<archivos>[^:]*):\s*(?P<instruccion>.*)'
match = re.search(patron, comentario, re.IGNORECASE | re.DOTALL)
if not match:
    print("No se reconoce el comando.")
    exit(0)

accion = match.group("accion").strip().lower()
archivos_str = match.group("archivos").strip()
instruccion = match.group("instruccion").strip()

# Determinar archivos a modificar
if archivos_str:
    archivos = [a.strip() for a in re.split(r'[,\s]+', archivos_str) if a.strip()]
else:
    # Por defecto tomamos todos los archivos de código menos .git y .github
    archivos = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['.git', '.github', '__pycache__', 'node_modules']]
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.md', '.yml', '.yaml', '.html', '.css')):
                archivos.append(os.path.join(root, file))

# Construir contexto
contexto = ""
for archivo in archivos:
    if os.path.exists(archivo) and os.path.getsize(archivo) < 500_000:
        with open(archivo, "r", encoding="utf-8") as f:
            contenido = f.read()
        contexto += f"\n### {archivo}\n```\n{contenido}\n```\n"

if not contexto:
    print("No se encontraron archivos.")
    exit(1)

# Prompt a DeepSeek
system = (
    "Eres un experto programador. Devuelve ÚNICAMENTE un JSON con los cambios, sin explicaciones adicionales.\n"
    'Formato: {"cambios": [{"archivo": "ruta/archivo", "contenido": "nuevo contenido completo"}]}'
)
resp = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": system},
        {"role": "user", "content": f"Instrucción: {instruccion}\n\nCódigo fuente:\n{contexto}"}
    ],
    temperature=0.2,
    max_tokens=32768
)
raw = resp.choices[0].message.content.strip()
raw = re.sub(r'^```(?:json)?\s*', '', raw)
raw = re.sub(r'\s*```$', '', raw)
data = json.loads(raw)

# Aplicar cambios
for cambio in data["cambios"]:
    ruta = cambio["archivo"]
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(cambio["contenido"])

# Git
rama_actual = os.popen("git branch --show-current").read().strip()
subprocess.run(["git", "config", "user.name", "DeepSeek Agent"])
subprocess.run(["git", "config", "user.email", "agent@deepseek"])

if accion == "crear-rama":
    nueva_rama = f"deepseek-{issue_number}"
    subprocess.run(["git", "checkout", "-b", nueva_rama])
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-m", f"{instruccion[:60]}..."])
    subprocess.run(["git", "push", "origin", nueva_rama])
    # Crear PR automáticamente
    headers = {"Authorization": f"token {gh_token}"}
    payload = {
        "title": f"DeepSeek: {instruccion[:70]}",
        "head": nueva_rama,
        "base": rama_actual,
        "body": f"Cambios generados por DeepSeek a partir del comentario en el issue #{issue_number}:\n> {instruccion}"
    }
    r = requests.post(f"https://api.github.com/repos/{repo}/pulls", json=payload, headers=headers)
    if r.status_code == 201:
        print("PR creada exitosamente.")
    else:
        print("Error al crear PR:", r.text)
else:
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-m", f"{instruccion[:60]}..."])
    subprocess.run(["git", "push"])
