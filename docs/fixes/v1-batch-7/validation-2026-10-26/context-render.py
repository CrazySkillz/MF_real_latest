"""Render only the seven synthetic PDFs from the consolidated report checks."""
from pathlib import Path
import json
import hashlib
import pdfplumber
import pypdfium2 as pdfium
from PIL import Image, ImageDraw

directory = Path(__file__).resolve().parent
names = [f"context-scheduled-{kind}" for kind in ["overview", "kpis", "benchmarks", "ads", "insights", "custom"]] + ["context-browser-insights"]
records, thumbs = [], []
for name in names:
    path = directory / f"{name}.pdf"
    with pdfplumber.open(path) as pdf:
        texts = [page.extract_text() or "" for page in pdf.pages]
        assert all(text.strip() for text in texts), f"Blank page: {name}"
    document = pdfium.PdfDocument(str(path))
    for index, page in enumerate(document):
        bitmap = page.render(scale=1.4)
        image = bitmap.to_pil().convert("RGB")
        image.save(directory / f"{name}-page-{index + 1}.png")
        image.thumbnail((365, 515))
        thumb = Image.new("RGB", (385, 550), "#eeeeee")
        thumb.paste(image, ((385 - image.width) // 2, 27))
        ImageDraw.Draw(thumb).text((8, 7), f"{name.replace('context-', '')} / {index + 1}", fill="black")
        thumbs.append(thumb)
        page.close()
    document.close()
    records.append({"file": path.name, "pages": len(texts), "sha256": hashlib.sha256(path.read_bytes()).hexdigest(), "characters": sum(map(len, texts))})
contact = Image.new("RGB", (385 * 3, 550 * ((len(thumbs) + 2) // 3)), "white")
for index, thumb in enumerate(thumbs):
    contact.paste(thumb, ((index % 3) * 385, (index // 3) * 550))
contact.save(directory / "context-contact.png")
(directory / "context-render.json").write_text(json.dumps({"synthetic": True, "artifacts": records}, indent=2) + "\n", encoding="utf8")
print(json.dumps({"pdfs": len(records), "pages": len(thumbs)}))
