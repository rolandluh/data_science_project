# To-dos

**Deadlines:** 25 Nov 2026 interim presentation · 22 Jan 2027 submission · 29 Jan 2027 final presentation.
**Plan:** `notes and concepts/demand_estimation_v1.md` (§ = section there). **Limits:** `notes and concepts/demand_limitations_v1.md`.

## P0: now

- [ ] Interim presentation (plan and first steps). Include the coverage caveat: observed usage covers about half of register stations, favouring large operators and fast charging.
- [ ] Commit the analysis docs on `docs/analysis-plan` and open a PR.
- [ ] Decide how to scale predictions to future demand (discussion pending; limitation H4).

## P1: data before modelling

- [ ] Rerun `save_demand_gap_grid()`: `Wohnungen_nach_Gebaeudetyp_Groesse.zip` and `nachfrage_luecke_500m_bw.json` are missing on this machine (the supply-gap baseline needs them).
- [ ] Download the Zensus 2022 grids: average age, ownership rate, household size, share 65+ and under 18, living space per person (optional: net rent). Check the resolution per file.
- [ ] OSM re-extracts from the local PBF: rail stations and P+R (`park_ride=yes`); leisure and tourism POIs; local roads (secondary, tertiary, residential); fuel stations, fast food and restaurants along roads (DC context; not in the v1 feature list yet). Confirm discounters are tagged `shop=supermarket` with a brand.
- [ ] Cost list with sources (the budgets depend on it): hardware and installation per AC point (11 / 22 kW) and DC point (50 / 150 kW / HPC), grid connection, civil works, annual O&M, subsidies. One parameter file, each value marked sourced or assumed.

## P1: site table and features (`src/prepare.py`)

- [ ] Match feed stations to register rows within 50 m. The opening date is the earliest date at the site; flag batch-registered and company or dealer sites.
- [ ] Merge stations into 50 m sites; split mixed sites into AC and DC parts.
- [ ] Parking-feature check: the share of training sites that match a combined-parking spot within 50 m. If the share is low, drop the parking features or derive them the same way for sites and candidates.
- [ ] Site target table: mean occupancy, saturation share, valid days, station age.
- [ ] Operator groups (6, by the data rule in §4).
- [ ] One feature function for sites, candidates and 500 m cells, with a unit test for train / score consistency.
- [ ] Split config: 2 km blocks (re-checked by distance matching), new-site test (1 Jul cut), 5 repeats.

## P1: model and validation (`src/analyze.py`, `src/evaluate.py`, `src/validate.py`)

- [ ] RF regressor with nested block-CV tuning (pin the scikit-learn version); final model refit on all sites.
- [ ] Baselines: random, supply gap, kNN.
- [ ] Metrics per AC and DC: Spearman, top-20% AUC, lift@k, decile plot. Also by operator group and size class.
- [ ] Combined new-site test, scored once.
- [ ] Error-vs-distance plot, which sets the "Low confidence" threshold. Also flag candidates near operator types absent from the feed.
- [ ] Feed-vs-register diagnostic as an automated report: redo with full-year coordinates (weekly parquet files), per Kreis; check rural coverage and what the ≥ 14-day filter drops.
- [ ] Sensitivity checks: sizing target percentile (50th / 75th / 90th), block size.
- [ ] Settle the open items in §10: ramp-up filter, √days weights, batch sites, 923 unmatched stations, tie-breaker thresholds.
- [ ] Moran's I on the residuals (§11).
- [ ] Decide where the optimizer runs (browser or `serve.py`) before app work starts.

## P2: hand-off, optimizer, map

- [ ] Sizing lookup table and saturation rule (§5).
- [ ] AC/DC context rule (§6). Extract built-up areas only if the primary-road rule must be restricted.
- [ ] Precompute predictions for parking candidates (~117k) and 500 m cells (~49k) into `data/processed/`.
- [ ] Greedy optimizer (deliberately simple): area filter, separate AC and DC € budgets, spacing rule.
- [ ] Optimizer unit tests, built alongside: budget never exceeded, spacing respected, AC and DC kept apart, empty area handled.
- [ ] Optimizer checks: sensitivity of the spacing distance; the picks' distance to the nearest station.
- [ ] Value assumptions for the energy and returns display: delivered kW per class, price and energy cost per kWh, lifetime, discount rate.
- [ ] Map: recommendation layer with budget and cost controls, cell heatmap, overused-stations layer.
- [ ] Usability check with non-technical users.

## P2: course requirements

- [ ] Single entry point (`src/run_pipeline.py`) with error handling and output plausibility checks; decide the retraining cadence (§11).
- [ ] Host the app on bwCloud.
- [ ] README with run order and architecture.
- [ ] Move final decisions into `docs/analysis_plan.md` (still a skeleton); update the stale `docs/project_outline.md` and the summary at the top of `Analysis Q&A.md`.
- [ ] 3-minute video, 3-sentence summary, final presentation.
- [ ] Clear per-person commit history (grading is individual).

## P3: if time is left

- [ ] Find out why only about half of station-days are valid in weeks 25–26 and 29–31.
- [ ] Update the VG250 boundaries (from 2020; municipal mergers may break joins).
- [ ] Optimizer validation: compare greedy with an exact solver on a small area; check picks against sites built since.
- [ ] Future additions: see §12 of the v1 record (includes the supply decay rule and usage per euro).
