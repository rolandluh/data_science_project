# CLAUDE.md

## Project

EV charging station placement optimization for Baden-Württemberg. Interactive Leaflet web map + Python data pipeline. University project (DS500, Winter 2026/2027) — team: Arun, Marko, Roland.

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
| `save_population()` | `bevoelkerung_500m.json` | Zensus 2022 (100 m cells summed to 500 m) |
| `save_ev_grid()` | `ev_anteil_5km_bw.geojson` | KBA 5 km grid (EV share, raw CSV added by hand) |
| `save_ev_population_grid()` | `ev_bevoelkerung_500m_bw.json` | 5 km EV share × Zensus 500 m residents (population-weighted) |
| `save_income_population_grid()` | `einkommen_500m_bw.json` | BA median wage (1 km → 5 km → district fallback) + employees split by residents (`Grunddaten-regionale-Entgelte.zip` and `entgelt_kreise_wohnort_202512.xlsx`, added by hand) |
| `save_parking()` | `parkplaetze_bw.geojson` | MobiData BW (off-street + street) |
| `save_osm_parking()` | `parkplaetze_osm_bw.geojson` | OpenStreetMap (Overpass API, `amenity=parking`) |
| `save_osm_roads()` | `strassen_osm_bw.geojson` | OpenStreetMap (Geofabrik PBF): motorway, trunk, primary |
| `save_osm_road_points()` | `strassenpunkte_osm_bw.geojson` | OpenStreetMap (Geofabrik PBF): junctions, rest areas, services |
| `save_osm_pois()` | `poi_osm_bw.geojson` | OpenStreetMap (Geofabrik PBF): supermarket, retail, office, industrial, hospital, university |
| `save_osm_substations()` | `umspannwerke_osm_bw.geojson` | OpenStreetMap (Geofabrik PBF): `power=substation` |
| `save_historic_stations()` | `historie_bw.geojson` | MobiData BW history snapshot |
| `save_daily_occupancy()` (`src/extract_occupancy.py`) | `auslastung_taeglich_bw.parquet`, `auslastung_stationen_bw.parquet` | Weekly history parquet: time-weighted occupancy per BW station and day |
| `save_occupancy_workbook()` (`src/extract_occupancy.py`) | `auslastung_bw.xlsx` | Daily / weekly / weekday / per-station occupancy report |
| `save_traffic_counters()` (`src/extract_traffic.py`) | `verkehr_svz_bw.geojson` | Verkehrsmonitoring BW 2024 (`Test_Ergebnisse_2024_Excel.zip`, added by hand) + SVZ station list |

## Historic data notes

- Weekly parquet files in `data/processed/historie_parquet/` (weeks 202605–202640, ~44 GB total)
- Raw gzip CSVs in `data/raw/historie/` (~33 GB)
- **Switch to change-only deltas: 14 Aug 2026, 17:04** (first snapshot with ~4k instead of ~37k rows; detected in `extract_occupancy.py`). Averages must be time-weighted (status holds until the next row), not row means.
- **Data drop (first dated week 34, 17 Aug 2026):** Platform-side archiving change — polling interval doubled, snapshots switched to change-only deltas. Not a data loss. See `docs/comparison_report_historic_mobidata.md`. Decision (supervisor): use the data as it is, no special handling.
- Week 38 is an anomaly (102k stations, 1404 min gap); also used as it is. The 102k rows are static `bnetza_api` register dumps (also once in week 05), dropped for occupancy
- All columns stored as strings in parquet — casting numerics would improve compression; deliberately left as is for now
- Coverage bias: the feed covers only about a third of stations and favours larger networks. Documented as a limitation in `README.md` and `docs/data_sources_summary.md`

## Git

- `data/` is git-ignored; shared separately
- Branch protections (PR required, signed commits)
- Never push to main, always create a branch first, and then commit thourgh it and create a pull request
- Commit messages don't include claude participation
