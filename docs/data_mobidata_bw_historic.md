# MobiData BW Historic Charging Data

## Overview

Real-time availability snapshots of EV charging stations across Europe, historized by the MobiData BW platform. Provides dynamic status data (available, charging, out-of-order) over time.

## Source

- **URL:** https://mobidata-bw.de/en/dataset/e-ladesaulen/resource/89fb3a0b-cc42-48a6-b17a-8f1b46abccf1
- **License:** Datenlizenz Deutschland Namensnennung 2.0
- **Historization start:** 28 January 2026 (marked "Work in Progress")
- **Format:** CSV (gzip-compressed), available as daily snapshots and weekly aggregates

## Contents

### Daily snapshot (20261018_ladesaeulen.csv.gz)

Single-day snapshot used for the map layer. After dedup by station ID (latest record per station) and spatial filter to BW: **6,031 stations**.

### Weekly files (202605–202640)

| Metric | Value |
|---|---|
| Files | 37 gzip CSVs (~33 GB total), converted to 36 Parquet files (~44 GB) |
| Coverage | Weeks 05–40 of 2026 (Feb–Oct) |
| Rows per week | 11–28 M (weeks 05–33), 1.6–2.1 M (weeks 34–39), 7.4 M (week 40) |
| Sources | 10 providers (datex2_ecomovement, opendata_swiss, datex2_chargecloud, datex2_enbw, datex2_tesla, and 5 smaller) |

### Key columns

| Column | Description |
|---|---|
| id / station_id | Station identifier (identical from week 24 onward) |
| source | Data provider identifier |
| chargepoint_available_count | Number of available charge points |
| chargepoint_charging_count | Number of actively charging points |
| chargepoint_outoforder_count | Out-of-order charge points |
| chargepoint_static_count | Static/fixed charge points |
| datastore_updated_at | Timestamp when the record was stored |
| geometry | WKT point geometry |

### Schema changes

- **Weeks 05–23:** 24 columns, no `station_id`
- **Weeks 24–36:** 23 columns, `station_id` added
- **Weeks 37–40:** 29 columns (adds `status_last_updated`, `realtime_data_outdated`, `last_updated`, `official_region_code`, `max_power_value`, `go_live_date`)

## Data quality issue: W34 drop

From week 34 (17 Aug 2026), row counts drop ~90%. Root cause analysis confirmed this is a **platform-side archiving change** (not a data loss):

- All 10 providers affected uniformly
- No outage: 168/168 hours covered
- Polling interval doubled (10 min → 20 min)
- Snapshot scope shrank ~10× (likely change-only deltas instead of full snapshots)

Full analysis: `docs/comparison_report_historic_mobidata.md`

## Usage in project

- Map layer: historic station positions with live status (single-day snapshot)
- Analysis: weekly utilization patterns, station availability trends
