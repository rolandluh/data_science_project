# data_science_project
Arun, Marko, Roland: Topic: tdb

## Topic 12: Optimizing the placement of EV charging stations (Baden-Württemberg)

Interactive web map to explore existing charging infrastructure, demand drivers and parking, as the basis for recommending new station locations.

## Project structure

```
app/                  Frontend (static HTML/JS, Leaflet + OpenStreetMap tiles)
  index.html, app.js, style.css
data/
  raw/                Downloaded source files (git-ignored)
  processed/          Files the map reads (git-ignored)
docs/                 Project outline
src/
  extract.py          Download and prepare all data
  run_pipeline.py     Empty placeholder for the full pipeline
  prepare.py, validate.py, analyze.py, evaluate.py   Empty placeholders
requirements.txt      Python packages
test.py               Scratch file
```

## Data

| Output in `data/processed/` | Content | Source |
|---|---|---|
| `ladesaeulen.json` | 18,863 charging stations in BW | Bundesnetzagentur Ladesäulenregister (1 Sep 2026) |
| `historie_bw.geojson` | 6,031 BW stations with live status | MobiData BW history, 18 Oct 2026 snapshot |
| `gemeinden_ev.geojson` | Cars, BEV and plug-in hybrids per municipality in BW | KBA FZ 27.17 and FZ 3.1 (1 Oct 2024), BKG VG250 outlines |
| `bevoelkerung_1km.json` | Population per 1 km cell in BW | Zensus 2022 grid |
| `parkplaetze_bw.geojson` | 5,882 off-street parking sites in BW | MobiData BW parking data |
| `kreise_bw.geojson`, `laender.geojson` | District and state outlines | BKG VG250 |

Raw files that are not yet used by the map: the KBA 5 km grid with the EV share (`kba_pkw_elektro_gitterzellen_2025.csv`), the KBA stock tables, and the weekly history files.

## How to run

1. Install the packages: `pip install -r requirements.txt`
2. Create the processed data: `python src/extract.py` (downloads the raw files if missing; the first run takes a while)
3. Start the map from the project root: `python -m http.server 8000`
4. Open http://localhost:8000/app/

The history download is separate and large (about 20 GB for all weeks in 2026). Run it only when needed: `download_historic_weeks()` in `src/extract.py`.

## Known limits

Optional electricity infrastructure: run `python src/extract_grid.py --district 08221`
for a Heidelberg pilot, or omit `--district` for Baden-Württemberg, then enable
the new map toggle. See [power-grid feature documentation](docs/power_grid_feature.md)
for setup, changes, distance methods, and data limitations. These distances
describe mapped proximity only; available capacity and connection cost are unknown.

- The map is checked for syntax and served correctly; layout and speed have not been verified in every browser.
- The Overpass API (OpenStreetMap queries) was unavailable during development, so OSM data is not used yet.
- Usage is a snapshot, not a session record: utilisation is estimated from charge-point status.
- The historic feed covers stations across Europe; the BW subset is biased toward networks with live feeds.
- Municipality car counts are from 1 Oct 2024 and spread evenly within municipalities for any finer analysis.

## Different ideas

Ideas raised during development, not yet implemented.

**Demand and placement**
- Simple demand model: EV cars per area × sessions per EV, minus the charging capacity within access distance; highest gap = candidate site.
- Machine learning: gradient-boosted regression of station utilisation on area features, validated with region-grouped cross-validation; clustering of areas as a first step.
- Scenario comparison: save input sets (radius, budget, objective) and compare the results side by side.

**Road network**
- Road length and share of major roads (motorway, trunk, primary) per cell or municipality.
- Distance from each cell to the nearest major road, for highway charging sites.
- Travel-time accessibility on a routing graph, instead of straight-line distance.

**Grid connection**
- Distance to the nearest substation or high-voltage line, from OpenStreetMap, as an indicative check for a clicked location.
- A real connection check would need grid-operator data (capacity, connection requests), which is not public.
- The check needs a backend server, which would need approval as a new library.

**Usage**
- Daily or weekly utilisation per station from the historic feed (charge points charging ÷ total).
- Validate the biased 6,031-station feed against the register by operator and location.
- Merge variant operator names (e.g. "EnBW mobility+" and "EnBW Ostwürttemberg") before analysis.

**Social factors and user inputs**
- Equity weight, favouring low-income or underserved areas.
- Share of residents without private parking, who usually cannot charge at home.
- Age focus, rural-versus-urban balance, commuter versus local charging.
- Target user groups: fleets, private drivers, visitors.
- Peak-time focus and a grid-capacity limit per site.
- Areas to avoid (e.g. protected zones) and phased rollout (stations per year).

**Map layers**
- 5 km EV-share layer from the KBA grid, shown beside the municipality counts.
- OpenStreetMap supermarkets and shopping areas (waiting for Overpass).
- On-street parking from OpenStreetMap `parking:lane` tags, which the MobiData download excludes.
- Area-weighted aggregation of the 5 km share to municipalities, as a cross-check.

**Data sources**
- Geofabrik Baden-Württemberg extract as a local OpenStreetMap file, which avoids the Overpass outages (needs approval for pyrosm).
- Mobilithek and daten.bw for further BW datasets.
