"""Record the localized report correction without modifying source PDFs or old evidence."""
from pathlib import Path
import hashlib
import json
import subprocess
from datetime import datetime, timezone
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
hash_file = lambda path: hashlib.sha256(Path(path).read_bytes()).hexdigest()
result = json.loads((root / "live-report-neighbors.json").read_text())
builds = json.loads((root / "live-report-build-checks.json").read_text())
assert result["numFailedTests"] == result["numPendingTests"] == 0
assert all(check["exitCode"] == 0 for check in builds["checks"])
baseline = json.loads((root / "context-evidence.json").read_text())
for path, expected in baseline["unchangedFromBaselineLFHashes"].items():
    assert hashlib.sha256(Path(path).read_bytes().replace(b"\r\n", b"\n")).hexdigest() == expected, path
assert not subprocess.check_output(["git", "diff", "--name-only", "--", "*.pdf", "*.png"]).strip()
artifacts, thumbnails = [], []
for path in sorted(root.glob("live-*.pdf")):
    with pdfplumber.open(path) as document:
        assert all((page.extract_text() or "").strip() for page in document.pages)
        assert all(-1 <= char["x0"] <= char["x1"] <= page.width + 1 and -1 <= char["top"] <= char["bottom"] <= page.height + 1
                   for page in document.pages for char in page.chars), path.name
        page_count = len(document.pages)
    document = pdfium.PdfDocument(str(path))
    for index, page in enumerate(document):
        picture = page.render(scale=1.5).to_pil().convert("RGB")
        picture.save(root / f"{path.stem}-page-{index + 1}.png")
        picture.thumbnail((340, 480))
        thumbnail = Image.new("RGB", (360, 510), "#eeeeee")
        thumbnail.paste(picture, ((360 - picture.width) // 2, 28))
        ImageDraw.Draw(thumbnail).text((5, 7), f"{path.stem} p{index + 1}", fill="black")
        thumbnails.append(thumbnail)
        page.close()
    document.close()
    artifacts.append({"file": path.name, "pages": page_count, "sha256": hash_file(path)})
contact = Image.new("RGB", (1080, 510 * ((len(thumbnails) + 2) // 3)), "white")
for index, thumbnail in enumerate(thumbnails):
    contact.paste(thumbnail, ((index % 3) * 360, (index // 3) * 510))
contact.save(root / "live-report-contact.png")
tests = {Path(file["name"]).name: {"sha256": hash_file(file["name"]), "passed": len(file["assertionResults"])} for file in result["testResults"]}
for file in result["testResults"]:
    assert all(case["status"] == "passed" for case in file["assertionResults"])
record = {"at": datetime.now(timezone.utc).isoformat(), "base": "3caf3e9c", "state": "uncommitted; undeployed",
          "runtimeFiles": {path: hash_file(path) for path in ["client/src/pages/ga4-metrics.tsx", "server/ga4-scheduled-report-pdf.ts"]},
          "unchangedFromBaselineLFHashes": baseline["unchangedFromBaselineLFHashes"],
          "passed": result["numPassedTests"], "failed": 0, "skipped": 0, "tests": tests,
          "testResultsSha256": hash_file(root / "live-report-neighbors.json"), "builds": builds,
          "syntheticArtifacts": artifacts, "renderedPages": len(thumbnails),
          "boundaries": ["No production data/provider/mailbox/browser access", "No database integration rerun: storage and scheduling unchanged",
                         "Missing-spend stale-state suppression reproduced; the uploaded PDF does not preserve its historical query state",
                         "No whole-section or release sign-off; deployed recheck pending"]}
(root / "live-report-evidence.json").write_text(json.dumps(record, indent=2) + "\n", encoding="utf8")
print(json.dumps({"passed": record["passed"], "files": len(tests), "pdfs": len(artifacts), "pages": len(thumbnails)}))
