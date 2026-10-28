# MobiData BW Parking Data

## Overview

Public parking facilities in Baden-Württemberg from the MobiData BW platform, covering both off-street (garages, car parks, underground) and on-street parking spots.

## Source

- **URL (off-street):** MobiData BW WFS API (`park-api_car`, filter: `type<>'ON_STREET' OR type is NULL`)
- **URL (street):** MobiData BW park-api_car (unfiltered, contains ON_STREET)
- **License:** MobiData BW open data
- **Date:** October 2026
- **Format:** CSV with WKT geometry

## Contents

### Off-street (parkplaetze_bw_wfs.csv)

| Metric | Value |
|---|---|
| Rows | 9,189 |
| Columns | 68 |
| Types | OFF_STREET_PARKING_GROUND (5,898), CAR_PARK (1,225), UNDERGROUND (269), OTHER (2) |
| Parking objects | site (5,395), spot (3,794) |

### Street parking (park-api_car.csv)

| Metric | Value |
|---|---|
| Rows | 24,455 |
| Columns | 69 |
| Types | ON_STREET (22,660), rest untyped |
| Parking objects | site (22,133), spot (2,322) |

### Combined (after pipeline)

- FID dedup removes 1,861 overlapping records
- Spatial filter to BW: **28,475 parking sites**
- Processed output: `data/processed/parkplaetze_bw.geojson` (16.1 MB)

### Key columns

| Column | Description |
|---|---|
| name | Parking facility name |
| operator_name | Operator |
| type | ON_STREET, OFF_STREET_PARKING_GROUND, CAR_PARK, UNDERGROUND, OTHER |
| capacity | Total parking spots |
| capacity_charging | EV charging spots |
| capacity_disabled | Accessible spots |
| has_fee | Whether parking requires payment |
| opening_hours | Operating hours |
| is_covered | Covered/sheltered |
| geometry | WKT point geometry |

### Reference table (Parkdaten-Referenz-Tabelle.xlsx)

Small reference file with 4 example records and field mappings between German source fields and API output fields. Used for documentation, not in the pipeline.

## Usage in project

Parking layer on the map. Relevant for placement optimization: proximity to existing parking infrastructure indicates accessible locations for new charging stations.
