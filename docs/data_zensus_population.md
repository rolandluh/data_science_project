# Zensus 2022 Population Grid

## Overview

Population counts from the 2022 German Census (Zensus), published by the Federal Statistical Office (Destatis). The pipeline reads the 100 m grid and sums it to 500 m cells.

## Source

- **URL:** https://www.destatis.de/static/DE/zensus/gitterdaten/Zensus2022_Bevoelkerungszahl.zip
- **License:** Datenlizenz Deutschland Namensnennung 2.0
- **Date:** Census reference date 15 May 2022
- **Format:** ZIP containing CSV files at 100 m, 1 km and 10 km resolution

## Contents

### File used: Zensus2022_Bevoelkerungszahl_100m-Gitter.csv

| Metric | Value |
|---|---|
| Size | 153 MB (inside the 18 MB ZIP) |
| Rows | 3,088,037 populated cells (Germany) |
| Columns | GITTER_ID_100m, x_mp_100m, y_mp_100m, Einwohner |
| CRS | EPSG:3035 (ETRS89-LAEA, metres); x/y are cell centres |
| Population | 3 or more per published cell, 82.6 M in total |

### Other files in ZIP (not used)

- `Zensus2022_Bevoelkerungszahl_1km-Gitter.csv`: 1 km resolution (used before the switch to 500 m)
- `Zensus2022_Bevoelkerungszahl_10km-Gitter.csv`: 10 km resolution
- `Datensatzbeschreibung_Bevoelkerungszahl_Gitterzellen.xlsx`: documentation

## Processing (`read_bw_population_cells()`, `save_population()`)

1. Keep cells with population > 0.
2. Sum each block of 5 × 5 cells of 100 m into one 500 m cell. The grids are aligned, so no cell is split: lower-left corner `x_ll = ⌊x_mp / 500⌋ · 500`, same for y.
3. Cell centre `x_mp = x_ll + 250`; cell ID `CRS3035RES500mN{y_ll}E{x_ll}`.
4. Convert cell centres from EPSG:3035 to EPSG:4326.
5. Keep cells whose centre lies inside Baden-Württemberg: **49,074 cells, 11,087,708 residents** (the old 1 km output gave 11,085,182; the gap comes from border cells).

- Processed output: `data/processed/bevoelkerung_500m.json` (2.2 MB), an array of [lat, lon, residents]
- The same 500 m cells are the base of `ev_bevoelkerung_500m_bw.json` and `einkommen_500m_bw.json`

The 500 m size matches the grid of the StandortTOOL (Nationale Leitstelle Ladeinfrastruktur).

## Usage in project

- Population heatmap layer on the map (visible at zoom level 9+)
- Weight for distributing the KBA EV share and the BA income data to 500 m cells
- Demand driver for charging station placement
