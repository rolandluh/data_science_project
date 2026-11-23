# Concept mock-up: EV charging site recommender

A clickable mock-up of the final product: the inputs a CPO sets (`notes and concepts/user_input.md`) and the outputs the tool returns, on our real processed data. **The model results are synthetic.** Every input, output, layer and the optimizer has an ⓘ info point that explains in 2–3 sentences how the real product will do it, with a reference to the decision record (`notes and concepts/demand_estimation_v1.md`).

It also defines the **data contract** between pipeline and app: the real pipeline only has to write the same files with real values (see [Data files](#data-files)).

## Run

```bash
python src/mockup_data.py   # writes data/processed/mockup/*.json (about 40 s; needs the processed files from src/extract.py)
python src/serve.py         # http://localhost:8000/mockup/
```

`src/mockup_data.py` follows the pipeline pattern: each `save_*()` skips if its output exists. Delete a file (or the whole `data/processed/mockup/` folder) to regenerate it. It needs geopandas, scikit-learn and pyarrow (all in `requirements.txt`). If a file is missing, the page says so and shows the command to run.

## What is real, what is synthetic

| Part | Status | Source / rule |
|---|---|---|
| Candidate sites (115,102) | real | `parkplaetze_kombiniert_bw.geojson`, without `access` = private / no / permit; inside a BW Kreis |
| Kreis of each candidate | real | spatial join with `kreise_bw.geojson` |
| AC/DC type per candidate | real data, v1 rule (§6) | DC if within **300 m** of a motorway junction, rest area or services (`strassenpunkte_osm_bw`), within **25 m** of a primary road (`strassen_osm_bw`, `highway=primary`), or within **100 m** of a supermarket (`poi_osm_bw`); else AC. Result: 13.8 % DC. Supermarket tie-breakers (§6) are not applied. |
| Low-confidence flag | real data, simplified rule | nearest live-feed station (`historie_bw.geojson`) more than **2 km** away (12.9 % of candidates). The real flag also checks features outside the training range (§7). |
| Features shown per pick | real | residents within 1 km (Zensus 500 m cells), OSM destinations within 500 m, distance to the nearest major road |
| Existing stations layer | real | `ladesaeulen.json` (register, 1 Sep 2026) |
| Overused stations layer | real | `auslastung_taeglich_bw.parquet`: valid days only, stations with ≥ 14 valid days; full day = `peak_hour_occupancy` ≥ 0.999; overused = share of full days above the class target; locations from `historie_bw.geojson` (5,069 stations, 1,292 overused) |
| Sizing lookup table and targets | real | same stations; median share of full days by AC/DC (≥ 50 kW = DC), point-count class (2 / 4 / 6 / 8 / 10+) and occupancy bin (0–5–10–15–20–25–30–40–100 %). Targets = 75th percentile: **AC 30.9 %, DC 4.7 %** of days |
| Supply trend | real | register commissioning dates: **5,860 points added per year** (mean 2023–25); 35,202 points today |
| Occupancy cap for scenarios | real | 99th percentile of today's station occupancy (AC 0.54, DC 0.39) |
| **Predicted occupancy per candidate** | **synthetic** | score = weighted z-scores of real features (residents, destinations, closeness to a major road, motorway bonus for DC) + noise; its rank is mapped onto today's observed occupancy distribution of the class (1st–99th percentile), then shrunk 40 % toward the mean (RandomForest predictions are compressed). Weights in `SYNTHETIC_WEIGHTS`. |
| **Expected usage of 500 m cells** | **synthetic** | same formula (AC weights) at the Zensus cell centres |
| **Kreis factors 2030 / 2035** | **synthetic** | random per Kreis (seeded): 2030 in 0.9–1.35, 2035 = 2030 × 1.05–1.25, capped at 1.6 |
| **Cost and value defaults, default budgets** | **assumed** | placeholders in `DEFAULTS` in `src/mockup_data.py`; the cost list in `todos.md` will replace them |

All tunable values are at the top of `src/mockup_data.py` and are also written into the `meta` block of the file they shape.

## What the page does

- **Inputs:** strategy (Usage active; Coverage and Mix shown as planned), area (radius by map click + km, or one or more Landkreise from the list or by clicking the map), charger type, budget (simple: € per type; detailed: cost components per type, with reset), year (Today / 2030 / 2035). Advanced (collapsed): max points per site, spacing per type, points override per pick (in the results list), value assumptions, hide low-confidence candidates.
- **Optimizer (§9), per type, on every input change:** keep candidates of the type in the area → scenario occupancy = min(occupancy × Kreis factor, cap) → rank by point-hours per day (occupancy × 2 × 24) → skip a candidate within the spacing distance of an earlier pick of the same type (default AC 500 m, DC 3 km) → size it (§5) → add its site cost if it fits the remaining budget; stop when no site fits. A candidate that doesn't fit is skipped and cheaper ones further down still get a chance.
- **Sizing (§5):** try n = 2, 4, 6 … up to the cap (8 AC / 12 DC); occupancy at n points = occupancy × 2 / n; pick the smallest n whose looked-up share of full days is at or below the class target. The user can override n per pick.
- **Site cost:** grid connection + civil works − subsidy + cost per point × n.
- **Outputs:** numbered picks on the map and a ranked list per type with hours per point per day, site point-hours, points, site cost and the low-confidence tag; details per pick with energy (MWh/year) and returns (yearly margin, NPV, payback) as labelled estimates; budget summary per type.
- **Layers:** candidates in the area, expected usage of 500 m cells (synthetic), overused stations (real), existing register stations (real).
- **Speed:** about 5–20 ms for the optimizer in a 15 km radius (~14k candidates) and about 70 ms for all of BW. The list and numbered markers stop at rank 200; further picks are drawn as dots.

## Simplified or left out

- The **AC/DC rule** has no supermarket tie-breakers and no restriction of primary roads to outside built-up areas (both still open in §10).
- **Low confidence** uses distance to the nearest feed station only, not the error-vs-distance threshold or feature ranges (§7).
- **Subsidy** is € per site only (no % option).
- The **usage layer** shows today; it does not scale with the year.
- No address search for the radius centre (map click only).
- Spacing uses straight-line distance; features and competition don't change with picks (as in v1).
- The sizing lookup fills sparse cells (< 10 stations) from the next smaller point class, then the lower occupancy bin, and is made monotone (more occupancy → full more often; more points → full less often).

## Data files

All files are in `data/processed/mockup/` (git-ignored). Tables use the same `{columns, rows}` layout as `ladesaeulen.json`; each file has a `meta` block (`generated`, `source`, `synthetic` = list of synthetic fields, plus the parameters used). **To go live, the pipeline writes the same files with real values** and removes the field names from `meta.synthetic`; the banner and tags can then be dropped.

### `candidates.json`
```
meta:    { generated, source, synthetic: ["occ"], excluded_access, dc_rule_m: {motorway, primary_road, supermarket},
           low_confidence_m, synthetic_weights, synthetic_noise, synthetic_shrink, seed }
kreise:  [ { ags: "08111", name: "Stuttgart", type: "Stadtkreis" }, ... ]      # index = row.kreis
columns: [ id, lat, lon, kreis, type, occ, low_conf, feed_m, dc_reason,
           residents_1km, destinations_500m, major_road_m, parking, source ]
```
| Column | Type | Meaning |
|---|---|---|
| `id` | int | candidate id (row index) |
| `lat`, `lon` | float | EPSG:4326, 5 decimals |
| `kreis` | int | index into `kreise` |
| `type` | "AC" / "DC" | from the context rule (§6) |
| `occ` | float 0–1 | **predicted mean occupancy per point at 2 points** (model output; synthetic here) |
| `low_conf` | 0 / 1 | low-confidence flag (§7) |
| `feed_m` | int | metres to the nearest feed station |
| `dc_reason` | string | `motorway`, `primary road`, `supermarket` or empty (AC) |
| `residents_1km` | int | Zensus residents within 1 km |
| `destinations_500m` | int | OSM destinations (supermarket, retail, office, industrial, hospital, university) within 500 m |
| `major_road_m` | int | metres to the nearest motorway / trunk / primary road (capped at 5,000) |
| `parking` | string | OSM `parking` tag (surface, street_side, underground, …) or empty |
| `source` | string | `osm`, `mobidata` or `osm+mobidata` |

### `cells.json`
`columns: [lat, lon, occ]`: 500 m Zensus cell centres; `occ` = expected occupancy of a typical (AC) station there (synthetic).

### `stations.json`
`columns: [lat, lon, points, kw, operator, city]`: register stations in BW.

### `overused.json`
`meta.targets: {AC, DC}`, `meta.min_valid_days`, `meta.full_hour_threshold`;
`columns: [id, lat, lon, type, full_share, occ, days, overused, name, operator]`: one row per feed station with ≥ 14 valid days; `full_share` = share of valid days with a fully occupied hour; `overused` = 1 if above the class target.

### `sizing.json`
```
reference_points: 2
size_steps: [2, 4, 6, 8, 10, 12]
point_classes: ["2", "4", "6", "8", "10+"],  point_class_edges: [2.5, 4.5, 6.5, 8.5]
occ_bin_edges: [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 1.01]
target_percentile: 0.75,  targets: { AC: 0.3089, DC: 0.0473 },  max_points: { AC: 8, DC: 12 }
full_share:     { AC: [[...8 bins] x 5 point classes], DC: [...] }   # median share of full days
station_counts: { AC: [...], DC: [...] }                              # stations per lookup cell
```

### `scenarios.json`
```
years: [2030, 2035]
occ_cap: { AC, DC }                                   # scenario occupancy is capped here
supply: { points_today, added_per_year, trend_years } # register trend (real)
factors: { "<AGS>": { "2030": f, "2035": f } }        # demand growth / supply growth per Kreis (synthetic)
```

### `defaults.json` (assumed)
```
budget_eur: { AC, DC }
cost:  { AC: { per_point, grid_per_site, civil_per_site, subsidy_per_site, om_per_point_year }, DC: {...} }
value: { AC: { delivered_kw, price_eur_kwh, energy_cost_eur_kwh }, DC: {...}, lifetime_years, discount_rate }
spacing_m: { AC, DC },  max_points: { AC, DC },  area: { mode, center: [lat, lon], radius_km }
```

### Info texts
`mockup/explain.json`: one entry per info point, `{ title, text, ref }` (`limits` has `items` instead of `text`). Keys match the `data-info` attributes in `index.html` and `mockup.js`.

## Files

- `mockup/index.html`, `mockup/mockup.css` (only additions on top of `../app/style.css`), `mockup/mockup.js` (ES module; reuses `app/js/util.js`, `status.js`, `errorlog.js`), `mockup/explain.json`
- `src/mockup_data.py`: data generator
