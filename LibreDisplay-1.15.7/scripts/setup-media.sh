#!/bin/sh
set -eu
umask 077

ROOT_DIR="$HOME/libredisplay"
ENV_FILE="$ROOT_DIR/data/libredisplay.env"
[ -d "$ROOT_DIR" ] || { printf 'LibreDisplay is not installed at %s\n' "$ROOT_DIR" >&2; exit 1; }

printf '\nLibreDisplay - Add Picture Folder\n'
printf '=================================\n\n'
printf 'Folder path: '
IFS= read -r requested
[ -n "$requested" ] || { printf 'A folder path is required.\n' >&2; exit 1; }

python3 - "$ENV_FILE" "$requested" <<'PY'
from pathlib import Path
import os, shlex, sys

env_file=Path(sys.argv[1])
requested=Path(sys.argv[2]).expanduser()
try:
    resolved=requested.resolve(strict=True)
except Exception as exc:
    raise SystemExit(f"Folder is not available: {exc}")
if not resolved.is_dir():
    raise SystemExit("The selected path is not a folder")
if ":" in str(resolved) or "\n" in str(resolved):
    raise SystemExit("Folder paths containing ':' or a newline are not supported")
values={}
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line=line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key,raw=line.split("=",1)
        try:
            values[key]=shlex.split(raw,posix=True)[0] if raw.strip() else ""
        except Exception:
            values[key]=raw.strip().strip("'\"")
roots=[x for x in values.get("DASHBOARD_MEDIA_ROOTS","").split(os.pathsep) if x]
if str(resolved) not in roots:
    roots.append(str(resolved))
values["DASHBOARD_MEDIA_ROOTS"]=os.pathsep.join(roots)
values.setdefault("DASHBOARD_HOST","0.0.0.0")
values.setdefault("DASHBOARD_PORT","8787")
values.setdefault("DASHBOARD_REMOTE_ENABLED","0")
values.setdefault("DASHBOARD_REMOTE_NETWORKS","private")
env_file.parent.mkdir(parents=True,exist_ok=True)
env_file.write_text("# LibreDisplay runtime settings\n"+"\n".join(f"{k}={shlex.quote(v)}" for k,v in sorted(values.items()))+"\n",encoding="utf-8")
os.chmod(env_file,0o600)
print(f"Approved media folder: {resolved}")
PY

printf '\nRestart LibreDisplay or reboot before browsing the new folder.\n'
