# KBA Vehicle Statistics

## Overview

Vehicle registration statistics from the Kraftfahrt-Bundesamt (Federal Motor Transport Authority), providing EV adoption data at municipal and grid-cell level.

## Source

- **Publisher:** KBA (www.kba.de)
- **License:** Public government data
- **Reference date:** 1 October 2024 (FZ3, FZ27), 1 January 2025 (EV grid)

## Files

### FZ 3 — Vehicle stock by municipality (kba_fz3_2024.xlsx)

| Metric | Value |
|---|---|
| Size | 883 KB |
| Sheet used | FZ 3.1 |
| Content | 8-digit AGS (Amtlicher Gemeindeschlüssel) per municipality |
| Role | Provides the AGS key to join municipality names to geographic boundaries |

### FZ 27 — Vehicle stock by fuel type and municipality (kba_fz27_202410.xlsx)

| Metric | Value |
|---|---|
| Size | 1.4 MB |
| Sheet used | FZ 27.17 |
| Content | Car counts per municipality split by ownership (commercial/private) and fuel type (total, BEV, PHEV) |
| Key fields | bezirk (5-digit district), gemeinde (municipality name), gew_pkw, gew_bev, gew_phev, priv_pkw, priv_bev, priv_phev |

### FZ 13 — Vehicle stock by vehicle class (kba_fz13_2024.xlsx)

| Metric | Value |
|---|---|
| Size | 175 KB |
| Sheets | FZ 13.1 through FZ 13.10 |
| Content | Vehicle counts by class (passenger cars, trucks, buses, etc.) |
| Status | **Not yet used in the pipeline** |

### EV Grid — Share of electric cars per 5 km cell (kba_pkw_elektro_gitterzellen_2025.csv)

| Metric | Value |
|---|---|
| Size | 915 KB |
| Rows | 14,667 |
| Columns | FID, 5km-Gitterzelle-ID, Anteil (in%), ZS_Anteil_Pkw_mit_Elektro-Antrieb, Berichtsjahr, Shape__Area, Shape__Length |
| Content | EV share (%) per 5 km grid cell across Germany |
| Status | **Not yet used in the pipeline** — planned as an additional map layer |

## Processing

FZ 3.1 and FZ 27.17 are joined on district code + municipality name to produce per-municipality BEV/PHEV counts with AGS keys, then merged with VG250 municipality geometries.

- Processed output: `data/processed/gemeinden_ev.geojson` (3.1 MB)
- BW filter: AGS prefix "08"

## Usage in project

Municipality choropleth layer showing BEV adoption (total cars, BEV count, PHEV count, BEV share). Key demand indicator for charging station placement.
