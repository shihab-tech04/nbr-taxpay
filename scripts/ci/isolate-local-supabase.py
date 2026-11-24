"""Isolate CI-only Supabase identity and email web port; never touch hosted projects."""
import os
import re
import socket
import sys
import tomllib
from pathlib import Path

def prepare(path, run_id, attempt):
    if not re.fullmatch(r"[0-9]+", run_id) or not re.fullmatch(r"[0-9]+", attempt):
        raise ValueError("Numeric GitHub run identity required")
    raw = path.read_text()
    before = tomllib.loads(raw)
    if before["project_id"] != "NBR-TaxPay-responsive-check-20261012":
        raise ValueError("Unexpected local project identity")
    if before["local_smtp"]["port"] != 54324 or not before["local_smtp"]["enabled"]:
        raise ValueError("Unexpected local SMTP configuration")
    # Preserve fixed API/DB ports used by existing test clients. Pick an unused
    # mail HTTP port without killing a listener or disabling mail acceptance.
    for _ in range(10):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.bind(("0.0.0.0", 0))
            port = sock.getsockname()[1]
        if port not in {4173, 4174, 8083, 54320, 54321, 54322, 54323, 54324, 54325, 54326, 54327, 54329, 55433}:
            break
    else:
        raise RuntimeError("No isolated mail port available")
    project = f"taxpay-ci-{run_id}-{attempt}"
    result, count = re.subn(r'^project_id = "[^"\n]+"$', f'project_id = "{project}"', raw, flags=re.M)
    if count != 1:
        raise ValueError("Ambiguous project identity")
    result, count = re.subn(r"(?m)^port = 54324$", f"port = {port}", result)
    if count != 1:
        raise ValueError("Ambiguous local SMTP port")
    after = tomllib.loads(result)
    before["project_id"] = project
    before["local_smtp"]["port"] = port
    if before != after:
        raise ValueError("Unexpected configuration changes")
    path.write_text(result)
    print(f"CI-only project {project}; isolated mail HTTP port {port}")
    return port

if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_REPOSITORY") != "shihab-tech04/nbr-taxpay":
        sys.exit("Refusing to modify config outside the intended GitHub CI repository")
    port = prepare(Path("supabase/config.toml"), os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"])
    with open(os.environ["GITHUB_ENV"], "a") as env:
        env.write(f"TAXPAY_LOCAL_SMTP_PORT={port}\n")
