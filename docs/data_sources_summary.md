# Data Sources Summary

## Overview

This project combines open data from German public institutions and OpenStreetMap to analyze EV charging infrastructure in Baden-Württemberg.

## Source inventory

| # | Source | Provider | Records (BW) | Date | Status |
|---|---|---|---|---|---|
| 1 | Ladesäulenregister | Bundesnetzagentur | 18,863 stations | Sep 2026 | ✅ In pipeline |
| 2 | Historic charging data | MobiData BW | 6,031 stations (snapshot); 8,189 stations with daily occupancy from 36 weekly files | Jan–Oct 2026 | ✅ In pipeline |
| 3 | Parking (off-street + street) | MobiData BW | 28,475 sites | Oct 2026 | ✅ In pipeline |
| 4 | EV share grid (5 km) | KBA | 1,563 cells | 2026 | ✅ In pipeline |
| 5 | Population grid (100 m → 500 m) | Destatis / Zensus 2022 | 49,074 cells of 500 m | May 2022 | ✅ In pipeline |
| 6 | Income grid (1 km, 5 km) + district table | Bundesagentur für Arbeit | 49,074 cells of 500 m, 44 districts | Dec 2024 / Dec 2025 | ✅ In pipeline |
| 7 | Administrative boundaries | BKG (VG250) | 44 districts | Jan 2020 | ✅ In pipeline |
| 8 | Roads, junctions, POIs, substations, parking | OpenStreetMap | see `model_inputs.md` | Oct 2026 | ✅ In pipeline |
| 9 | Traffic counting sites | Verkehrsmonitoring BW / SVZ | 5,638 sites | 2024 | ✅ In pipeline |

### Raw files not used

| Source | Provider | Content | Note |
|---|---|---|---|
| KBA FZ 3, FZ 27 | KBA | Car counts per municipality | Replaced by the 5 km EV grid; possible cross-check |
| KBA FZ 13 | KBA | Vehicle stock by class | Vehicle mix analysis |
| Parkdaten-Referenz-Tabelle | MobiData BW | 4-row reference/example | Documentation only |

## Data coverage

- **Spatial:** All datasets filtered to Baden-Württemberg (AGS prefix "08" or spatial join)
- **Grid:** Population, EV share and income share one 500 m grid (EPSG:3035, aligned with the 1 km and 5 km grids)
- **Temporal:** Charging register is a Sep 2026 snapshot; historic data covers Jan–Oct 2026; EV grid 2026; income Dec 2024/2025; population is Census 2022
- **Coordinate system:** All outputs in EPSG:4326 (WGS84 lat/lon)

## Data volume

| Category | Raw size | Processed size |
|---|---|---|
| Charging register | 53 MB | 10.1 MB |
| Historic (weekly) | 33 GB (gzip CSV) / 44 GB (Parquet) | 3.8 MB snapshot + 16.7 MB daily occupancy (Parquet) + 3.8 MB report (xlsx) |
| Parking | 11.5 MB (2 CSVs) | 16.1 MB (MobiData GeoJSON) + 88.8 MB (combined OSM + MobiData GeoJSON) |
| EV share grid | 0.9 MB | 0.6 MB (5 km) + 2.6 MB (500 m) |
| Population grid | 18 MB (ZIP) | 2.2 MB |
| Income | 0.7 MB (ZIP) + 4.1 MB (xlsx) | 3.6 MB |
| Boundaries | 67 MB (ZIP) | 7.1 MB (2 GeoJSON files) |

## Key relationships

```
BKG Boundaries (VG250)
  └─ State outline ──────── spatial filter for all datasets
  └─ District outlines ──── map layer, district fallback for income
Zensus 2022 (100 m → 500 m) ─┬─ population density (demand proxy)
                             ├─ × KBA 5 km EV share  → EV index per 500 m cell
                             └─ × BA median wage     → income per 500 m cell
Bundesnetzagentur Register ── charging station locations + metadata
MobiData BW Historic ──────── station status over time → daily occupancy per station
MobiData BW Parking + OSM ─── combined parking layer (OSM base, MobiData joined within 10 m)
OSM ───────────────────────── roads, POIs, substations
```

## Data quality notes

1. **Historic feed switch:** On 14 Aug 2026 at 17:04 the feed switched from full snapshots to change-only deltas (the first analysis dated it to week 34, 17 Aug). Rows per week fall by ~90%. Not a data loss. Occupancy must be time-weighted, not a mean of rows. See `data_mobidata_bw_historic.md` and `comparison_report_historic_mobidata.md`.
2. **Static rows in the history:** `bnetza_api` rows (one or two dumps per week, ~100k register entries) carry no live status and are dropped for occupancy.
3. **Historic coverage bias:** The MobiData BW feed covers stations with live feeds, biased toward larger networks. It covers only about a third of the stations in the register, so smaller operators are underrepresented. Treat this as a limitation of any utilisation result.
4. **Suppressed income cells:** The BA publishes a median only for cells with at least 500 employees; sparse cells fall back to the 5 km cell or the district.
5. **Boundary edition:** VG250 is from 2020. Some municipal mergers since then may cause join mismatches.
6. **Parking completeness:** Street parking data (ON_STREET) is from specific municipal surveys (e.g. Ladenburg), not a comprehensive survey of all BW streets.
7. **Combined parking:** `parkplaetze_kombiniert_bw.geojson` takes OSM as the base and joins the nearest MobiData site within 10 m (`sjoin_nearest`, EPSG:25832). Each MobiData site attaches to one OSM site only. Unmatched MobiData sites are appended. Only 2,339 of 28,475 MobiData sites match an OSM site, so the two sources overlap little. The combined file includes private OSM sites (`access=private`).
