"""Download mapped grid assets and calculate parking proximity (not capacity).

Run from the repository root. --district 08221 is a small Heidelberg pilot;
omit --district for Baden-Württemberg. Existing successful raw queries are cached.
"""
import argparse
import hashlib
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import geopandas as gpd
from shapely.geometry import Point, LineString, Polygon
from shapely.ops import polygonize, unary_union

ENDPOINT = "https://overpass-api.de/api/interpreter"
ROOT = Path("data")


def geometry(element):
    """Preserve lines and areas; never substitute bounding-box centres."""
    if element["type"] == "node":
        return Point(element["lon"], element["lat"])
    if element["type"] == "way":
        coords = [(p["lon"], p["lat"]) for p in element.get("geometry", [])]
        if len(coords) < 2:
            return None
        if element.get("tags", {}).get("power") == "substation" and len(coords) >= 4 and coords[0] == coords[-1]:
            return Polygon(coords)
        return LineString(coords)
    outer, inner = [], []
    for member in element.get("members", []):
        coords = [(p["lon"], p["lat"]) for p in member.get("geometry", [])]
        if len(coords) >= 2:
            (inner if member.get("role") == "inner" else outer).append(LineString(coords))
    polygons = list(polygonize(outer))
    if not polygons:
        return None
    result = unary_union(polygons)
    holes = list(polygonize(inner))
    return result.difference(unary_union(holes)) if holes else result


def category(tags):
    if tags.get("power") in ("line", "minor_line", "cable"):
        return "line"
    if tags.get("substation") in ("distribution", "minor_distribution") or tags.get("transformer") == "distribution":
        return "distribution"
    return "other_station"


def nearest(parking, targets):
    """Distances in ETRS89 / UTM 32N metres, to full geometry."""
    if targets.empty:
        return {}
    joined = gpd.sjoin_nearest(
        parking[["geometry"]].to_crs(25832),
        targets[["osm_ref", "voltage", "geometry"]].to_crs(25832),
        how="left", distance_col="distance_m",
    )
    # Deterministic tie handling (e.g. overlapping objects).
    joined = joined.sort_values(["distance_m", "osm_ref"]).groupby(level=0).first()
    return {
        int(i): {"distance_m": round(float(row.distance_m), 1),
                 "osm_ref": row.osm_ref, "voltage": row.voltage}
        for i, row in joined.iterrows()
    }


def run(district=None, refresh=False):
    boundary_file = ROOT / "processed" / ("kreise_bw.geojson" if district else "laender.geojson")
    boundaries = gpd.read_file(boundary_file)
    selected = boundaries[boundaries.AGS == (district or "08")].to_crs(4326)
    if selected.empty:
        raise ValueError("No matching boundary; use a five-digit BW district AGS.")
    boundary = selected.geometry.union_all()
    west, south, east, north = boundary.bounds
    # Small buffer avoids artificial edge effects for parking near a boundary.
    buffered = selected.to_crs(25832).geometry.union_all().buffer(5000)
    query_boundary = gpd.GeoSeries([buffered], crs=25832).to_crs(4326).iloc[0]
    west, south, east, north = query_boundary.bounds
    query = f"""[out:json][timeout:180];
    (nwr["power"~"^(substation|transformer)$"]({south},{west},{north},{east});
     way["power"~"^(line|minor_line|cable)$"]({south},{west},{north},{east});
     node["power"="pole"]["transformer"="distribution"]({south},{west},{north},{east}););
    out geom;"""
    cache = ROOT / "raw" / "grid" / (hashlib.sha256(query.encode()).hexdigest()[:16] + ".json")
    cache.parent.mkdir(parents=True, exist_ok=True)
    if refresh or not cache.exists():
        request = urllib.request.Request(
            ENDPOINT, data=urllib.parse.urlencode({"data": query}).encode(),
            headers={"User-Agent": "BW-EV-research-grid/1.0"},
        )
        for attempt in range(3):
            try:
                with urllib.request.urlopen(request, timeout=210) as response:
                    payload = json.load(response)
                if payload.get("remark") or "elements" not in payload:
                    raise ValueError(f"Incomplete Overpass response: {payload.get('remark')}")
                payload["_retrieved_at"] = datetime.now(timezone.utc).isoformat()
                temporary = cache.with_suffix(".tmp")
                temporary.write_text(json.dumps(payload), encoding="utf-8")
                temporary.replace(cache)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(5 * (attempt + 1))
    payload = json.loads(cache.read_text(encoding="utf-8"))
    records, seen, skipped = [], set(), 0
    for element in payload["elements"]:
        ref = f"{element['type']}/{element['id']}"
        if ref in seen:
            continue
        seen.add(ref)
        shape = geometry(element)
        if shape is None or shape.is_empty or not shape.is_valid:
            skipped += 1
            continue
        if not shape.intersects(query_boundary):
            continue
        tags = element.get("tags", {})
        records.append({
            "osm_ref": ref, "category": category(tags),
            "power": tags.get("power"), "substation": tags.get("substation"),
            "voltage": tags.get("voltage"), "operator": tags.get("operator"),
            "name": tags.get("name"), "geometry": shape,
        })
    if not records:
        raise ValueError("No usable mapped assets returned; existing outputs retained.")
    assets = gpd.GeoDataFrame(records, crs=4326)
    parking = gpd.read_file(ROOT / "processed" / "parkplaetze_bw.geojson").to_crs(4326).reset_index(drop=True)
    included = parking[parking.geometry.intersects(boundary)]
    distribution = nearest(included, assets[assets.category == "distribution"])
    lines = nearest(included, assets[assets.category == "line"])
    proximity = {}
    for index, row in included.iterrows():
        # Stable coordinate key; avoids dependence on feature ordering or names.
        key = f"{row.geometry.x:.6f},{row.geometry.y:.6f}"
        proximity[key] = {
            "distribution": distribution.get(int(index)),
            "line": lines.get(int(index)),
        }
    collection = json.loads(assets.to_json(drop_id=True))
    collection["metadata"] = {
        "source": "OpenStreetMap via Overpass", "endpoint": ENDPOINT,
        "retrieved_at": payload.get("_retrieved_at"),
        "osm_timestamp": payload.get("osm3s", {}).get("timestamp_osm_base"),
        "scope": district or "Baden-Württemberg", "buffer_m": 5000,
        "asset_count": len(assets), "parking_count": len(included),
        "skipped_invalid": skipped, "distance_crs": "EPSG:25832",
        "notice": "Mapped proximity only. Capacity, permission and connection cost are unknown.",
    }
    # One output keeps layer and distance results from the same data snapshot.
    collection["parking_proximity"] = proximity
    output = ROOT / "processed" / "stromnetz_bw.geojson"
    temporary = output.with_suffix(".tmp")
    temporary.write_text(json.dumps(collection, ensure_ascii=False, allow_nan=False), encoding="utf-8")
    temporary.replace(output)
    print(json.dumps(collection["metadata"], indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--district", help="Pilot district AGS, e.g. 08221 for Heidelberg")
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    run(args.district, args.refresh)
