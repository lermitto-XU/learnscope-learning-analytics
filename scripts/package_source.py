"""Create an uploadable source archive using an explicit allowlist."""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[1]
output=root/"release/LearnScope-source.zip"
output.parent.mkdir(exist_ok=True)
folders={"web","server","predictor","docs","scripts"}
root_files={"README.md",".gitignore",".env.example","compose.yaml"}
excluded={"node_modules","target","dist","__pycache__",".local",".tools",".pnpm-store","data",".venv"}
suffixes={".py",".java",".ts",".tsx",".css",".json",".md",".sql",".yaml",".yml",".svg",".html",".properties",".xml",".ps1",".mjs",".txt",".png"}
special={"Dockerfile",".dockerignore","pnpm-lock.yaml","pnpm-workspace.yaml"}
selected=[]
for folder in folders:
    for path in (root/folder).rglob("*"):
        if not path.is_file() or excluded.intersection(path.relative_to(root).parts):continue
        if path.suffix in suffixes or path.name in special:selected.append(path)
selected.extend(root/name for name in root_files)
with zipfile.ZipFile(output,"w",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path in sorted(selected):archive.write(path,Path("LearnScope")/path.relative_to(root))
print(f"Packaged {len(selected)} files: {output.name} ({output.stat().st_size:,} bytes)")
