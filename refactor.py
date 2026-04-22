import os
import re

def replace_in_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    new_content = content
    # Exact property replacements
    new_content = re.sub(r'\bbacken\b', 'line', new_content)
    new_content = re.sub(r'\bbackendKey\b', 'lineKey', new_content)
    new_content = re.sub(r'\bbackendCode\b', 'lineCode', new_content)
    new_content = re.sub(r'\bProductionBackend\b', 'ProductionLine', new_content)
    
    # Endpoints and services
    new_content = new_content.replace('/backends', '/lines')
    new_content = new_content.replace('getBackends', 'getLines')
    new_content = new_content.replace('getBackend', 'getLine')
    new_content = new_content.replace('receiveBackend', 'receiveLine')
    new_content = new_content.replace('startBackend', 'startLine')
    new_content = new_content.replace('patchBackend', 'patchLine')
    new_content = new_content.replace('ProductionBackendRuntime', 'ProductionLineRuntime')
    
    # In frontend HTML mostly
    new_content = new_content.replace('backend real', 'línea real')
    new_content = new_content.replace('backends reales', 'líneas reales')
    new_content = new_content.replace('por backend', 'por línea')
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated: {filepath}")

for root, dirs, files in os.walk('.'):
    if 'node_modules' in root or '.git' in root or 'dist' in root or '.gemini' in root:
        continue
    for file in files:
        if file.endswith('.ts') or file.endswith('.html') or file.endswith('.css'):
            replace_in_file(os.path.join(root, file))
