"""Record exact local report boundaries; never reads app credentials or mutates Git."""
from pathlib import Path
import hashlib
import json
import subprocess

directory = Path(__file__).resolve().parent
root = directory.parents[3]
def git(*args):
    return subprocess.check_output(["git", *args], cwd=root)
def digest(path):
    return hashlib.sha256((root / path).read_bytes()).hexdigest()
def normalized(data):
    return data.decode("utf8").replace("\r\n", "\n")

head = git("rev-parse", "HEAD").decode().strip()
boundaries = {
    "client/src/pages/ga4-metrics.tsx": ("        if (includeAdsRevenueBreakdown) {", "    // ========== INSIGHTS =========="),
    "server/ga4-scheduled-report-pdf.ts": ("    if (includeRevenueBreakdown) {", "  if (sections.insights) {"),
}
for filename, (start, end) in boundaries.items():
    original = normalized(git("show", f"HEAD:{filename}"))
    current = normalized((root / filename).read_bytes())
    def without_table(text):
        begin = text.index(start)
        finish = text.index(end, begin)
        return text[:begin] + text[finish:]
    assert without_table(original) == without_table(current), filename

unchanged = ["server/routes-oauth.ts", "server/storage.ts", "shared/schema.ts", "server/report-scheduler.ts", "server/ga4-daily-scheduler.ts", "server/ga4-kpi-benchmark-jobs.ts", "server/services/email-service.ts", "client/src/pages/ga4-ad-comparison.tsx", "client/src/index.css"]
for filename in unchanged:
    assert normalized(git("show", f"HEAD:{filename}")) == normalized((root / filename).read_bytes()), filename
assert not git("diff", "--name-only", "--", "*.pdf", "*.png").strip(), "Historical artifact changed"

result = json.loads((directory / "closeout-final.json").read_text(encoding="utf8"))
followup = json.loads((directory / "closeout-preservation.json").read_text(encoding="utf8"))
assert result["numFailedTests"] == result["numPendingTests"] == followup["numFailedTests"] == followup["numPendingTests"] == 0
tests = {}
for record in result["testResults"]:
    filename = "server/" + Path(record["name"]).name
    cases = record["assertionResults"]
    if filename.endswith("v1-batch7-insights-targets.test.ts"):
        replacement = followup["testResults"][0]["assertionResults"]
        assert {case["fullName"] for case in cases} == {case["fullName"] for case in replacement}
        cases = replacement
    assert all(case["status"] == "passed" for case in cases)
    tests[filename] = {"sha256": digest(filename), "passed": len(cases)}
assert sum(record["passed"] for record in tests.values()) == 658

builds = json.loads((directory / "closeout-build-checks.json").read_text(encoding="utf8"))
assert all(check["exitCode"] == 0 for check in builds["checks"])
rendered = json.loads((directory / "closeout-render.json").read_text(encoding="utf8"))
for artifact in rendered["artifacts"]:
    assert artifact["sha256"] == hashlib.sha256((directory / artifact["file"]).read_bytes()).hexdigest()
evidence = {
    "base": head, "state": "uncommitted; undeployed",
    "runtimeChangesRestrictedToAdComparisonRevenueBreakdown": True,
    "runtimeFiles": {filename: digest(filename) for filename in boundaries},
    "unchangedFromBase": {filename: digest(filename) for filename in unchanged},
    "historicalTrackedPdfPngUnchanged": True,
    "uniqueTests": 658, "files": len(tests), "failed": 0, "skipped": 0, "tests": tests,
    "builds": builds, "artifacts": rendered,
    "limits": ["Synthetic source/provider/storage adapters; no production access", "PDF display only; source values, rankings and writes unchanged", "No personal browser or provider email access", "Full deployed/source/lifecycle/extreme-configuration acceptance remains open"],
}
(directory / "closeout-evidence.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf8")
print(json.dumps({"tests": 658, "files": len(tests), "runtimeFiles": 2, "historicalArtifactsUnchanged": True}))
