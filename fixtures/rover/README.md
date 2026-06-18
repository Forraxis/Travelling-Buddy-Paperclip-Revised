# ROVER consumer-report fixtures

Drop a **real RVSA Approval Consumer Report PDF** here (a 2021+ vehicle — e.g. a
Ford Ranger or LandCruiser 300 VTA) to build the real `PdfRoverParser` against the
actual document layout.

Until a sample lands, the ROVER pipeline is proven with a **synthetic, in-memory**
fixture (`src/lib/spec-fetch/rover/fixtures.ts`) — `PdfRoverParser` throws by
design. See `VEHICLE_DATA_FETCH.md` → "ROVER scaffolding" for how the pieces fit.

When you add a PDF:

1. Implement `PdfRoverParser.parse` (`src/lib/spec-fetch/rover/parser.ts`) — a
   deterministic table parse (pdfplumber-style primary, Tesseract + Qwen-VLM
   fallback) that reads `source.pdf` and returns the same `RoverParseResult` shape.
2. Widen the label patterns in `rover/field-map.ts` to match the real report's
   wording/units.
3. Swap `SyntheticRoverParser` → `PdfRoverParser` in the worker's `defaultDeps`
   (`src/lib/workers/rover-crawl.worker.ts`). Callers don't change.

Real consumer-report PDFs are not committed casually — confirm licensing/PII before
adding any to source control.
