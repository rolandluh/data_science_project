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

## Data quality issue: switch to change-only deltas

Row counts drop ~90% in mid-August. The first analysis (`docs/comparison_report_historic_mobidata.md`) dated this to week 34 (17 Aug 2026). The exact switch is **14 Aug 2026, 17:04**: the last full snapshot (16:50) has ~36,800 rows, the next one ~4,300. This is a **platform-side archiving change** (not a data loss):

- All providers affected uniformly; no outage
- Polling interval doubled (10 min → 20 min)
- Snapshots switched from full snapshots to change-only deltas. Confirmed from the data: in week 30, 94% of rows repeat the station's previous status; in week 36, 0.3% do.

Consequence: a mean over rows overweights busy stations after the switch, because idle stations write no rows. Occupancy must be time-weighted (see below). The supervisor's decision to use the data as it is still holds: the time weighting only reads the delta feed correctly.

## Other quality notes

- **`bnetza_api` rows:** one or two snapshots per week (e.g. 113,861 rows at 28 Jan 2026, 16:43) are register dumps without live status. They also caused the week 38 "102k stations" anomaly. Dropped for occupancy.
- **All points "unknown":** some sources report every point as unknown for long stretches (e.g. `datex2_ecomovement` in spring, `datex2_tesla` partly). This time is no data, not 0% occupancy.
- **Geometry axis order:** WKT points are `POINT (lat lon)` for some sources; the larger number is taken as latitude.
- **Low validity in weeks 25–26 and 29–31:** only about half the station-days reach 18 h of live status (> 90% in other weeks). Cause not checked yet.

## Daily occupancy (`src/extract_occupancy.py`)

`save_daily_occupancy()` reads the 36 weekly Parquet files one by one and keeps BW stations (spatial join with the state outline). Each row is a station status (available, charging, reserved points) that holds until the station's next row:

- **Before the switch** (next feed snapshot is full): the status ends at the next snapshot. A station missing from a full snapshot has no data.
- **After the switch** (next snapshot is a delta): the status holds until the station's next row, at most 72 h.
- **Feed outages** (no snapshot at all for more than 60 min, e.g. week 38): every status ends 20 min after the last snapshot.
- The switch is detected from the data: the first snapshot with fewer than 25% of the rows of the median of the previous 100 snapshots.

The status intervals are split at hour boundaries and summed per station and hour, then per station and day (Europe/Berlin):

| Field | Formula |
|---|---|
| `observed_hours` | Hours with a live status (available + charging + reserved > 0) |
| `charging_point_hours` | Σ charging points × hours (summed over points, so it can exceed 24) |
| `capacity_point_hours` | Σ (available + charging + reserved) × hours |
| `occupancy` | `charging_point_hours / capacity_point_hours` |
| `peak_hour_occupancy` | Highest hourly occupancy of the day (hours with ≥ 30 min of data) |
| `session_starts` | Rises in the charging count between two rows (a lower bound; short sessions between polls are missed) |
| `valid` | `observed_hours / 24 ≥ 0.75` |

Out-of-order, inoperative and unknown points are not counted as available.

Result: 8,189 BW stations, 866,235 station-days (611,016 valid), 28 Jan – 4 Oct 2026. Weekly occupancy 10–15%, with no jump at the switch (10.3% in week 33, 10.9% in week 34).

Outputs:

- `data/processed/auslastung_taeglich_bw.parquet`: one row per station and day
- `data/processed/auslastung_stationen_bw.parquet`: station name, operator, city, postal code, max power
- `data/processed/auslastung_bw.xlsx` (`save_occupancy_workbook()`): sheets Daily (with chart), Weekly and Weekday profile (formulas over Daily), Stations, Stations by week. Station occupancy there is total charging point-hours / total available point-hours over the valid days.

The full run takes about 20 min.

## Usage in project

- Map layer: historic station positions with live status (single-day snapshot)
- Analysis: daily, weekly and weekday occupancy per station; observed demand for validating the placement model
