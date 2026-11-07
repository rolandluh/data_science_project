# KBA Vehicle Statistics

## Overview

Vehicle registration statistics from the Kraftfahrt-Bundesamt (Federal Motor Transport Authority). The pipeline uses the KBA 5 km grid with the share of cars with electric drive. The municipality tables (FZ3, FZ27) were used before and are now raw files only.

## Source

- **Publisher:** KBA (www.kba.de)
- **License:** Public government data
- **Reference date:** EV grid `Berichtsjahr` 2026 (the file name says 2025); FZ3 and FZ27 1 October 2024

## Files

### EV grid: share of electric cars per 5 km cell (kba_pkw_elektro_gitterzellen_2025.csv)

Added by hand; there is no stable download URL.

| Metric | Value |
|---|---|
| Size | 915 KB |
| Rows | 14,667 (Germany) |
| Columns | FID, 5km-Gitterzelle-ID, Anteil (in%), ZS_Anteil_Pkw_mit_Elektro-Antrieb, Berichtsjahr, Shape__Area, Shape__Length |
| Content | Share (%) of cars with electric drive per 5 km cell |
| Geometry | None. The cell ID gives the lower-left corner in km in EPSG:3035, e.g. `5kmN2685E4340` = N 2,685,000 m, E 4,340,000 m |
| Status | **In pipeline** (`save_ev_grid()`, `save_ev_population_grid()`) |

`ZS_Anteil_Pkw_mit_Elektro-Antrieb` is `-` for 267 cells (7 in BW). These cells have no published value and are stored as 0; the pipeline treats them as no data. `Shape__Area` is about 54 km² because it was measured in Web Mercator, not the true 25 km².

It is not documented whether the share counts BEV only or BEV and PHEV.

### FZ 3, FZ 27, FZ 13 (kba_fz3_2024.xlsx, kba_fz27_202410.xlsx, kba_fz13_2024.xlsx)

| File | Content | Status |
|---|---|---|
| FZ 3.1 | 8-digit AGS per municipality | Not used anymore |
| FZ 27.17 | Car counts per municipality by owner (commercial/private) and fuel (total, BEV, PHEV) | Not used anymore |
| FZ 13 | Vehicle stock by class | Not used |

FZ27 was replaced by the EV grid. Its counts follow the registration address, so company fleets inflate some municipalities, and it is older (Oct 2024). Private BEV counts from FZ27 could still serve as a cross-check of the grid.

## Processing

### `save_ev_grid()` → `ev_anteil_5km_bw.geojson` (0.6 MB)

1. Build each 5 km square in EPSG:3035 from the cell ID.
2. Set the share to no data where the ZS column is `-`.
3. Keep cells that touch Baden-Württemberg (border cells included): **1,563 cells**, 1,556 with a share.
4. Reproject to EPSG:4326.

### `save_ev_population_grid()` → `ev_bevoelkerung_500m_bw.json` (2.6 MB)

Distributes the share to the 500 m population cells (see `data_zensus_population.md`). All grids are EPSG:3035 and aligned, so each 500 m cell lies in exactly one 5 km cell.

- Parent cell: `5kmN{5·⌊y/5000⌋}E{5·⌊x/5000⌋}` from the 500 m cell centre (x, y in metres)
- `ev_share(c)` = share of the parent cell (an intensive value, assigned, not split)
- `ev_index(c) = Einwohner(c) × ev_share(c) / 100`

Cells without residents have no row, so they get no EVs. Within each 5 km cell, the population-weighted mean of the children's shares equals the published share. `ev_index` is a relative score (residents × share of cars), not a car count: a car count would need cars per resident.

## Usage in project

- Map layer "EV share (5 km grid)": choropleth of the share
- Map layer "EV index (500 m, population-weighted)"
- Demand input for the placement model
