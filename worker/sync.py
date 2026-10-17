#!/usr/bin/env python3
"""Ask the earn-sync workflow to refresh state/ from the hub, then wait for it.

Pushing sync/request.json triggers .github/workflows/earn-sync.yml, which calls
the hub (ingest + queue + status) and commits state/queue.json, state/status.json
and STATUS.md back to this branch. Exit code 0 when fresh state arrived, 2 on
timeout (state/ is left as it was).
"""
import argparse
import datetime as dt
import json
import pathlib
import socket
import subprocess
import sys
import time

ROOT = pathlib.Path(__file__).resolve().parent.parent
BRANCH = "earn-agent"


def git(*args: str) -> str:
    return subprocess.run(["git", "-C", str(ROOT), *args], check=True, capture_output=True, text=True).stdout.strip()


def generated_at() -> str:
    try:
        return json.loads((ROOT / "state" / "queue.json").read_text())["generatedAt"]
    except (FileNotFoundError, KeyError, json.JSONDecodeError):
        return ""


def push_with_retry() -> None:
    for attempt in range(4):
        try:
            git("push", "origin", f"HEAD:{BRANCH}")
            return
        except subprocess.CalledProcessError:
            git("pull", "--rebase", "-q", "origin", BRANCH)
            time.sleep(2 ** attempt)
    git("push", "origin", f"HEAD:{BRANCH}")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--timeout", type=int, default=420, help="seconds to wait for the workflow")
    args = ap.parse_args()

    requested = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")
    req = ROOT / "sync" / "request.json"
    req.parent.mkdir(exist_ok=True)
    req.write_text(json.dumps({"requestedAt": requested, "host": socket.gethostname()}, indent=2) + "\n")
    git("add", str(req))
    git("commit", "-q", "-m", "Request state sync [skip netlify]")
    push_with_retry()
    print(f"sync requested at {requested}; waiting for the earn-sync workflow…", flush=True)

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        time.sleep(15)
        try:
            git("pull", "--rebase", "-q", "origin", BRANCH)
        except subprocess.CalledProcessError as e:
            print(f"pull failed, retrying: {e.stderr.strip()}", flush=True)
            continue
        if generated_at() >= requested:
            q = json.loads((ROOT / "state" / "queue.json").read_text())
            print(f"fresh state: generatedAt={q['generatedAt']} jobs={len(q['jobs'])}")
            for j in q["jobs"]:
                print(f"  - [{j['status']}] {j['slug']}  ({j['token']} {j.get('rewardAmount')}, deadline {j['deadline']})")
            return 0
    print(f"timeout: state/queue.json still generatedAt={generated_at() or 'never'}", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
