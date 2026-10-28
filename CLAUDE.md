# CLAUDE.md

## Project

EV charging station placement optimization for Baden-Württemberg. Interactive Leaflet web map + Python data pipeline. University project (DS500, Winter 2026/2027) — team: Arun, Marko, Roland.

## Tech stack

- **Frontend:** Static HTML/JS/CSS with Leaflet + OpenStreetMap tiles (`app/`)
- **Backend/pipeline:** Python 3.14, pandas, geopandas, openpyxl, scikit-learn, matplotlib
- **Data:** Raw downloads in `data/raw/` (git-ignored), processed outputs in `data/processed/` (git-ignored), shared via external folder

## Key commands

```bash
pip install -r requirements.txt
python src/extract.py          # Download raw data (if missing) and generate processed files (skips if output exists)
python -m http.server 8000     # Serve the map at http://localhost:8000/app/
```

## Code conventions

- Pipeline functions in `src/extract.py` follow this pattern: check if output exists → check/download raw → process → save
- All processed outputs are GeoJSON or JSON; the app reads them from `data/processed/`
- Coordinates are EPSG:4326 (lat/lon) for the map; conversions happen in the pipeline
- Filter to Baden-Württemberg using AGS prefix "08" or spatial join against `laender.geojson`
- Raw CSVs may use `;` separator and `,` decimal separator (German locale)

## Data pipeline (`src/extract.py`)

Each `save_*()` function skips if its output file already exists. Delete the output to force regeneration.

| Function | Output | Key source |
|---|---|---|
| `save_districts()` | `kreise_bw.geojson` | BKG VG250 |
| `save_states()` | `laender.geojson` | BKG VG250 |
| `save_chargers()` | `ladesaeulen.json` | Bundesnetzagentur |
| `save_population()` | `bevoelkerung_1km.json` | Zensus 2022 |
| `save_ev_municipalities()` | `gemeinden_ev.geojson` | KBA FZ3 + FZ27 |
| `save_parking()` | `parkplaetze_bw.geojson` | MobiData BW (off-street + street) |
| `save_historic_stations()` | `historie_bw.geojson` | MobiData BW history snapshot |

## Historic data notes

- Weekly parquet files in `data/processed/historie_parquet/` (weeks 202605–202640, ~44 GB total)
- Raw gzip CSVs in `data/raw/historie/` (~33 GB)
- **Data drop at week 34 (17 Aug 2026):** Platform-side archiving change — polling interval doubled, snapshots switched to change-only deltas. Not a data loss. See `docs/comparison_report_historic_mobidata.md`
- Week 38 is an anomaly (102k stations, 1404 min gap)
- All columns stored as strings in parquet — casting numerics would improve compression

## File layout

```
app/              Web frontend (index.html, app.js, style.css)
data/raw/         Downloaded sources (git-ignored)
data/processed/   Pipeline outputs (git-ignored)
docs/             Reports and project outline
src/              Python pipeline and (empty) placeholder modules
```

## Git

- `data/` is git-ignored; shared separately
- Branch protections (PR required, signed commits)
- Never push to main, always create a branch first, and then commit thourgh it and create a pull request
- Commit messages don't include claude participation
