"""Generate local deployment secrets without printing them or overwriting existing settings."""
from pathlib import Path
import secrets

root=Path(__file__).resolve().parents[1]
target=root/".env"
if target.exists():raise SystemExit(".env already exists; retained without changes")
target.write_text("WEB_PORT=8090\nAPP_ORIGIN=http://localhost:8090\nDEMO_MODE=true\nSECURE_COOKIE=false\n"+
                  "\n".join(f"{key}={secrets.token_urlsafe(32)}" for key in ["MYSQL_PASSWORD","MYSQL_ROOT_PASSWORD","PREDICTOR_KEY","BOOTSTRAP_ADMIN_PASSWORD"])+"\n",encoding="utf-8")
print("Created .env with separate random secrets")
