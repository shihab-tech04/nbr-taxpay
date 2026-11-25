"""Isolate CI-only Supabase identity and host ports; never touch hosted projects."""
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
    # Reserve all selected ports together so this project cannot select the
    # same port twice. Never kill listeners or reuse another job's database.
    fields = [("api", "port", 54321, "API"), ("db", "port", 54322, "DB"),
              ("db", "shadow_port", 54320, "SHADOW"), ("studio", "port", 54323, "STUDIO"),
              ("local_smtp", "port", 54324, "SMTP"), ("db.pooler", "port", 54329, "POOLER"),
              ("edge_runtime", "inspector_port", 8083, "INSPECTOR"),
              ("analytics", "port", 54327, "ANALYTICS")]
    forbidden = {4173, 4174, 8083, 54320, 54321, 54322, 54323, 54324, 54325, 54326, 54327, 54329, 55433}
    reserved = []
    ports = {}
    try:
        for _, _, _, name in fields:
            for _ in range(30):
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                try:
                    sock.bind(("0.0.0.0", 0))
                    port = sock.getsockname()[1]
                    if port in forbidden:
                        sock.close()
                        continue
                    reserved.append(sock)
                    forbidden.add(port)
                    ports[name] = port
                    break
                except BaseException:
                    sock.close()
                    raise
            else:
                raise RuntimeError(f"No isolated {name} port available")
    finally:
        for sock in reserved:
            sock.close()
    project = f"taxpay-ci-{run_id}-{attempt}"
    result, count = re.subn(r'^project_id = "[^"\n]+"$', f'project_id = "{project}"', raw, flags=re.M)
    if count != 1:
        raise ValueError("Ambiguous project identity")
    # Match each original field exactly once, then compare parsed TOML to
    # prove no unrelated configuration (including auth/RLS) was changed.
    for section, key, default, name in fields:
        target = before
        for part in section.split("."):
            target = target[part]
        if target[key] != default:
            raise ValueError(f"Unexpected {section}.{key} configuration")
        pattern = rf"(?m)^{re.escape(key)} = {default}$"
        result, count = re.subn(pattern, f"{key} = {ports[name]}", result)
        if count != 1:
            raise ValueError(f"Ambiguous {section}.{key}")
        target[key] = ports[name]
    after = tomllib.loads(result)
    before["project_id"] = project
    if before != after:
        raise ValueError("Unexpected configuration changes")
    path.write_text(result)
    print(f"CI-only project {project}; isolated local host ports {ports}")
    return ports

if __name__ == "__main__":
    if os.environ.get("GITHUB_ACTIONS") != "true" or os.environ.get("GITHUB_REPOSITORY") != "shihab-tech04/nbr-taxpay":
        sys.exit("Refusing to modify config outside the intended GitHub CI repository")
    ports = prepare(Path("supabase/config.toml"), os.environ["GITHUB_RUN_ID"], os.environ["GITHUB_RUN_ATTEMPT"])
    with open(os.environ["GITHUB_ENV"], "a") as env:
        for name, port in ports.items():
            env.write(f"TAXPAY_LOCAL_{name}_PORT={port}\n")
