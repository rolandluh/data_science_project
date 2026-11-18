# Problems and solutions log

This log lists the problems we ran into during the project (14 Oct – 11 Nov 2026) and how each one was solved. It is built from the session transcripts, the continuation summaries and the git history. File names are relative to the repository root. Where a problem is still open, the table says so.

## 1. Data download and pipeline



| Problem | Solution | Files changed |
|---|---|---|
| The Overpass API returned 502/504 errors (and mirrors 500), which blocked charging stations, supermarkets and parking from OSM. | Charging stations now come from the Bundesnetzagentur CSV. OSM data (parking, roads, POIs, substations) is read from the Geofabrik BW extract (`.osm.pbf`, about 650 MB) instead of the API. | `src/extract.py` |
| Parking download contained points outside BW (the bounding box is larger than the state). | Spatial join (`within`) against the BW polygon. Result: 9,189 → 5,882 sites. | `src/extract.py` |
| Street parking file `park-api_car.csv` could not be deduplicated by `name` (24k+ street spots share names, only 7,806 survived). | Deduplicate by `FID`; 31,783 remain after dedup, 28,475 after the BW filter. | `src/extract.py` |
| The `ON_STREET` parking spots were missing from the pipeline. | Street parking added to `save_parking()`. | `src/extract.py` |
| Re-running the pipeline regenerated outputs that already existed (data folder is shared separately). | Every `save_*()` function now skips if its output exists. | `src/extract.py`, `CLAUDE.md` |
| MobiData and OSM parking were two separate layers with overlapping sites. | `save_combined_parking()`: OSM as base, MobiData joined with `sjoin_nearest` within 10 m, unmatched MobiData sites appended, one toggle on the map. | `src/extract.py`, `app/app.js`, `app/index.html`, docs |
| The traffic data (monthly values for 2022–2026) was not used, but README said it was. | Only the 2024 zip is used. Old traffic data and `save_traffic` were deleted; README and docs corrected. | `src/extract_traffic.py`, `README.md`, docs |
| Median income was missing for many 500 m cells (a median is only published for at least 500 employees). | Fallback chain: 1 km cell → 5 km cell → district (Kreis) median from the BA table. | `src/extract.py` (`save_income_population_grid`) |
| The weekly history download failed or stalled on large files; the comparison job stopped on low memory (weeks 202631–202640 not analysed). | The missing week 202610 was converted separately with a chunked (streaming) script; the conversion was meant to move into `src/` so it can be automated. The comparison was finished afterwards and the report updated. | `src/` (conversion script), `docs/comparison_report_historic_mobidata.md` |
| Windows console errors: `UnicodeEncodeError` on `→` (cp1252), `ModuleNotFoundError` for pyarrow, geopandas and openpyxl with `python -I`. | Replaced the arrow with "to"; ran scripts without `-I` (isolated mode hides user-site packages). | scripts only |
| `gh` not installed or logged in, so PRs could not be created from the terminal. | PRs are created through the GitHub connector (`gh auth login` is still not done). | none |

## 2. Data interpretation and quality

| Problem | Solution | Files changed |
|---|---|---|
| Tübingen showed about 41,000 cars on the map but over 100,000 in the KBA sheet. | The sheet block sums the whole Zulassungsbezirk (about 131k), not the city (41,267, which matched the map). Explained; municipality counts later replaced by the KBA 5 km grid share. | none |
| The first KBA sheet parse mapped columns wrongly (A was assumed to be "Land"). | Columns re-mapped with `iloc[:, 1:10]` and forward fill on the registration district. | `src/extract.py` |
| The historic file was thought to be BW only, but it is Europe-wide. | Filter on BW location: 6,031 of 43,679 stations. The register has 18,863 BW stations. | `src/extract.py` (`save_historic_stations`) |
| Historic file size dropped to about 1/10 from week 34 on. | Not data loss: the platform doubled the polling interval and switched to change-only deltas (14 Aug 2026, 17:04). Decision with the supervisor: use the data as it is, no special handling. Documented. | `docs/comparison_report_historic_mobidata.md`, `CLAUDE.md` |
| Parquet files were larger in total than the raw gzip CSVs. | Cause: all columns are stored as strings. Left as it is on purpose (supervisor decision); documented. | `CLAUDE.md` |
| Plain row averages gave wrong occupancy (idle stations write no rows after week 34; first full run also treated weeks 5–33 as deltas and counted 19,000 static register stations). | Time-weighted occupancy: each row is a status that holds until the next row; `bnetza_api` register dumps dropped; unknown-only stretches count as no data; switch detected against the median of the last 100 snapshots. | `src/extract_occupancy.py` |
| "Charging point-hours per day" showed 385, more than 24. | It is summed over all charging points of a station, not a single point. Explained in the workbook notes. | `src/extract_occupancy.py` (workbook) |
| Only about a third of stations appear in the history feed, biased towards larger networks. | Documented as a limitation. A later check showed about 57 % of register rows have a feed station within 100 m, so the "third" compares different units. | `README.md`, `docs/data_sources_summary.md` |
| Week 38 anomaly (102k stations, 1,404 min gap). | Used as it is (supervisor decision); the 102k rows are static register dumps and are dropped for occupancy. | `CLAUDE.md` |

## 3. Map and web app

| Problem | Solution | Files changed |
|---|---|---|
| The map was slow with many markers. | Station markers are `circleMarker`s on a canvas renderer with clustering; large layers (population, EV, income, gap, OSM points) load on first use. | `app/app.js` |
| The population heatmap was all red from the start. | More transparent colours; heatmap only between zoom 9 and 19; zoom level shown bottom-right and a zoom slider added. | `app/app.js`, `app/style.css`, `app/index.html` |
| Too many layers at once. | Every layer got an on/off switch (side panel); all switches are now off by default. | `app/index.html`, `app/style.css`, `app/app.js` |
| The legend showed entries for layers that were off. | The legend renders only the entries whose switch is on and hides itself when all are off. | `app/app.js` |
| Charts in the HTML slides did not render. | Chart.js CDN returned 404, so it is bundled locally (`docs/chart.min.js`); charts are created lazily when their slide first becomes active. | `docs/data_sources_presentation.html`, `docs/chart.min.js` |
| Large grids hid the stations when they finished loading late. | Grids are sent to the back (`bringToBack`); points stay on top. | `app/app.js` |
| Everything outside BW distracted from the study area. | Grey mask over the rest of the map (own pane below data layers, ignores clicks). | `app/app.js` |
| Station clusters kept hiding single stations at high zoom. | `disableClusteringAtZoom: 14`. | `app/app.js` |
| Station layers looked inconsistent: "Register + historic" was not clearly a join. | Explained as three parts of a full outer join without duplicates (register only, matched, historic only), matched within 50 m. | `app/app.js` (`matchHistoric`) |
| Popup showed "undefined" for the station count. | The browser had cached the old data file. Hard reload (Ctrl+F5) fixes it; the code and file were correct. | none |
| Browser/server tasks left running (`python -m http.server`), one killed by the system on low memory. | Servers are stopped after each check. | none |

## 4. Demand model

| Problem | Solution | Files changed |
|---|---|---|
| The EV index was meant to be spread by population, but looked like "5 km share × population". | Clarified: it is the same thing. Spreading the 5 km EV count by population gives share × residents × constant, so the map pattern is identical. The unit is "residents × share", not real EVs. | none |
| All 100 cells of a 5 km cell have the same EV share. | Not a bug: share is a rate, the index differs per cell through residents. Limitation noted: adoption differences show only between 5 km cells. | docs |
| Overlaying stations on the demand grid did not show where to build. | New supply-gap layer: public EV demand within 1.5 km divided by charging points within 1.5 km (no point in reach counts as one). | `src/extract.py` (`save_demand_gap_grid`), `app/app.js`, `app/index.html` |
| "22 charging points within 1.5 km" looked wrong in Schluchsee (4 dots on the map). | The number was right: 10 stations with 26 points, 7 of them at the same hotel coordinates and drawn on top of each other. The popup now shows both stations and points. | `src/extract.py`, `app/app.js` |
| The gap was too high in remote residential areas, where people charge at home. | Home-charging correction from Zensus 2022 dwellings by building type: public demand = EV index × (1 − rate × share of 1–2-family dwellings). | `src/extract.py`, `CLAUDE.md` |
| The home-charging rate 0.8 was only an assumption. | Calibrated against the occupancy of 3,909 AC stations (partial rank correlation, bootstrap, regression, north/south hold-out). Result: 0.9. The 0.8–1.0 range is weakly identified. | `src/sensitivity_home_charging.py`, `docs/sensitivity_home_charging_rate.md`, `src/extract.py` |

## 5. Git and GitHub

| Problem | Solution | Files changed |
|---|---|---|
| Push rejected (remote had new commits) and PR #8 had add/add conflicts with main. | Merged `origin/roland_branch`, resolved by taking the branch versions, removed the re-added root `project_outline.md`. | merge commits |
| PR #8 showed as closed; changes not visible in VS Code Source Control. | PR reopened; explained that committed changes show only as diffs against main. Later cleaned up the branch and stash state. | none |
| `CLAUDE.md` looked unmodified because it was git-ignored. | Un-ignored; `CLAUDE.md` is now checked in. | `.gitignore`, `CLAUDE.md` |
| `data/` in `.gitignore` blocked staging processed files. | Only code is committed; `data/` is shared separately. | none |
| `.playwright-mcp/` (screenshots) showed up as untracked. | Added `.playwright-mcp/` and `.agents/` to `.gitignore`. | `.gitignore` |
| Pushed commits to a branch whose PR was already merged (#12, #14, #17). | Always check the PR state before pushing; commits after a merge go on a fresh branch from main and a new PR. | none |
| Branch protection requires signed commits, but local commits are not signed. | Open: a squash merge on GitHub signs the commit itself. | none |

## 6. Tooling and setup

| Problem | Solution | Files changed |
|---|---|---|
| "Stop hook error: Failed with non-blocking status code: [eval]:1" at every session start. | Attempted fixes: `claude plugins update ecc` and the settings issues found by `claude doctor`. The transcripts do not show whether the error is gone for good. | Claude Code settings (outside the repo) |
| The Obsidian MCP connection did not work (HTTPS/certificate, Claude Desktop needs `mcp-remote`). | Tried several configurations, then removed the Obsidian MCP; notes are updated by a hook instead. The server still fails to connect at session start (`ECONNREFUSED`). | Claude Code settings (outside the repo) |
| My own wrong statements during review had to be corrected (coverage "about a third", `static_count` advice, "district fallback is in PR #17"). | Corrected with the facts from the data and the PR state. | none |

## Still open

- Commit signing is not configured locally (see section 5).
- `gh auth login` has not been done.
- The occupancy feed covers only part of the stations; the occupancy-based calibration explains little of the variance (R² ≈ 0.07).
- The supply-gap layer ignores stations outside BW and weighs all charging points equally (no kW weighting).
- Destination (POI) and corridor (traffic) demand are not yet part of the demand model.
