---
name: pipeline-step
description: Add or modify a data pipeline step (a save_*() function in src/) for the EV charging project following the repo's conventions. Use when asked to add a dataset, derived grid or processed output.
---

# Adding a pipeline step

Follow the conventions in `CLAUDE.md`. Look at one similar existing function in `src/extract.py` first and copy its structure.

1. **Pattern:** check whether the output exists (skip if so) -> check or download raw data -> process -> save to `data/processed/`.
2. **Formats:** output as GeoJSON or JSON, EPSG:4326 for anything the map reads. Do conversions inside the pipeline.
3. **Region:** filter to Baden-Württemberg with AGS prefix "08" or a spatial join against `laender.geojson`.
4. **German locale:** raw CSVs may use `;` and a decimal comma.
5. **Hand-added raw files:** if the source cannot be downloaded, fail with a clear message naming the file and where to put it.
6. **Error handling:** fail loudly with an actionable message; no silent fallbacks. The pipeline must run without anyone touching the code.
7. **Validation:** add or extend a plausibility check (row counts, value ranges, share of cells outside BW, null rate).
8. **Docs:** add a row to the pipeline table in `CLAUDE.md`, and a note in the matching `docs/data_*.md` or `docs/model_inputs.md`.
9. **Don't** load `data/processed/historie_parquet/` in full (about 44 GB), and ask before deleting existing outputs, since regenerating them is slow.

Finish by running only the new function and report output path, row count and the validation result.
