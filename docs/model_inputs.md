# Model Inputs

Data available for the charging station placement model. All files are in `data/processed/` unless noted otherwise.

The data is on disk, but the features listed here are not built yet.

## Existing supply

| Data | Usable features |
|---|---|
| `ladesaeulen.json` (18,863 rows) | Location, charge points, power (`Nennleistung`), fast vs slow, operator, `Inbetriebnahmedatum` |

Derived features: distance to the nearest charger and kW per area. `Inbetriebnahmedatum` also provides the validation split.

## Observed usage

| Data | Usable features |
|---|---|
| `historie_parquet/` (weeks 05–40) | Time-weighted occupancy per station, hourly and weekday profiles, out-of-order share |
| `historie_bw.geojson` (6,031 stations) | Station locations, operator, source, max power |

`historie_bw.geojson` is the join key between usage and location.

## Demand

| Data | Usable features |
|---|---|
| `bevoelkerung_1km.json` (21,926 cells) | Population per 1 km cell |
| `gemeinden_ev.geojson` (1,106 municipalities) | Car, BEV and PHEV counts, EV share per municipality |
| `data/raw/kba_pkw_elektro_gitterzellen_2025.csv` | EV share per 5 km cell |

The 5 km grid is raw only. It needs a Baden-Württemberg filter and processing.

## Destinations

Places where cars park for a while.

| Data | Usable features |
|---|---|
| `poi_osm_bw.geojson` (40,747 POIs) | POI count or distance per cell, by category: supermarket, retail, office, industrial, hospital, university |

Offices are half of all POIs, so weight the categories instead of using a plain count.

## Through traffic

| Data | Usable features |
|---|---|
| `strassen_osm_bw.geojson` (43,831 segments) | Distance to the nearest major road, road length per cell, road class, lanes, speed limit |
| `strassenpunkte_osm_bw.geojson` (1,512 points) | Distance to motorway junctions, rest areas and services |
| `verkehr_zaehlstellen_bw.geojson` (202 stations) | Average daily traffic per year, by station and road |
| `verkehr_monatlich.json` (10,639 rows) | Monthly traffic, weekday vs Sunday, heavy vehicles |

Traffic counts exist only at the stations, so traffic between them has to be estimated. See `docs/data_mobidata_bw_traffic.md`.

## Candidate sites

| Data | Usable features |
|---|---|
| `parkplaetze_bw.geojson` (28,475 sites) | Location, capacity, `capacity_charging`, fees, opening hours, max stay |
| `parkplaetze_osm_bw.geojson` (113,728 sites) | Location, access, capacity (21% filled), fee |

Exclude the 22,422 OSM sites tagged `access=private`.

## Infrastructure constraint

| Data | Usable features |
|---|---|
| `umspannwerke_osm_bw.geojson` (12,867 substations) | Distance to the nearest substation, by type and voltage (21% filled) |

This is a rough proxy for grid connection. It shows where substations are, not their spare capacity. Filter by type first: 6,100 are `minor_distribution` and 5,667 have no type.

## Aggregation and boundaries

| Data | Usable features |
|---|---|
| `kreise_bw.geojson`, `laender.geojson`, municipality outlines in `gemeinden_ev.geojson` | Results per district or municipality, equity checks, Baden-Württemberg filter |

## Still missing

- **Costs:** charger and grid connection costs, needed for the budget constraint.
- **Home-charging proxy:** no direct data yet for the parking-space correction. Zensus building data has not been checked.
