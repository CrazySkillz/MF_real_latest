"""Read-only value/layout QA of isolated replacement-precision PDF fixtures."""
from pathlib import Path
import hashlib
import json
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parent
names = [f"precision2-{renderer}-{kind}" for renderer in ("browser", "scheduled") for kind in ("ads", "custom")] + ["precision2-ui-download"]
records, thumbs = [], []
for name in names:
    path = directory / f"{name}.pdf"
    with pdfplumber.open(path) as pdf:
        texts = [page.extract_text() or "" for page in pdf.pages]
        combined = "\n".join(texts)
        assert sum(line.startswith("TOTAL EUR ") for line in combined.splitlines()) == 1, name
        for amount in ("7,653.96", "8,003.96", "250.00", "100.00"):
            assert amount in combined, (name, amount)
        assert "7,653.95" not in combined and "8,003.95" not in combined, name
        for page in pdf.pages:
            assert all(0 <= char["x0"] <= char["x1"] <= page.width and 0 <= char["top"] <= char["bottom"] <= page.height for char in page.chars), name
    document = pdfium.PdfDocument(str(path))
    for index, page in enumerate(document):
        rendered = page.render(scale=1.5).to_pil().convert("RGB")
        rendered.save(directory / f"{name}-page-{index + 1}.png")
        rendered.thumbnail((365, 515))
        thumb = Image.new("RGB", (385, 550), "#eeeeee")
        thumb.paste(rendered, ((385 - rendered.width) // 2, 27))
        ImageDraw.Draw(thumb).text((8, 7), f"{name} / {index + 1}", fill="black")
        thumbs.append(thumb)
        page.close()
    document.close()
    records.append({"file": path.name, "pages": len(texts), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "text": texts})
contact = Image.new("RGB", (385 * 3, 550 * ((len(thumbs) + 2) // 3)), "white")
for index, thumb in enumerate(thumbs):
    contact.paste(thumb, ((index % 3) * 385, (index // 3) * 550))
contact.save(directory / "precision2-contact.png")
(directory / "precision2-render.json").write_text(json.dumps({"synthetic": True, "renderer": "existing PDFium; Poppler unavailable", "artifacts": records}, indent=2) + "\n", encoding="utf8")
print(json.dumps({"pdfs": len(records), "pages": len(thumbs)}))
