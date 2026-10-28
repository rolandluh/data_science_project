# BKG Administrative Boundaries (VG250)

## Overview

Official German administrative boundary geometries from the Federal Agency for Cartography and Geodesy (BKG), edition 1 January 2020.

## Source

- **URL:** https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/2020/vg250_01-01.geo84.shape.ebenen.zip
- **License:** Datenlizenz Deutschland Namensnennung 2.0
- **Date:** 1 January 2020
- **Format:** ZIP containing ESRI Shapefiles in WGS84

## Contents

The ZIP contains multiple administrative levels. Three are used:

### VG250_LAN.shp — Federal states (Länder)

| Metric | Value |
|---|---|
| Features | 16 states (multi-row, dissolved by AGS) |
| Key fields | AGS (2-digit state code), GEN (state name) |
| BW filter | AGS = "08" |
| Processed output | `data/processed/laender.geojson` (4.8 MB) |

### VG250_KRS.shp — Districts (Kreise)

| Metric | Value |
|---|---|
| Features | ~400 districts Germany-wide |
| Key fields | AGS (5-digit district code), GEN (district name), BEZ (type: Landkreis, Stadtkreis) |
| BW filter | AGS starts with "08", length = 5 |
| Processed output | `data/processed/kreise_bw.geojson` (2.4 MB) |

### VG250_GEM.shp — Municipalities (Gemeinden)

| Metric | Value |
|---|---|
| Features | ~11,000 municipalities Germany-wide |
| Key fields | AGS (8-digit code), GEN (name) |
| BW filter | AGS starts with "08" |
| Used for | Joining KBA vehicle counts to geographic shapes |
| Processed output | `data/processed/gemeinden_ev.geojson` (3.1 MB, with EV data merged) |

## Processing

- Multi-row geometries (e.g. Konstanz district) are dissolved into single features per AGS
- Municipality geometries simplified by 0.001° (~100 m) to reduce file size for the browser

## Usage in project

- State outline: spatial filter (clip all datasets to BW) and map border layer
- District outlines: map layer for study area boundaries
- Municipality shapes: choropleth base for EV adoption data
