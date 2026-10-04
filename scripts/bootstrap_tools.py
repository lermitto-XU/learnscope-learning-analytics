"""Download project-local Java and Maven, leaving system installations untouched."""
import hashlib
from pathlib import Path
import urllib.request
import zipfile

root=Path(__file__).resolve().parents[1]/".tools"
root.mkdir(exist_ok=True)
items=[
    ("jdk.zip","https://corretto.aws/downloads/latest/amazon-corretto-21-x64-windows-jdk.zip","https://corretto.aws/downloads/latest_checksum/amazon-corretto-21-x64-windows-jdk.zip","md5","jdk*"),
    ("maven.zip","https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip","https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.zip.sha512","sha512","apache-maven-3.9.11"),
]
for name,url,checksum,algorithm,pattern in items:
    if any(p.is_dir() for p in root.glob(pattern)):continue
    target=root/name
    print(f"Downloading {name} from official distribution",flush=True)
    urllib.request.urlretrieve(url,target)
    with urllib.request.urlopen(checksum) as response:expected=response.read().decode().split()[0]
    actual=hashlib.new(algorithm,target.read_bytes()).hexdigest()
    if actual!=expected:raise SystemExit(f"Checksum mismatch: {name}; extraction aborted")
    with zipfile.ZipFile(target) as archive:
        for info in archive.infolist():
            resolved=(root/info.filename).resolve()
            if not resolved.is_relative_to(root.resolve()):raise SystemExit("Invalid archive path")
        archive.extractall(root)
    print(f"Verified official checksum and extracted {name}",flush=True)
