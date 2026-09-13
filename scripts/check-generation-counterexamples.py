"""Offline checks for the reviewed 2026-09-14 fixtures, never for user code.

This is not a code sandbox. Each executable source is pinned below after review.
Python 3.11+ suffices for these selected samples; the Python 3.12-only Sol sample
is intentionally excluded. No generated code is used by the web application's runner.
"""
import hashlib
import json
import platform
import subprocess
import sys
from pathlib import Path

PINNED = {
    "luna:infra-config:1:solution": "15c9164af5dd063c48a716fa07e7581f571cc69e3e88186aafba00ab8c10ef76",
    "luna:infra-config:1:starterCode": "5b387a6e93a1f2313722b4450e5737b611ff3ab763c312e931e2c5a422162b8d",
    "luna:infra-config:2:solution": "a6016709eda77f87435d0ebe765fe8c12eb7678739d905f4bb23e7dd9180e56d",
    "luna:infra-config:2:starterCode": "c82b0500ce5d8bf1556f1366931eea818877e0bba293a06182add1b590f4a5b3",
    "terra:infra-config:1:solution": "dd87a9ebfc8d0f166cc71cef424ba1b55828d5859ad2a58e5b77b351babe8a01",
    "terra:infra-config:1:starterCode": "92393e8689c7cb7af0d7451be771e6892a6ae9943f30313660c2473811a80acf",
    "terra:infra-config:2:solution": "280a38eabee1b6689c7df07fc49a4af6a3b4034601e57c04d9ba0cb26cffaffc",
    "terra:infra-config:2:starterCode": "5f7df3dce9112d0b185961ed063ee7399bfdd983bec1529e338a26eab7b42098",
    "terra:network-frames:1:solution": "37605937bcd3c6b98a2a4405c5acd5708d211cfc4a1c7a1b48e6a567fb15f5d3",
    "terra:network-frames:2:solution": "84858f76c1f5f75cb72ff6c91b74c8041b418926e07298794fbf86855efc9be8",
    "sol:infra-config:2:solution": "323ffa9e409b854e5f10f4281a0b02a15da8427ff3171964adc5e0bf362f7258",
    "sol:infra-config:2:starterCode": "7880ef7cc81c043c0926fec1470bfedb8179c6ae4149df71ecbc154f103ac7a8"
}

checks = []

def check(model, case, repetition, field, harness, description):
    report = json.loads(Path(f"reports/ai-generation-{model}.json").read_text())
    row = next(r for r in report["results"] if r["id"] == case and r["repetition"] == repetition)
    source = row["content"][field]
    identity = f"{model}:{case}:{repetition}:{field}"
    digest = hashlib.sha256(source.encode()).hexdigest()
    if PINNED.get(identity) != digest:
        raise ValueError("Unreviewed fixture changed: " + identity)
    result = subprocess.run([sys.executable, "-I", "-c", source + "\n" + harness],
                            capture_output=True, text=True, timeout=3)
    checks.append({"sample": identity, "sourceSha256": digest, "check": description,
                   "exitCode": result.returncode, "observed": result.stdout.strip(),
                   "assertionPassed": result.returncode == 0})

for repetition in (1, 2):
    class_name = "LengthPrefixedParser" if repetition == 1 else "FrameParser"
    chunk = r'b"\x00\x00\x04ab"' if repetition == 1 else r'b"\x00\x00\x04te"'
    header = 1121 if repetition == 1 else 1140
    check("terra", "network-frames", repetition, "solution", f'''
p = {class_name}()
try:
    p.feed({chunk})
except ValueError:
    print("Example's first feed raises ValueError: header is {header}, not 4")
else:
    raise AssertionError("Expected the malformed-header counterexample")
''', "Published payload-split example lacks the fourth length byte (run 2 uses t=116, likewise exceeds 1024).")

for model, repetition in (("terra", 1), ("terra", 2), ("sol", 2)):
    check(model, "infra-config", repetition, "solution", '''
try:
    parse_config({"PORT": "9" * 5000, "WORKERS": "bad", "DEBUG": "yes"})
except ValueError as error:
    message = str(error)
    assert "4300" in message and "WORKERS" not in message
    print("Uncaught int conversion limit prevents collecting DEBUG, PORT, WORKERS")
else:
    raise AssertionError("Expected an aggregate-error contract violation")
''', "5000-digit PORT and two invalid fields should report all field names, but int() aborts before aggregation (default digit limit).")

for model in ("luna", "terra", "sol"):
    repetitions = (1, 2) if model != "sol" else (2,)
    for repetition in repetitions:
        check(model, "infra-config", repetition, "starterCode", '''
env = {"PORT": "0", "WORKERS": "bad", "DEBUG": "yes"}
try:
    parse_config(env)
except ValueError as error:
    assert "WORKERS" not in str(error) or "DEBUG" not in str(error)
    print("Starter stops before collecting all invalid fields; fixing behavior is required")
else:
    raise AssertionError("Expected a defective refactoring starter")
''', "Refactoring starter violates the required aggregate-error behavior.")

Path("reports/generation-counterexamples.json").write_text(json.dumps({
    "runtime": platform.python_version(), "mode": "isolated interpreter, reviewed pinned sources, 3-second timeout",
    "limits": "Focused counterexamples only; Python 3.12-only source, React, SQL and Unity were inspected statically, not executed here. Not a sandbox for arbitrary code.",
    "checks": checks,
}, ensure_ascii=False, indent=2) + "\n")
print(json.dumps({"checks": len(checks), "passed": sum(c["assertionPassed"] for c in checks)}))
if not all(c["assertionPassed"] for c in checks):
    sys.exit(1)
