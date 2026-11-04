# MobiData BW Traffic Volumes

## Overview

Average daily traffic (DTV) at the automatic permanent counting stations in Baden-Württemberg, per month. Script: `src/extract_traffic.py`.

## Source

- **Counts:** [Ergebnisse Ganglinien Dauerzählstellen](https://mobidata-bw.de/dataset/ergebnisse_ganglinien_dauerzaehlstellen), `Ergebnisse_{year}_Excel.zip`, 2022–2026
- **Positions:** [SVZ station list](https://mobidata-bw.de/dataset/karte_strassenverkehrszaehlung), `SVZ-Zaehlstellen_2026-06-26_augmented_SVZ2024.csv`
- **License:** Datenlizenz Deutschland Namensnennung 2.0

Only the monthly workbooks (`VZ_YYYY_MM.xlsx`) are read. Quarter, half-year and year workbooks repeat the same counts.

## Outputs

**`data/processed/verkehr_monatlich.json`:** 10,639 rows, one per station and month, stored as `columns` and `rows`.

| Column | Meaning |
|---|---|
| `station_id` | Current station number: TK map sheet (4 digits) + station number (4 digits) |
| `year`, `month` | Period |
| `dtv_kfz` | Motor vehicles per day, Monday to Sunday, both directions |
| `dtv_kfz_mofr`, `dtv_kfz_sofei` | Motor vehicles per day on weekdays, and on Sundays and public holidays |
| `dtv_sv`, `dtv_sv_mofr` | Heavy vehicles per day, all days and weekdays |
| `valid_days` | The `GT` value as reported |
| `published_change_pct` | Published change from the same month of the previous year |
| `note` | The operator's remark when no count exists, such as `Ausfall` |

**`data/processed/verkehr_zaehlstellen_bw.geojson`:** 202 stations, one point each.

| Column | Meaning |
|---|---|
| `road`, `road_class`, `name`, `lanes` | Latest published labels |
| `dtv_kfz_{year}` | Mean DTV over the months with data, weighted by days per month |
| `months_{year}` | Number of months with data behind that mean |
| `dtv_kfz_ytd_2025`, `dtv_kfz_ytd_2026` | Both years over the same months, per station |
| `position_check` | `dtv` if the position's 2024 count agrees within 30%, `road` if only the road was compared, empty if no position |

## Limits

- **2026 is partial:** it ends in August, so `dtv_kfz_2026` is not comparable with a full year. Use the `ytd` columns. Later months are picked up after deleting `data/raw/verkehr/Ergebnisse_2026_Excel.zip`, but the code does not fetch them automatically.
- **Use 2025 for the network:** the 2026 workbooks no longer list 41 motorway stations in the former VBA section. Stations with motorway data drop from 76 in 2025 to 35 in 2026.
- **Points, not a network:** counts exist only at the stations. Traffic between stations has to be estimated.
- **Missing positions:** 17 stations have none, because the list has no entry or its 2024 count disagrees. 3 positions are confirmed by road only.
- **`valid_days` is unexplained:** the source does not define `GT`. 26% of months with counts report 0, so this column is not used as a filter.
- **Large changes:** 9 stations change by more than 15% between the 2025 and 2026 `ytd` values, such as B 10 Ulm-Nord at -48%. The reason isn't known.

## Validation

`src/extract_traffic.py` compares each station's yearly change with the published change. 94–98% of changes per year fall within 0.5 percentage points.

A one-off comparison with the official year workbooks gave a median difference of 0.0% for stations with 12 months of data. The 95th percentile is 0.16–2.42%, and the largest difference is 43%, for reasons not investigated. One likely cause is outages, because the means here use calendar days.

## Station numbers

The 2026 workbooks use a new layout, and some stations have new numbers. `RENUMBERED` in `src/extract_traffic.py` links them. 13 of the 15 links are confirmed by reproducing the published 26/25 change. The other 2 have too few months and rely on the same road and name.
