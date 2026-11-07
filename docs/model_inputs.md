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
| `bevoelkerung_500m.json` (49,074 cells) | Population per 500 m cell (Zensus 100 m cells summed) |
| `ev_anteil_5km_bw.geojson` (1,563 cells) | Share of cars with electric drive per 5 km cell (%) |
| `ev_bevoelkerung_500m_bw.json` (49,074 cells) | Parent 5 km EV share per populated 500 m cell; `ev_index` = residents × share / 100. Each 500 m cell lies fully inside one 5 km cell, so no area split is needed |
| `einkommen_500m_bw.json` (49,074 cells) | Median monthly gross wage at residence (`median_income`, from the 1 km parent, else the 5 km parent, else the district, see `income_source`), resident employees split by population (`employees`), `wage_sum` = employees × median |

The BA publishes a median only for cells with at least 500 employees; 0 in the raw file means "not published". 8,800 cells (406k residents) have neither a 1 km nor a 5 km median and take their district median (BA table by place of residence, sheet 9.1 of `entgelt_kreise_wohnort_202512.xlsx`). The district table also confirms the grid covers full-time employees of the core group only: both add up to 21.45 M for Germany.

Cells marked `-` by the KBA (267 in Germany, 7 in BW) have no published value and are stored as no data.

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
| `verkehr_svz_bw.geojson` (5,638 sites) | Traffic in 2024 on motorways, federal, state and county roads: all vehicles, cars and vans, heavy vehicles, day types |

Traffic counts exist only at the counting sites, so traffic between them has to be estimated. See `docs/data_mobidata_bw_traffic.md`.

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
