#!/usr/bin/env bash
set -euo pipefail

JUDGE0_VERSION="${JUDGE0_VERSION:-1.13.1}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/judge0-local}"
JUDGE0_DIR="$INSTALL_DIR/judge0-v$JUDGE0_VERSION"

echo "CodeArena local Judge0 VM bootstrap"
echo "Judge0 version: v$JUDGE0_VERSION"
echo "Install dir: $JUDGE0_DIR"
echo

if ! command -v sudo >/dev/null 2>&1; then
  echo "sudo is required. Run this inside a normal Ubuntu VM user with sudo access." >&2
  exit 1
fi

if ! grep -qi ubuntu /etc/os-release; then
  echo "This script is intended for Ubuntu VMs." >&2
  exit 1
fi

echo "Checking cgroup layout..."
if [ ! -d /sys/fs/cgroup/memory ]; then
  echo "Current cgroup mounts:"
  mount | grep "cgroup" || true
  echo
  cat >&2 <<'MSG'
Judge0 v1.13.1 needs the legacy cgroup memory controller mounted at:
  /sys/fs/cgroup/memory

This machine currently does not expose it. On an Ubuntu VM, enable cgroup v1
compatibility, then reboot:

  sudo sed -i 's/^GRUB_CMDLINE_LINUX=.*/GRUB_CMDLINE_LINUX="systemd.unified_cgroup_hierarchy=0 systemd.legacy_systemd_cgroup_controller=1"/' /etc/default/grub
  sudo update-grub
  sudo reboot

After reboot, run this script again and verify:
  ls /sys/fs/cgroup/memory

Do not run Judge0 v1.13.1 on a cgroup-v2-only host; submissions will fail with
Internal Error and messages like /box/main.c or /box/script.py missing.
MSG
  exit 2
fi

echo "cgroup memory controller is available."
echo

if ! command -v docker >/dev/null 2>&1; then
  echo "Installing Docker Engine..."
  sudo apt-get update
  sudo apt-get install -y ca-certificates curl gnupg
  sudo install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  sudo chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${VERSION_CODENAME} stable" | sudo tee /etc/apt/sources.list.d/docker.list >/dev/null
  sudo apt-get update
  sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  sudo usermod -aG docker "$USER"
  echo "Docker installed. This script will use sudo for Docker until your next login."
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "Docker is installed but not usable yet. Try rebooting the VM, then rerun this script." >&2
    exit 3
  fi
fi

echo "Docker is available:"
"${DOCKER[@]}" info --format '  Server={{.ServerVersion}} CgroupVersion={{.CgroupVersion}} Driver={{.CgroupDriver}}'
echo

sudo apt-get update
sudo apt-get install -y curl unzip openssl

mkdir -p "$INSTALL_DIR"
cd "$INSTALL_DIR"

if [ ! -d "$JUDGE0_DIR" ]; then
  echo "Downloading Judge0 v$JUDGE0_VERSION..."
  curl -L "https://github.com/judge0/judge0/releases/download/v$JUDGE0_VERSION/judge0-v$JUDGE0_VERSION.zip" -o judge0.zip
  unzip -q judge0.zip
fi

cd "$JUDGE0_DIR"

if [ -f judge0.conf ]; then
  if grep -q '^REDIS_PASSWORD=$' judge0.conf || grep -q '^POSTGRES_PASSWORD=$' judge0.conf; then
    echo "Configuring judge0.conf local passwords..."
    REDIS_PASSWORD_VALUE="$(openssl rand -hex 24)"
    POSTGRES_PASSWORD_VALUE="$(openssl rand -hex 24)"
    sed -i "s/^REDIS_PASSWORD=.*/REDIS_PASSWORD=$REDIS_PASSWORD_VALUE/" judge0.conf
    sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$POSTGRES_PASSWORD_VALUE/" judge0.conf
  else
    echo "Keeping existing judge0.conf passwords for rerun stability."
  fi
fi

echo "Starting Judge0 dependencies..."
"${DOCKER[@]}" compose up -d db redis
sleep 15

echo "Starting Judge0 API and workers..."
"${DOCKER[@]}" compose up -d
sleep 10

echo "Container status:"
"${DOCKER[@]}" compose ps
echo

echo "Checking Judge0 /languages..."
for attempt in $(seq 1 30); do
  if curl -fsS http://localhost:2358/languages >/tmp/judge0-languages.json; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    echo "Judge0 API did not become ready. Recent server logs:" >&2
    "${DOCKER[@]}" compose logs --tail=80 server >&2 || true
    exit 4
  fi
  echo "Judge0 API not ready yet; retrying in 5 seconds ($attempt/30)..."
  sleep 5
done
python3 - <<'PY'
import json
with open("/tmp/judge0-languages.json", "r", encoding="utf-8") as f:
    languages = json.load(f)
print(f"Judge0 languages: {len(languages)}")
PY

echo "Checking real C execution..."
for attempt in $(seq 1 10); do
  if python3 - <<'PY'
import json
import urllib.request

payload = json.dumps({
    "language_id": 50,
    "source_code": "#include <stdio.h>\nint main(void){printf(\"ok\\n\");return 0;}\n",
    "stdin": ""
}).encode()

req = urllib.request.Request(
    "http://localhost:2358/submissions?base64_encoded=false&wait=true",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=30) as response:
    result = json.loads(response.read().decode())

print(json.dumps(result, indent=2))
status = result.get("status", {})
if status.get("id") != 3 or result.get("stdout") != "ok\n":
    raise SystemExit("Judge0 execution check failed")
PY
  then
    break
  fi
  if [ "$attempt" -eq 10 ]; then
    echo "Judge0 execution check failed after retries. Recent logs:" >&2
    "${DOCKER[@]}" compose logs --tail=80 server workers >&2 || true
    exit 5
  fi
  echo "Execution check failed or worker is not ready yet; retrying in 5 seconds ($attempt/10)..."
  sleep 5
done

VM_IP="$(hostname -I | awk '{print $1}')"
echo
echo "Judge0 is ready."
echo "Use this from Windows CodeArena:"
echo "  JUDGE0_BASE_URL=http://$VM_IP:2358"
