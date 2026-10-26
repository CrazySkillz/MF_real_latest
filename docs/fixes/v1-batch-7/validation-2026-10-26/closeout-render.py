"""Read-only PDF QA for the four isolated Ad Comparison fixtures."""
from pathlib import Path
import hashlib
import json
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parent
records, thumbs = [], []
for renderer in ("browser", "scheduled"):
    for case in ("long", "multipage"):
        name = f"closeout-{renderer}-ads-{case}"
        path = directory / f"{name}.pdf"
        with pdfplumber.open(path) as pdf:
            texts = [page.extract_text() or "" for page in pdf.pages]
            assert all(text.strip() for text in texts), name
            assert sum(text.count("TOTAL") for text in texts) == 1, name
            assert "child_should_not_be_repeated" not in " ".join(texts), name
            for page in pdf.pages:
                assert all(0 <= char["x0"] <= char["x1"] <= page.width and 0 <= char["top"] <= char["bottom"] <= page.height for char in page.chars), name
        document = pdfium.PdfDocument(str(path))
        for index, page in enumerate(document):
            rendered = page.render(scale=1.4).to_pil().convert("RGB")
            rendered.save(directory / f"{name}-page-{index + 1}.png")
            rendered.thumbnail((365, 515))
            thumb = Image.new("RGB", (385, 550), "#eeeeee")
            thumb.paste(rendered, ((385 - rendered.width) // 2, 27))
            ImageDraw.Draw(thumb).text((8, 7), f"{renderer} / {case} / {index + 1}", fill="black")
            thumbs.append(thumb)
            page.close()
        document.close()
        records.append({"file": path.name, "pages": len(texts), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "characters": sum(map(len, texts))})
contact = Image.new("RGB", (385 * 3, 550 * ((len(thumbs) + 2) // 3)), "white")
for index, thumb in enumerate(thumbs):
    contact.paste(thumb, ((index % 3) * 385, (index // 3) * 550))
contact.save(directory / "closeout-contact.png")
(directory / "closeout-render.json").write_text(json.dumps({"synthetic": True, "renderer": "existing PDFium installation; Poppler not available", "artifacts": records}, indent=2) + "\n", encoding="utf8")
print(json.dumps({"pdfs": len(records), "pages": len(thumbs)}))
