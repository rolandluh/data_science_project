# Data Sources Summary

## Overview

This project uses 6 primary data sources from 4 German public institutions to analyze EV charging infrastructure in Baden-Württemberg. All data is openly licensed.

## Source inventory

| # | Source | Provider | Records (BW) | Date | Status |
|---|---|---|---|---|---|
| 1 | Ladesäulenregister | Bundesnetzagentur | 18,863 stations | Sep 2026 | ✅ In pipeline |
| 2 | Historic charging data | MobiData BW | 6,031 stations (snapshot), 36 weekly files | Jan–Oct 2026 | ✅ In pipeline |
| 3 | Parking (off-street + street) | MobiData BW | 28,475 sites | Oct 2026 | ✅ In pipeline |
| 4 | Vehicle statistics (FZ3, FZ27) | KBA | ~1,100 municipalities | Oct 2024 | ✅ In pipeline |
| 5 | Population grid (1 km) | Destatis / Zensus 2022 | ~5,000 cells in BW | May 2022 | ✅ In pipeline |
| 6 | Administrative boundaries | BKG (VG250) | 44 districts, 1,101 municipalities | Jan 2020 | ✅ In pipeline |

### Not yet integrated

| Source | Provider | Content | Potential use |
|---|---|---|---|
| KBA FZ 13 | KBA | Vehicle stock by class | Vehicle mix analysis |
| KBA EV Grid | KBA | EV share per 5 km cell (14,667 cells) | Fine-grained EV adoption map layer |
| Parkdaten-Referenz-Tabelle | MobiData BW | 4-row reference/example | Documentation only |

## Data coverage

- **Spatial:** All datasets filtered to Baden-Württemberg (AGS prefix "08" or spatial join)
- **Temporal:** Charging register is a Sep 2026 snapshot; historic data covers Feb–Oct 2026 weekly; vehicle data is Oct 2024; population is Census 2022
- **Coordinate system:** All outputs in EPSG:4326 (WGS84 lat/lon)

## Data volume

| Category | Raw size | Processed size |
|---|---|---|
| Charging register | 53 MB | 10.1 MB |
| Historic (weekly) | 33 GB (gzip CSV) / 44 GB (Parquet) | 3.8 MB (single-day snapshot) |
| Parking | 11.5 MB (2 CSVs) | 16.1 MB (GeoJSON, larger due to geometry encoding) |
| Vehicle statistics | 2.3 MB (3 Excel files) | 3.1 MB |
| Population grid | 18 MB (ZIP) | 1.0 MB |
| Boundaries | 67 MB (ZIP) | 7.2 MB (3 GeoJSON files) |
| **Total** | **~33.2 GB** | **~44.1 MB** (map files) |

## Key relationships

```
BKG Boundaries (VG250)
  └─ State outline ──────── spatial filter for all datasets
  └─ District outlines ──── map layer
  └─ Municipality shapes ─┐
                          ├── joined with KBA FZ27 → BEV counts per municipality
                          │
Bundesnetzagentur Register ── charging station locations + metadata
MobiData BW Historic ──────── station availability over time
MobiData BW Parking ───────── parking infrastructure (off-street + street)
Zensus 2022 Grid ──────────── population density (demand proxy)
```

## Data quality notes

1. **Historic data drop (W34):** Platform archiving change on 17 Aug 2026 reduced weekly rows by ~90%. Not a data loss — switch to change-only deltas. See `comparison_report_historic_mobidata.md`.
2. **Vehicle data lag:** KBA data is from Oct 2024, ~2 years behind the charging data. EV adoption has likely grown since.
3. **Boundary edition:** VG250 is from 2020. Some municipal mergers since then may cause join mismatches.
4. **Historic coverage bias:** The MobiData BW feed covers stations with live feeds, biased toward larger networks. Smaller operators may be underrepresented.
5. **Parking completeness:** Street parking data (ON_STREET) is from specific municipal surveys (e.g. Ladenburg), not a comprehensive survey of all BW streets.
