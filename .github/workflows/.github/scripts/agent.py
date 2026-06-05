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

# Buscar el comando en el comentario
patron = r'/deepseek\s+(?P<accion>editar|crear-rama)\s*(?P<archivos>[^:]*):\s*(?P<instruccion>.*)'
match = re.search(patron, comentario, re.IGNORECASE | re.DOTALL)
if not match:
    print("No se reconoce el comando. Asegúrate de que empiece con /deepseek editar o /deepseek crear-rama, seguido de dos puntos y la instrucción.")
    exit(0)

accion = match.group("accion").strip().lower()
archivos_str = match.group("archivos").strip()
instruccion = match.group("instruccion").strip()

print(f"Comando reconocido: acción={accion}, archivos={archivos_str}, instrucción={instruccion}")

# Determinar qué archivos leer
if archivos_str:
    archivos = [a.strip() for a in re.split(r'[,\s]+', archivos_str) if a.strip()]
else:
    # Si no se especifican archivos, incluir todos los archivos de código relevantes
    archivos = []
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['.git', '.github', '__pycache__', 'node_modules', 'dist', 'build']]
        for file in files:
            if file.endswith(('.py', '.js', '.ts', '.jsx', '.tsx', '.md', '.yml', '.yaml', '.html', '.css', '.json', '.env.example')):
                archivos.append(os.path.join(root, file))

print(f"Archivos a procesar: {archivos}")

# Construir el contexto para DeepSeek
contexto = ""
for archivo in archivos[:50]:  # límite de seguridad: máximo 50 archivos para no sobrepasar el contexto
    if os.path.exists(archivo) and os.path.getsize(archivo) < 500_000:
        try:
            with open(archivo, "r", encoding="utf-8") as f:
                contenido = f.read()
            contexto += f"\n### Archivo: {archivo}\n```\n{contenido}\n```\n"
        except Exception as e:
            print(f"No se pudo leer {archivo}: {e}")

if not contexto:
    print("No se encontraron archivos para procesar.")
    exit(1)

print(f"Enviando {len(archivos)} archivos a DeepSeek...")

# Llamada a DeepSeek
system_prompt = (
    "Eres un programador experto. A partir del código fuente proporcionado y la instrucción del usuario, "
    "genera los cambios necesarios. Devuelve ÚNICAMENTE un objeto JSON con este formato exacto, sin explicaciones, sin markdown extra: "
    '{"cambios": [{"archivo": "ruta/del/archivo", "contenido": "código completo modificado del archivo"}]}'
)
respuesta = client.chat.completions.create(
    model="deepseek-chat",
    messages=[
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Instrucción: {instruccion}\n\nCódigo fuente:\n{contexto}"}
    ],
    temperature=0.2,
    max_tokens=32768
)

respuesta_texto = respuesta.choices[0].message.content.strip()
# Limpiar posibles bloques markdown
respuesta_texto = re.sub(r'^```(?:json)?\s*', '', respuesta_texto, flags=re.IGNORECASE)
respuesta_texto = re.sub(r'\s*```$', '', respuesta_texto)

print("Respuesta de DeepSeek (primeros 300 caracteres):", respuesta_texto[:300])

try:
    data = json.loads(respuesta_texto)
except json.JSONDecodeError:
    print("ERROR: DeepSeek no devolvió un JSON válido. Respuesta completa:")
    print(respuesta_texto)
    exit(1)

# Aplicar cambios
for cambio in data["cambios"]:
    ruta = cambio["archivo"]
    contenido_nuevo = cambio["contenido"]
    os.makedirs(os.path.dirname(ruta), exist_ok=True)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(contenido_nuevo)
    print(f"Archivo modificado: {ruta}")

# Configurar git
rama_actual = os.popen("git branch --show-current").read().strip()
subprocess.run(["git", "config", "user.name", "DeepSeek Agent"])
subprocess.run(["git", "config", "user.email", "agent@deepseek"])

if accion == "crear-rama":
    nueva_rama = f"deepseek-{issue_number}"
    subprocess.run(["git", "checkout", "-b", nueva_rama])
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-m", f"DeepSeek: {instruccion[:60]}..."])
    subprocess.run(["git", "push", "origin", nueva_rama])
    # Crear Pull Request
    headers = {"Authorization": f"token {gh_token}"}
    payload = {
        "title": f"DeepSeek: {instruccion[:70]}",
        "head": nueva_rama,
        "base": rama_actual,
        "body": f"Cambios generados por DeepSeek a partir del comentario en el issue #{issue_number}:\n> {instruccion}"
    }
    r = requests.post(f"https://api.github.com/repos/{repo}/pulls", json=payload, headers=headers)
    if r.status_code == 201:
        print(f"PR creada exitosamente: {r.json()['html_url']}")
    else:
        print("Error al crear PR:", r.status_code, r.text)
        # Si falla la PR, al menos los cambios quedan en la rama
else:
    subprocess.run(["git", "add", "-A"])
    subprocess.run(["git", "commit", "-m", f"DeepSeek: {instruccion[:60]}..."])
    subprocess.run(["git", "push"])
    print("Cambios subidos directamente a la rama actual.")
