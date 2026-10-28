# Zensus 2022 Population Grid

## Overview

Population counts on a 1 km grid from the 2022 German Census (Zensus), published by the Federal Statistical Office (Destatis).

## Source

- **URL:** https://www.destatis.de/static/DE/zensus/gitterdaten/Zensus2022_Bevoelkerungszahl.zip
- **License:** Datenlizenz Deutschland Namensnennung 2.0
- **Date:** Census reference date 15 May 2022
- **Format:** ZIP containing CSV files at 100 m, 1 km, and 10 km resolution

## Contents

### File used: Zensus2022_Bevoelkerungszahl_1km-Gitter.csv

| Metric | Value |
|---|---|
| Rows | 210,556 (Germany-wide) |
| Columns | GITTER_ID_1km, x_mp_1km, y_mp_1km, Einwohner |
| CRS | EPSG:3035 (ETRS89-LAEA, metres) |
| Population range | 3 – 24,164 per 1 km cell |
| Mean | 393 residents per cell |
| Median | 64 residents per cell |

### Other files in ZIP (not used)

- `Zensus2022_Bevoelkerungszahl_100m-Gitter.csv` — 100 m resolution (very large)
- `Zensus2022_Bevoelkerungszahl_10km-Gitter.csv` — 10 km resolution (coarse)
- `Datensatzbeschreibung_Bevoelkerungszahl_Gitterzellen.xlsx` — Documentation

## Processing

1. Filter to cells with population > 0
2. Convert cell centers from EPSG:3035 to EPSG:4326 (lat/lon)
3. Spatial join to keep only cells within Baden-Württemberg outline
4. Output as array of [lat, lon, population] tuples

- Processed output: `data/processed/bevoelkerung_1km.json` (1.0 MB)

## Usage in project

Population heatmap layer on the map (visible at zoom level 9+). Population density is a key demand driver for charging station placement — areas with more residents generate more charging demand.
