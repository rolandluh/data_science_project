# Electricity infrastructure and parking proximity

Implemented 20 October 2026 on `codex/power-grid-layer`.

## What changed

- `src/extract_grid.py` downloads OpenStreetMap power assets through Overpass,
  caches successful responses, validates geometry, and produces
  `data/processed/stromnetz_bw.geojson`.
- `app/index.html`, `app/style.css`, and `app/app.js` add an optional electricity
  layer, coverage/download status, asset popups, and parking proximity details.
- The existing static server is sufficient. No browser-side Overpass calls,
  API credentials, or new Python packages are required.

The original checkout could not create a branch because Windows denied Git
metadata writes. Implementation therefore uses a separate working copy in the
Codex task workspace. No changes have been committed or pushed to main.

## Source and interpretation

Source: https://www.openstreetmap.org/copyright
Query endpoint: https://overpass-api.de/api/interpreter
Geometry documentation: https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL
Classification: https://wiki.openstreetmap.org/wiki/Power_networks/Guidelines/Substations

This is incomplete community-mapped infrastructure, not a grid operator's
capacity or connection database. Missing objects mean unknown coverage.
Distance does not determine construction cost, available capacity, access
rights, or whether a charger can connect. An operator assessment is needed.
OSM attribution is displayed in the map; retain ODbL licensing information when
redistributing derived data.

Distribution assets require an explicit `substation=distribution`,
`substation=minor_distribution`, or `transformer=distribution` tag.
Unclassified, industrial, traction and transmission stations are displayed
separately and are not silently treated as local distribution assets.
The line distance includes all mapped voltages and is contextual information,
not a suggested connection point.

## Download and processing

From the project root, after the existing data extraction:

```powershell
python src/extract_grid.py --district 08221
```

This is a Heidelberg pilot. For statewide coverage:

```powershell
python src/extract_grid.py
```

Use `--refresh` to request a new snapshot. The scope and query are reflected in
the raw cache key. Large statewide requests may exceed Overpass limits; the
script retries three times and retains the previous processed file on failure.
For repeated failures, use smaller study areas or implement a Geofabrik PBF
input rather than repeatedly retrying public servers.

On this computer, Python is at `C:\Users\apexp\anaconda3\python.exe`.
GeoPandas dependencies currently live in the original repository's
`.python-packages` directory; set `PYTHONPATH` to that directory if using this
existing setup. A normal environment installed from `requirements.txt` needs
no such override.

The boundary comes from the existing district/state GeoJSON. A 5 km surrounding
buffer reduces edge effects. Distances are only to assets found in that search
area and are not guaranteed to be globally nearest.

Points, cable/line geometry, closed substation polygons and polygonized
substation relations are preserved. Invalid or unreconstructable geometry is
skipped and counted. Unique OSM type/id references remove duplicate query
elements; distinct mapped transformers within a substation remain distinct.

Distances use `geopandas.sjoin_nearest` in EPSG:25832 (ETRS89 / UTM zone 32N).
They measure straight-line distance to the whole geometry, not to a bounding-box
centre. Ties are resolved by OSM reference. Parking records are matched to
precomputed results using coordinates rounded to six decimals. Co-located
parking records consequently share the same distances.

## Output and UI behavior

The GeoJSON includes `metadata` and `parking_proximity` foreign members.
Metadata records query scope, download time, OSM snapshot time, asset count,
parking count, skipped geometry count and distance CRS. Layer geometry and
proximity values are written together via an atomic file replacement.

The toggle starts off. Teal represents explicitly classified distribution
assets, grey other stations, and brown lines/cables. Parking popups show:

- distance and reference of the nearest mapped distribution asset;
- distance and reference of the nearest mapped line/cable;
- unknown capacity and the need for operator assessment.

Parking outside the processed scope shows an explicit coverage message.
Missing data disables the toggle and leaves the existing map usable.

## Validation and remaining work

Run `python -m unittest discover -s tests -p "test_grid.py"`.
Tests cover line-versus-centre distance, classification, polygon holes, empty
candidate sets, and deterministic nearest-neighbor ties.

Actual download results are recorded in the generated dataset's metadata.
No capacity model, connection-price estimate, or ML ranking was introduced.
Before statewide analytical use, inspect local coverage and compare results
with/without these features. Future model evaluation should use geographically
separated validation regions.
