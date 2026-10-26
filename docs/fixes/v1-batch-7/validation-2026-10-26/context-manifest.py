"""Record current local validation without reading credentials or provider data."""
from pathlib import Path
import hashlib
import json
import subprocess
from datetime import datetime, timezone

directory = Path(__file__).resolve().parent
root = directory.parents[3]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
result = json.loads((directory / "context-accepted.json").read_text(encoding="utf8"))
assert result["numFailedTests"] == result["numPendingTests"] == 0
build = json.loads((directory / "context-final-build-checks.json").read_text(encoding="utf8"))
assert all(check["exitCode"] == 0 for check in build["checks"])
unchanged = {}
for name in ["server/storage.ts", "shared/schema.ts", "server/routes-oauth.ts", "server/report-scheduler.ts", "server/ga4-kpi-benchmark-jobs.ts", "server/ga4-daily-scheduler.ts", "server/analytics.ts"]:
    current = (root / name).read_text(encoding="utf8").replace("\r\n", "\n")
    baseline = subprocess.check_output(["git", "show", f"ec358757:{name}"], cwd=root).decode("utf8").replace("\r\n", "\n")
    assert current == baseline, f"Unexpected adjacent change: {name}"
    unchanged[name] = hashlib.sha256(current.encode()).hexdigest()
tests = {Path(test["name"]).name: {"passed": sum(case["status"] == "passed" for case in test["assertionResults"]), "sha256": digest(Path(test["name"]))} for test in result["testResults"]}
artifacts = json.loads((directory / "context-render.json").read_text(encoding="utf8"))
for item in artifacts["artifacts"]:
    assert digest(directory / item["file"]) == item["sha256"]
manifest = {
    "at": datetime.now(timezone.utc).isoformat(), "base": "ec358757", "state": "uncommitted; undeployed",
    "runtimeFiles": {name: digest(root / name) for name in ["server/ga4-scheduled-report-pdf.ts", "client/src/pages/ga4-metrics.tsx"]},
    "unchangedFromBaselineLFHashes": unchanged, "tests": tests,
    "validation": {"file": "context-accepted.json", "sha256": digest(directory / "context-accepted.json"), "passed": result["numPassedTests"], "failed": result["numFailedTests"], "skipped": result["numPendingTests"], "files": len(result["testResults"])},
    "build": build, "artifacts": artifacts,
    "cleanup": json.loads((directory / "context-cleanup.json").read_text(encoding="utf8")),
    "safety": {"syntheticFixturesOnly": True, "outboundNetworkingBlocked": True, "applicationCredentialsRemoved": True, "productionDatabaseAccess": False, "realEmailSent": False, "browserAccess": False, "committedHistoricalArtifactsUnchanged": True},
    "remaining": ["Deployment and actual browser/provider acceptance", "Complete live source and Custom configuration coverage", "Extreme-content layout limits", "Confirmed email delivery", "Deferred Batch 6 Google Ads live sign-off"],
}
(directory / "context-evidence.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
print(json.dumps({"passed": manifest["validation"]["passed"], "files": len(tests), "runtimeFiles": len(manifest["runtimeFiles"]), "unchangedAdjacentFiles": len(unchanged)}))
