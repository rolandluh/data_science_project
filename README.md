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
  extract_traffic.py  Prepare traffic volumes
  run_pipeline.py     Empty placeholder for the full pipeline
  prepare.py, validate.py, analyze.py, evaluate.py   Empty placeholders
requirements.txt      Python packages
```

## Data

| Output in `data/processed/` | Content | Source |
|---|---|---|
| `ladesaeulen.json` | 18,863 charging stations in BW | Bundesnetzagentur Ladesäulenregister (1 Sep 2026) |
| `historie_bw.geojson` | 6,031 BW stations with live status | MobiData BW history, 18 Oct 2026 snapshot |
| `ev_anteil_5km_bw.geojson` | 1,563 5 km cells touching BW with the share of cars with electric drive (%) | KBA 5 km grid (`kba_pkw_elektro_gitterzellen_2025.csv`, added by hand) |
| `bevoelkerung_500m.json` | Population per 500 m cell in BW (Zensus 100 m cells summed) | Zensus 2022 grid |
| `einkommen_500m_bw.json` | 49,074 populated 500 m cells: median monthly gross wage at residence (1 km parent, else 5 km parent, else district), resident employees split by population, `wage_sum` = employees × median | Bundesagentur für Arbeit grid data (Dec 2024 / Dec 2025) and district table by place of residence (sheet 9.1, 31 Dec 2025) |
| `ev_bevoelkerung_500m_bw.json` | 49,074 populated 500 m cells with the parent 5 km EV share and `ev_index` = residents × share | KBA 5 km grid and Zensus 2022 |
| `parkplaetze_bw.geojson` | 5,882 off-street parking sites in BW | MobiData BW parking data |
| `kreise_bw.geojson`, `laender.geojson` | District and state outlines | BKG VG250 |
| `parkplaetze_osm_bw.geojson` | 113,728 parking sites in BW | OpenStreetMap (Overpass API) |
| `strassen_osm_bw.geojson` | 43,831 road segments in BW: motorway, trunk, primary | OpenStreetMap (Geofabrik extract) |
| `strassenpunkte_osm_bw.geojson` | 1,512 motorway junctions, rest areas and service areas in BW | OpenStreetMap (Geofabrik extract) |
| `poi_osm_bw.geojson` | 40,747 POIs in BW: supermarket, retail, office, industrial, hospital, university | OpenStreetMap (Geofabrik extract) |
| `umspannwerke_osm_bw.geojson` | 12,867 substations in BW, as a rough proxy for grid connection | OpenStreetMap (Geofabrik extract) |
| `verkehr_svz_bw.geojson` | 5,638 counting sites with 2024 traffic, shown on the map | Verkehrsmonitoring BW 2024 and SVZ station list |
| `auslastung_taeglich_bw.parquet` | Time-weighted occupancy per BW station and day (charging point-hours, occupancy, peak hour, session starts) | MobiData BW weekly history |
| `auslastung_bw.xlsx` | Readable report: daily, weekly, weekday profile, per station, station by week | Built from `auslastung_taeglich_bw.parquet` |

Raw files that are not used: the KBA stock tables (FZ3, FZ13, FZ27). The weekly history files feed the occupancy step but are not shown on the map.

Data source details: `docs/data_*.md` (one file per source) and `docs/data_sources_summary.md`.

## How to run

1. Install the packages: `pip install -r requirements.txt`
2. Create the processed data: `python src/extract.py` (downloads the raw files if missing; the first run takes a while)
3. Start the map from the project root: `python -m http.server 8000`
4. Open http://localhost:8000/app/

The history download is separate and large (about 20 GB for all weeks in 2026). Run it only when needed: `download_historic_weeks()` in `src/extract.py`.

## Known limits

- The map is checked for syntax and served correctly; layout and speed have not been verified in every browser.
- OSM data depends on volunteer mapping. Tags can be incomplete: only 21% of substations have a voltage, and 6,100 of the 12,867 are tagged `minor_distribution`.
- Usage is a snapshot, not a session record: utilisation is estimated from charge-point status.
- The historic feed covers stations across Europe; the BW subset is biased toward networks with live feeds. It covers only about a third of the stations in the register and over-represents larger networks, so utilisation estimates from it may not hold for smaller operators or for regions they serve.
- The historic data is used as it is (agreed with the supervisor). The feed switched to change-only deltas on 14 Aug 2026, 17:04, so occupancy is time-weighted per station rather than averaged over rows. Static `bnetza_api` rows (the cause of the week 38 anomaly) are dropped.
- In weeks 25–26 and 29–31 only about half the station-days reach 18 h of live status; the cause has not been checked.
- The EV share and income are published per 5 km and 1 km cell. Within a cell they are assigned evenly to all populated 500 m cells; only population varies at 500 m.
- Income covers full-time employees only. Sparse cells without a published median take the 5 km or district median.

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
- On-street parking from OpenStreetMap `parking:lane` tags, which the MobiData download excludes.
- Area-weighted aggregation of the 5 km share to municipalities, as a cross-check.

**Data sources**
- Mobilithek and daten.bw for further BW datasets.
