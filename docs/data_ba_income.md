# Bundesagentur für Arbeit Income Data

## Overview

Median monthly gross wage and number of employees by place of residence, from the employment statistics of the Bundesagentur für Arbeit (BA). The pipeline puts the median on the 500 m population cells.

Both files cover **full-time employees of the core group** subject to social insurance (sozialversicherungspflichtig Vollzeitbeschäftigte der Kerngruppe). The grid and the district table both add up to 21.45 M employees for Germany.

## Source

Both files were added by hand to `data/raw/`.

| File | Content | Reference date |
|---|---|---|
| `Grunddaten-regionale-Entgelte.zip` | `Medianentgelt_1km_WO_202512.csv` (200,208 cells), `Medianentgelt_5km_WO_202512.csv` (14,614 cells) | Median 31 Dec 2024, employees 31 Dec 2025 (column names) |
| `entgelt_kreise_wohnort_202512.xlsx` | BA Entgeltstatistik, sheet 9.1: full-time core group by place of residence, Germany, West/East, states and districts (Gebietsstand June 2026) | 31 Dec 2025 |

### Grid files

| Column | Meaning |
|---|---|
| `Gitter-ID` | `1kmN{N}E{E}` or `5kmN{N}E{E}`, lower-left corner in km, EPSG:3035 |
| `Medianentgelt_Wohnort_202412` | Median monthly gross wage (EUR) of employees living in the cell |
| `SVBeschäftigte_Wohnort_202512` | Employees living in the cell, rounded to 10 |

Format: `;` separator, `.` as thousands separator (`3.300` = 3,300 EUR), cp1252 encoding, empty rows at the end.

**Suppression:** a median is published only for cells with at least 500 employees (inferred from the data: every cell with a median has ≥ 500, every cell with 0 has ≤ 500). A 0 means "not published", not 0 EUR. This leaves medians for 10,470 of 200,208 cells at 1 km and 7,341 of 14,614 at 5 km. The missing cells are mostly rural, so the gaps are not random.

### District table (sheet 9.1)

Column A is the region key (5 digits = district), column J the median in EUR. All 44 BW districts match `kreise_bw.geojson`. National median: 4,227 EUR; Baden-Württemberg: 4,523 EUR.

Note: the BA's other regional tables (sheet 8.x) count people where they work. Only sheet 9.x is by place of residence like the grid.

## Processing (`save_income_population_grid()`)

For a 500 m cell *c* with residents *pop(c)* and centre (x, y) in EPSG:3035 metres:

1. **Parents:** `P1 = 1kmN{⌊y/1000⌋}E{⌊x/1000⌋}`, `P5 = 5kmN{5·⌊y/5000⌋}E{5·⌊x/5000⌋}`, and the district whose polygon is nearest to the centre (EPSG:3035).
2. **Median (assigned, not split):** `median(c)` = median of P1, else of P5, else of the district. `income_source` records which (`1km`, `5km`, `kreis`).
3. **Employees (split by population):** `employees(c) = employees(P1) × pop(c) / Σ pop(c')` over all 500 m cells *c'* in P1. The children of each 1 km cell add up to its count.
4. **Wage sum:** `wage_sum(c) = employees(c) × median(c)`, EUR per month, a purchasing-power proxy.

| Median source | 500 m cells | Residents |
|---|---|---|
| 1 km | 6,427 | 5.75 M |
| 5 km | 33,847 | 4.93 M |
| district | 8,800 | 0.41 M |

- Processed output: `data/processed/einkommen_500m_bw.json` (3.6 MB), columns `lat, lon, Einwohner, median_income, income_source, employees, wage_sum, cell_1km`

## Limitations

- Full-time employees only; part-time workers, self-employed and pensioners are not covered.
- The median of a coarser cell or district is an approximation for a sparse 500 m cell. A covariate model (e.g. random forest with neighbouring medians) could replace the 5 km and district fallback.
- A 1 km cell on the state border gives all its employees to its BW children, which slightly overcounts border cells.

## Usage in project

- Map layer "Median income (500 m)"
- Possible demand feature for the placement model (income is linked to EV ownership)
