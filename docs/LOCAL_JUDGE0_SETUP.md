# Local Judge0 Setup

Use this guide when you want to test CodeArena with a real local Judge0 judge before deploying to AWS.

## Important Windows Limitation

Do not run Judge0 `v1.13.1` directly on Windows Docker Desktop or WSL Docker Desktop for real judging.

On this machine Docker Desktop exposes cgroup v2 only:

```text
cgroup on /sys/fs/cgroup type cgroup2
/sys/fs/cgroup/memory: No such file or directory
```

That makes Judge0/isolate fail before it creates `/box/main.c`, producing errors like:

```text
No such file or directory @ rb_sysopen - /box/main.c
```

Use Docker Desktop only for CodeArena Postgres/Redis and app development. Use a separate Linux VM for Judge0.

## Target Local Architecture

```text
Windows host
  CodeArena API/web
  CodeArena Postgres/Redis via Docker Desktop

Linux VM on same laptop
  Judge0 server/workers/db/redis
  Native Docker Engine
  Compatible cgroup memory controller
```

## Step 1: Create A Linux VM

Use VirtualBox, VMware, or Hyper-V. Recommended VM resources:

- Ubuntu 20.04 LTS or another Linux host verified with Judge0 `v1.13.1`
- 4 CPU
- 8 GB RAM
- 40 GB disk
- Bridged network, or NAT with port `2358` forwarded to Windows

After installation, open a terminal inside the VM.

## Step 2: Bootstrap Judge0 In The VM

Copy this repo file into the VM:

```text
scripts/bootstrap-judge0-linux-vm.sh
```

Then run inside the VM:

```bash
chmod +x bootstrap-judge0-linux-vm.sh
./bootstrap-judge0-linux-vm.sh
```

The script:

- verifies the cgroup memory controller required by Judge0 `v1.13.1`
- installs Docker Engine if needed
- downloads Judge0 `v1.13.1`
- starts Judge0 services
- checks `/languages`
- runs a real C submission and expects `Accepted`
- prints the VM URL to use from Windows

If it stops with a cgroup warning, apply the commands it prints, reboot the VM, and run it again.

## Step 3: Verify From Windows

From PowerShell on Windows:

```powershell
curl.exe http://<VM_IP>:2358/languages
```

If this works, connect CodeArena:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/connect-local-judge0.ps1 -Judge0BaseUrl http://<VM_IP>:2358
```

The connector script:

- validates Judge0 `/languages`
- runs a real C submission through Judge0
- writes these values into `.env`:

```env
EXECUTOR_MODE=judge0
JUDGE0_BASE_URL=http://<VM_IP>:2358
JUDGE0_API_KEY=
ALLOW_MOCK_EXECUTOR=false
```

- starts CodeArena Postgres/Redis
- runs migration/seed
- syncs Judge0 languages

Start the app:

```powershell
npm run dev
```

Or let the connector start it:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/connect-local-judge0.ps1 -Judge0BaseUrl http://<VM_IP>:2358 -StartDev
```

## Step 4: Manual Judge Verification

Use Two Sum with sample input:

```text
4
2 7 11 15
9
```

Expected output:

```text
0 1
```

Wrong C code:

```c
#include <stdio.h>

int main(void) {
    return 0;
}
```

CodeArena result should be:

```text
Wrong Answer
Actual Output: empty
Expected Output: 0 1
```

Correct C code:

```c
#include <stdio.h>

int main(void) {
    printf("0 1\n");
    return 0;
}
```

CodeArena result should be:

```text
Accepted
Actual Output: 0 1
```

## Useful Commands

Inside the Judge0 VM:

```bash
cd ~/judge0-local/judge0-v1.13.1
docker compose ps
docker compose logs --tail=100 workers
curl http://localhost:2358/languages
```

From Windows:

```powershell
npm run judge0:health
npm run languages:sync:judge0
curl.exe http://<VM_IP>:2358/languages
```

## Production Match

This local VM setup mirrors the recommended production split:

- CodeArena API talks to Judge0 over HTTP.
- Judge0 runs isolated from the main app.
- User code never executes in the CodeArena API process.
- Mock execution remains disabled for real judge testing.

For AWS, use the same model with a dedicated EC2 instance for Judge0.
