"""Render existing application PDF fixtures; no application/provider access."""
import json
from pathlib import Path
import pdfplumber
import pypdfium2 as pdfium

root = Path(__file__).parent
results = []
for source in sorted(root.glob('pdf-*-fixture.pdf')):
    pages = []
    document = pdfium.PdfDocument(str(source))
    with pdfplumber.open(source) as parsed:
        for index, page in enumerate(document):
            target = source.with_name(source.stem + f'-page-{index + 1}.png')
            page.render(scale=1.5).to_pil().save(target)
            text_page = parsed.pages[index]
            chars = text_page.chars
            off_page = [c['text'] for c in chars if c['x0'] < 0 or c['x1'] > text_page.width + 0.5 or c['top'] < 0 or c['bottom'] > text_page.height + 0.5]
            pages.append({'page': index + 1, 'image': target.name, 'text': text_page.extract_text(), 'offPageCharacters': off_page})
    results.append({'file': source.name, 'pageCount': len(document), 'pages': pages})
(root / 'pdf-render-check.json').write_text(json.dumps({'renderer': 'installed pypdfium2 (Poppler absent)', 'boundary': 'Text extraction and page bounds are supporting checks, not visual approval. PNGs require separate inspection.', 'results': results}, indent=2), encoding='utf-8')
print(json.dumps([{'file': r['file'], 'pageCount': r['pageCount'], 'offPageCharacters': sum(len(p['offPageCharacters']) for p in r['pages'])} for r in results]))
