"""Verify the shipped CLI with synthetic credentials and isolated offline state."""
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread

ROOT = Path(sys.argv[1]).resolve()
VALUE = "synthetic-cli-probe-key"
PROVIDER = "cli-proof-fixture"
PROFILE = PROVIDER + ":default"
CLI = ["node", str(ROOT / "openclaw.mjs")]


class Endpoint(BaseHTTPRequestHandler):
    requests = []

    def log_message(self, *_args):
        pass

    def do_POST(self):
        authorized = self.headers.get("Authorization") == "Bearer " + VALUE
        type(self).requests.append({"path": self.path, "authorized": authorized})
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))
        if not authorized:
            self.send_error(401)
            return
        base = {"id": "cli-proof", "model": "probe-model", "created": 1}
        usage = {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2}
        if body.get("stream"):
            choices = [
                {"index": 0, "delta": {"role": "assistant", "content": "OK"}, "finish_reason": None},
                {"index": 0, "delta": {}, "finish_reason": "stop"},
            ]
            chunks = [{**base, "object": "chat.completion.chunk", "choices": [choice], "usage": usage}
                      for choice in choices]
            data = "".join("data: " + json.dumps(chunk) + "\n\n" for chunk in chunks)
            data += "data: [DONE]\n\n"
            content_type = "text/event-stream"
        else:
            data = json.dumps({**base, "object": "chat.completion", "usage": usage,
                               "choices": [{"index": 0, "message": {"role": "assistant", "content": "OK"},
                                            "finish_reason": "stop"}]})
            content_type = "application/json"
        encoded = data.encode()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


SEED = """
import {pathToFileURL} from 'node:url';
const [root, agentDir, mode] = process.argv.slice(1);
const {upsertAuthProfile} = await import(pathToFileURL(root + '/dist/plugin-sdk/provider-auth.js'));
const credential = {type: 'api_key', provider: 'cli-proof-fixture'};
if (mode === 'inline') credential.key = 'synthetic-cli-probe-key';
else credential.keyRef = {
  source: mode === 'store' ? 'store' : 'env', provider: 'default',
  id: mode === 'missing' ? 'CLI_PROOF_MISSING' : 'CLI_PROOF_API_KEY'
};
upsertAuthProfile({profileId: 'cli-proof-fixture:default', credential, agentDir});
"""


def sanitize(value, state):
    value = value.replace(str(state), "<isolated-state>").replace(VALUE, "<credential>")
    return re.sub(r"\b\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b", "<loopback>", value)


def invoke(args, env, state, stdin=None):
    result = subprocess.run(args, cwd=ROOT, env=env, input=stdin, capture_output=True,
                            text=True, timeout=180)
    if result.returncode:
        details = sanitize((result.stdout + result.stderr)[-2500:], state)
        raise RuntimeError(f"CLI subprocess exited {result.returncode}: {details}")
    return result


def profiles(agent):
    # Subprocesses have exited before this read-only inspection of fixture-owned state.
    db = sqlite3.connect((agent / "openclaw-agent.sqlite").as_uri() + "?mode=ro", uri=True)
    try:
        row = db.execute("SELECT store_json FROM auth_profile_store WHERE store_key = 'primary'").fetchone()
        return json.loads(row[0])["profiles"]
    finally:
        db.close()


def run_case(mode, endpoint):
    with tempfile.TemporaryDirectory(prefix="openclaw-cli-proof-") as directory:
        state = Path(directory)
        workspace = state / "workspace"
        agent = state / "agents/main/agent"
        workspace.mkdir()
        agent.mkdir(parents=True)
        cfg = {
            "gateway": {"mode": "local", "bind": "loopback"},
            "agents": {
                "defaults": {"model": {"primary": PROVIDER + "/probe-model"}},
                "entries": {"main": {"workspace": str(workspace), "agentDir": str(agent)}},
            },
            "models": {"providers": {PROVIDER: {
                "baseUrl": f"http://127.0.0.1:{endpoint.server_port}/v1", "api": "openai-completions",
                "models": [{"id": "probe-model", "name": "Probe model", "reasoning": False,
                            "input": ["text"], "contextWindow": 16384, "maxTokens": 128,
                            "cost": {"input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0}}],
            }}},
        }
        config = state / "openclaw.json"
        config.write_text(json.dumps(cfg))
        config.chmod(0o600)
        # Exclude runner tokens, operator credentials, and real OpenClaw state.
        env = {"HOME": str(state), "PATH": os.environ["PATH"], "NO_COLOR": "1",
               "OPENCLAW_STATE_DIR": str(state), "OPENCLAW_CONFIG_PATH": str(config),
               "OPENCLAW_DISABLE_BUNDLED_PLUGINS": "1", "CLI_PROOF_API_KEY": VALUE}
        invoke(["node", "--input-type=module", "--eval", SEED, "--", str(ROOT), str(agent), mode], env, state)
        if mode == "store":
            invoke(CLI + ["secrets", "store", "set", "CLI_PROOF_API_KEY", "--kind", "secret"],
                   env, state, VALUE + "\n")
        before = profiles(agent)
        start = len(Endpoint.requests)
        command = ["models", "status", "--agent", "main", "--probe", "--probe-provider", PROVIDER,
                   "--probe-profile", PROFILE, "--probe-max-tokens", "8", "--probe-timeout", "15000", "--json"]
        result = invoke(CLI + command, env, state)
        rows = json.loads(result.stdout)["auth"]["probes"]["results"]
        observed = Endpoint.requests[start:]
        after = profiles(agent)
        expected = "unknown" if mode == "missing" else "ok"
        if len(rows) != 1 or rows[0].get("status") != expected:
            raise RuntimeError("Unexpected probe result: " + sanitize(json.dumps(rows), state))
        if mode == "missing":
            assert rows[0].get("reasonCode") == "unresolved_ref", "Missing ref lost its reason"
            assert observed == [], "An unresolved ref reached HTTP"
        else:
            assert observed == [{"path": "/v1/chat/completions", "authorized": True}], observed
        assert before == after, "Persisted profile credentials changed"
        retained = mode == "inline" or (after[PROFILE].get("keyRef") == before[PROFILE]["keyRef"]
                                         and "key" not in after[PROFILE])
        assert retained, "Resolved credential was written over a reference"
        print(json.dumps({"case": mode, "cliExit": result.returncode, "status": rows[0]["status"],
                          "reasonCode": rows[0].get("reasonCode"), "httpRequests": len(observed),
                          "authorizedRequests": sum(row["authorized"] for row in observed),
                          "savedProfileUnchanged": before == after,
                          "referenceRetained": retained}), flush=True)


server = ThreadingHTTPServer(("127.0.0.1", 0), Endpoint)
thread = Thread(target=server.serve_forever, daemon=True)
thread.start()
try:
    print("CLI: openclaw models status --agent main --probe --probe-provider cli-proof-fixture "
          "--probe-profile cli-proof-fixture:default --probe-max-tokens 8 --probe-timeout 15000 --json", flush=True)
    for case in ["inline", "env", "store", "missing"]:
        run_case(case, server)
    print("PASS: shipped CLI, four isolated credential cases, three authorized requests, references preserved", flush=True)
finally:
    server.shutdown()
    server.server_close()
    thread.join()
