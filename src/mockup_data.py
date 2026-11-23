"""Browser-sized data for the concept mock-up (`mockup/`): real inputs plus SYNTHETIC model results.

Usage: python src/mockup_data.py    ->  data/processed/mockup/*.json, then python src/serve.py -> /mockup/

Each save_*() function skips if its output exists (delete a file, or the folder, to regenerate it).
Real: candidates (public parking), Kreis, AC/DC context rule, distance to the nearest feed station, register stations,
overused feed stations, sizing lookup table, supply trend.
SYNTHETIC (placeholders until the demand model exists): predicted occupancy per candidate and per 500 m cell,
Kreis factors for 2030 / 2035, cost and value defaults. The schema of every file is in mockup/README.md.
"""
import error_log  # noqa: F401 (logs uncaught errors to logs/error.log)
from datetime import datetime, timezone
from pathlib import Path
import json

import geopandas as gpd
import numpy as np
import pandas as pd
from sklearn.neighbors import KDTree

PROCESSED = Path("data/processed")
OUT_DIR = PROCESSED / "mockup"
METRIC_CRS = "EPSG:25832"  # metres, for all distances

# ---------------------------------------------------------------------------
# Parameters (all tunable values in one place; also written to the output files they shape)
# ---------------------------------------------------------------------------
# Candidates: public parking only (decision record §9: ~117k public parking candidates)
EXCLUDED_ACCESS = {"private", "no", "permit"}

# AC/DC context rule (decision record §6): a candidate is DC if any of these holds, else AC
DC_MOTORWAY_M = 300  # within 300 m of a motorway junction, rest area or services (strassenpunkte_osm_bw)
DC_PRIMARY_M = 25  # within 25 m of a primary road, i.e. on it (strassen_osm_bw, highway=primary)
DC_SUPERMARKET_M = 100  # within 100 m of a supermarket (poi_osm_bw, category=supermarket)

LOW_CONFIDENCE_M = 2000  # "Low confidence" if the nearest feed station (historie_bw) is further away

# Features used by the synthetic occupancy formula (real values; the formula itself is made up)
RESIDENTS_RADIUS_M = 1000  # residents within 1 km (decision record §4 buffer)
DESTINATIONS_RADIUS_M = 500  # OSM destinations within 500 m (§4 buffer)
ROAD_SEARCH_M = 5000  # distances to major roads are capped here

SYNTHETIC_SEED = 2026
SYNTHETIC_NOISE = 0.6  # standard deviation of the noise, in z-score units
SYNTHETIC_WEIGHTS = {  # weights on z-scored features, per class
    "AC": {"residents": 0.55, "destinations": 0.30, "road": 0.15, "motorway": 0.0},
    "DC": {"residents": 0.15, "destinations": 0.25, "road": 0.45, "motorway": 0.5},
}

# Stations used for occupancy statistics (decision record §2): >= 14 valid days; DC = max power >= 50 kW
MIN_VALID_DAYS = 14
DC_KW = 50
FULL_HOUR = 0.999  # peak_hour_occupancy at or above this = every point busy for the whole hour ("full day", §5)

# Sizing lookup table (§5)
SIZE_STEPS = [2, 4, 6, 8, 10, 12]  # point counts tried
POINT_CLASS_EDGES = [0, 2.5, 4.5, 6.5, 8.5, 1e9]  # station mean points -> class 2 / 4 / 6 / 8 / 10+
POINT_CLASSES = ["2", "4", "6", "8", "10+"]
OCC_BIN_EDGES = [0, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40, 1.01]
MIN_STATIONS_PER_CELL = 10  # sparser lookup cells are filled from their neighbours
TARGET_PERCENTILE = 0.75  # target = share of full days at today's 75th percentile station of the class
MAX_POINTS = {"AC": 8, "DC": 12}
REFERENCE_POINTS = 2  # predictions are read as occupancy at 2 points (§5 step 1)

# Scenarios (§9)
SUPPLY_TREND_YEARS = [2023, 2024, 2025]  # points added per year = average over these register years
OCC_CAP_PERCENTILE = 0.99  # scenario occupancy is capped at today's 99th percentile of the class
YEARS = [2030, 2035]

# Placeholder defaults (ASSUMED, not researched; the cost list in todos.md will replace them)
DEFAULTS = {
    "status": "assumed placeholders, not researched",
    "budget_eur": {"AC": 500_000, "DC": 2_000_000},
    "cost": {
        "AC": {"per_point": 6_000, "grid_per_site": 8_000, "civil_per_site": 6_000, "subsidy_per_site": 0, "om_per_point_year": 400},
        "DC": {"per_point": 55_000, "grid_per_site": 60_000, "civil_per_site": 20_000, "subsidy_per_site": 0, "om_per_point_year": 3_000},
    },
    "value": {
        "AC": {"delivered_kw": 7, "price_eur_kwh": 0.49, "energy_cost_eur_kwh": 0.25},
        "DC": {"delivered_kw": 60, "price_eur_kwh": 0.59, "energy_cost_eur_kwh": 0.25},
        "lifetime_years": 10,
        "discount_rate": 0.06,
    },
    "spacing_m": {"AC": 500, "DC": 3000},
    "max_points": MAX_POINTS,
    "area": {"mode": "radius", "center": [48.7758, 9.1829], "radius_km": 15},
}


def write_json(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"Saved {path} ({path.stat().st_size / 1e6:.1f} MB)")


def require(path):
    if not path.exists():
        raise FileNotFoundError(f"{path} is missing. Run python src/extract.py first.")
    return path


def meta(source, synthetic):
    return {
        "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
        "source": source,
        "synthetic": synthetic,
    }


def xy(gdf):
    """Metric coordinates (n x 2) of point geometries."""
    projected = gdf.to_crs(METRIC_CRS).geometry
    return np.column_stack([projected.x.to_numpy(), projected.y.to_numpy()])


def points_gdf(lat, lon):
    return gpd.GeoDataFrame(geometry=gpd.points_from_xy(lon, lat), crs="EPSG:4326")


# ---------------------------------------------------------------------------
# Shared inputs
# ---------------------------------------------------------------------------
def load_kreise():
    kreise = gpd.read_file(require(PROCESSED / "kreise_bw.geojson"))[["AGS", "GEN", "BEZ", "geometry"]]
    return kreise.sort_values("GEN").reset_index(drop=True)


def station_stats():
    """Per feed station: valid days, mean occupancy (time-weighted), share of full days, power class."""
    daily = pd.read_parquet(require(PROCESSED / "auslastung_taeglich_bw.parquet"),
                            columns=["id", "valid", "charging_point_hours", "capacity_point_hours", "mean_points", "peak_hour_occupancy"])
    daily = daily[daily["valid"]]
    daily["full"] = daily["peak_hour_occupancy"] >= FULL_HOUR
    stats = daily.groupby("id").agg(days=("full", "size"), cph=("charging_point_hours", "sum"),
                                    cap=("capacity_point_hours", "sum"), points=("mean_points", "median"),
                                    full_share=("full", "mean"))
    stats = stats[(stats["days"] >= MIN_VALID_DAYS) & (stats["cap"] > 0)]
    stats["occupancy"] = stats["cph"] / stats["cap"]
    info = pd.read_parquet(require(PROCESSED / "auslastung_stationen_bw.parquet")).set_index("id")
    kw = pd.to_numeric(info["max_electric_power"], errors="coerce") / 1000
    stats["cls"] = np.where(kw.reindex(stats.index) >= DC_KW, "DC", "AC")
    return stats.join(info[["name", "operator_name"]])


def feed_locations():
    """Locations of feed stations (historie_bw.geojson), keyed by station id as string."""
    feed = gpd.read_file(require(PROCESSED / "historie_bw.geojson"))
    feed["id"] = feed["id"].astype(str)
    return feed


def features_for(points, cells, cell_pop, poi_tree, major_roads):
    """Real features shared by candidates and cells: residents within 1 km, destinations within 500 m, distance to major road."""
    coords = xy(points)
    neighbours = KDTree(cells).query_radius(coords, r=RESIDENTS_RADIUS_M)
    residents = np.array([cell_pop[i].sum() for i in neighbours])
    destinations = poi_tree.query_radius(coords, r=DESTINATIONS_RADIUS_M, count_only=True)
    joined = gpd.sjoin_nearest(points.to_crs(METRIC_CRS), major_roads, how="left",
                               max_distance=ROAD_SEARCH_M, distance_col="road_m")
    road = joined.groupby(level=0)["road_m"].min().reindex(range(len(points))).fillna(ROAD_SEARCH_M).to_numpy()
    return residents, destinations, road


def zscore(values):
    values = np.asarray(values, dtype=float)
    return (values - values.mean()) / (values.std() or 1)


def synthetic_occupancy(cls, residents, destinations, road, motorway, observed, rng):
    """SYNTHETIC prediction: weighted real features + noise, mapped onto the observed occupancy distribution of the class.

    The score's rank is turned into the matching quantile (1st to 99th percentile) of today's station occupancy,
    so magnitudes are plausible and stay within the observed range. Not a model: a placeholder with the right shape.
    """
    w = SYNTHETIC_WEIGHTS[cls]
    score = (w["residents"] * zscore(np.log1p(residents)) + w["destinations"] * zscore(np.log1p(destinations))
             + w["road"] * zscore(-np.log1p(road)) + w["motorway"] * np.asarray(motorway, dtype=float)
             + rng.normal(0, SYNTHETIC_NOISE, len(residents)))
    rank = (pd.Series(score).rank(method="first").to_numpy() - 0.5) / len(score)
    quantiles = 0.01 + 0.98 * rank
    return np.quantile(observed, quantiles)


def load_feature_inputs():
    population = json.load(open(require(PROCESSED / "bevoelkerung_500m.json"), encoding="utf-8"))
    pop = np.array(population, dtype=float)  # [lat, lon, residents]
    cell_points = points_gdf(pop[:, 0], pop[:, 1])
    pois = gpd.read_file(require(PROCESSED / "poi_osm_bw.geojson"))
    pois = pois[pois.geometry.notna()].copy()
    pois["geometry"] = pois.geometry.representative_point()
    roads = gpd.read_file(require(PROCESSED / "strassen_osm_bw.geojson")).to_crs(METRIC_CRS)
    return {
        "pop": pop,
        "cell_points": cell_points,
        "cell_xy": xy(cell_points),
        "pois": pois,
        "poi_tree": KDTree(xy(pois)),
        "roads": roads[["highway", "geometry"]],
    }


# ---------------------------------------------------------------------------
# Outputs
# ---------------------------------------------------------------------------
def save_candidates(inputs, kreise, stats, feed, out=OUT_DIR / "candidates.json"):
    """Public parking candidates with Kreis, AC/DC context rule, low-confidence flag and SYNTHETIC occupancy."""
    if out.exists():
        print(f"{out} exists, skipping")
        return
    parking = gpd.read_file(require(PROCESSED / "parkplaetze_kombiniert_bw.geojson"), columns=["access", "parking", "name", "source"])
    parking = parking[~parking["access"].isin(EXCLUDED_ACCESS) & parking.geometry.notna()].copy()
    parking["geometry"] = parking.geometry.representative_point()
    joined = gpd.sjoin(parking, kreise[["AGS", "geometry"]], how="inner", predicate="within")
    parking = joined[~joined.index.duplicated()].drop(columns="index_right").reset_index(drop=True)
    print(f"Candidates: {len(parking)} public parking sites inside BW")

    coords = xy(parking)
    road_points = gpd.read_file(require(PROCESSED / "strassenpunkte_osm_bw.geojson"))
    motorway_m = KDTree(xy(road_points)).query(coords, k=1)[0][:, 0]
    supermarkets = inputs["pois"][inputs["pois"]["category"] == "supermarket"]
    supermarket_m = KDTree(xy(supermarkets)).query(coords, k=1)[0][:, 0]
    primary = inputs["roads"][inputs["roads"]["highway"] == "primary"]
    near_primary = gpd.sjoin_nearest(parking.to_crs(METRIC_CRS)[["geometry"]], primary[["geometry"]], how="left",
                                     max_distance=DC_PRIMARY_M, distance_col="d")
    on_primary = near_primary.groupby(level=0)["d"].min().reindex(range(len(parking))).notna().to_numpy()

    reason = np.full(len(parking), "", dtype=object)  # first rule that applies, in this order
    reason[supermarket_m <= DC_SUPERMARKET_M] = "supermarket"
    reason[on_primary] = "primary road"
    reason[motorway_m <= DC_MOTORWAY_M] = "motorway"
    cls = np.where(reason != "", "DC", "AC")
    print(f"AC/DC rule: {(cls == 'DC').mean():.1%} DC "
          f"(motorway {(reason == 'motorway').sum()}, primary {(reason == 'primary road').sum()}, supermarket {(reason == 'supermarket').sum()})")

    feed_m = KDTree(xy(feed)).query(coords, k=1)[0][:, 0]
    low = feed_m > LOW_CONFIDENCE_M
    print(f"Low confidence (> {LOW_CONFIDENCE_M} m from a feed station): {low.mean():.1%}")

    residents, destinations, road = features_for(parking, inputs["cell_xy"], inputs["pop"][:, 2], inputs["poi_tree"], inputs["roads"])
    rng = np.random.default_rng(SYNTHETIC_SEED)
    occupancy = np.zeros(len(parking))
    for c in ("AC", "DC"):
        mask = cls == c
        observed = stats.loc[stats["cls"] == c, "occupancy"].to_numpy()
        occupancy[mask] = synthetic_occupancy(c, residents[mask], destinations[mask], road[mask], reason[mask] == "motorway", observed, rng)

    kreis_index = {ags: i for i, ags in enumerate(kreise["AGS"])}
    lat = parking.geometry.y.round(5).to_numpy()
    lon = parking.geometry.x.round(5).to_numpy()
    rows = [
        [i, float(lat[i]), float(lon[i]), kreis_index[parking.at[i, "AGS"]], cls[i], round(float(occupancy[i]), 4), int(low[i]),
         int(round(feed_m[i])), reason[i], int(round(residents[i])), int(destinations[i]), int(round(road[i])),
         parking.at[i, "parking"] or "", parking.at[i, "source"]]
        for i in range(len(parking))
    ]
    write_json(out, {
        "meta": {**meta("parkplaetze_kombiniert_bw, kreise_bw, strassen(punkte)_osm_bw, poi_osm_bw, historie_bw, bevoelkerung_500m",
                        synthetic=["occ"]),
                 "excluded_access": sorted(EXCLUDED_ACCESS),
                 "dc_rule_m": {"motorway": DC_MOTORWAY_M, "primary_road": DC_PRIMARY_M, "supermarket": DC_SUPERMARKET_M},
                 "low_confidence_m": LOW_CONFIDENCE_M,
                 "synthetic_weights": SYNTHETIC_WEIGHTS, "synthetic_noise": SYNTHETIC_NOISE, "seed": SYNTHETIC_SEED},
        "kreise": [{"ags": a, "name": n, "type": b} for a, n, b in kreise[["AGS", "GEN", "BEZ"]].itertuples(index=False)],
        "columns": ["id", "lat", "lon", "kreis", "type", "occ", "low_conf", "feed_m", "dc_reason",
                    "residents_1km", "destinations_500m", "major_road_m", "parking", "source"],
        "rows": rows,
    })


def save_cells(inputs, stats, out=OUT_DIR / "cells.json"):
    """500 m cells (Zensus positions) with SYNTHETIC expected occupancy of a typical AC station there."""
    if out.exists():
        print(f"{out} exists, skipping")
        return
    cells = inputs["cell_points"]
    residents, destinations, road = features_for(cells, inputs["cell_xy"], inputs["pop"][:, 2], inputs["poi_tree"], inputs["roads"])
    observed = stats.loc[stats["cls"] == "AC", "occupancy"].to_numpy()
    occ = synthetic_occupancy("AC", residents, destinations, road, np.zeros(len(cells)), observed,
                              np.random.default_rng(SYNTHETIC_SEED + 1))
    pop = inputs["pop"]
    rows = [[round(float(pop[i, 0]), 5), round(float(pop[i, 1]), 5), round(float(occ[i]), 4)] for i in range(len(pop))]
    write_json(out, {"meta": meta("bevoelkerung_500m (positions)", synthetic=["occ"]), "columns": ["lat", "lon", "occ"], "rows": rows})


def save_stations(out=OUT_DIR / "stations.json"):
    """Existing register stations (real), compact."""
    if out.exists():
        print(f"{out} exists, skipping")
        return
    register = json.load(open(require(PROCESSED / "ladesaeulen.json"), encoding="utf-8"))
    col = {name: i for i, name in enumerate(register["columns"])}
    rows = []
    for r in register["rows"]:
        lat, lon = r[col["Breitengrad"]], r[col["Längengrad"]]
        if lat is None or lon is None:
            continue
        points = pd.to_numeric(r[col["Anzahl Ladepunkte"]], errors="coerce")
        kw = pd.to_numeric(str(r[col["Nennleistung Ladeeinrichtung [kW]"]]).replace(",", "."), errors="coerce")
        rows.append([round(float(lat), 5), round(float(lon), 5), int(points) if pd.notna(points) else None,
                     float(kw) if pd.notna(kw) else None, r[col["Betreiber"]], r[col["Ort"]]])
    write_json(out, {"meta": meta("ladesaeulen.json (Bundesnetzagentur register)", synthetic=[]),
                     "columns": ["lat", "lon", "points", "kw", "operator", "city"], "rows": rows})


def save_overused(stats, feed, targets, out=OUT_DIR / "overused.json"):
    """Feed stations with their share of full days (real); overused = above the target of their class."""
    if out.exists():
        print(f"{out} exists, skipping")
        return
    located = stats.join(feed.set_index("id")[["geometry"]], how="inner")
    rows = [[sid, round(g.y, 5), round(g.x, 5), c, round(float(share), 4), round(float(occ), 4), int(days), int(share > targets[c]),
             name, operator]
            for sid, g, c, share, occ, days, name, operator in
            located[["geometry", "cls", "full_share", "occupancy", "days", "name", "operator_name"]].itertuples()]
    write_json(out, {"meta": {**meta("auslastung_taeglich_bw.parquet, historie_bw.geojson", synthetic=[]),
                              "min_valid_days": MIN_VALID_DAYS, "full_hour_threshold": FULL_HOUR, "targets": targets},
                     "columns": ["id", "lat", "lon", "type", "full_share", "occ", "days", "overused", "name", "operator"],
                     "rows": rows})


def sizing_table(stats):
    """Median share of full days by class, point-count class and occupancy bin; sparse cells filled, made monotone."""
    stats = stats.copy()
    stats["pc"] = pd.cut(stats["points"], POINT_CLASS_EDGES, labels=POINT_CLASSES)
    stats["ob"] = pd.cut(stats["occupancy"], OCC_BIN_EDGES, right=False, labels=False)
    table, counts = {}, {}
    for c in ("AC", "DC"):
        sub = stats[stats["cls"] == c]
        grouped = sub.groupby(["pc", "ob"], observed=False)["full_share"]
        median = grouped.median().unstack("ob").reindex(index=POINT_CLASSES, columns=range(len(OCC_BIN_EDGES) - 1))
        n = grouped.size().unstack("ob").reindex(index=POINT_CLASSES, columns=range(len(OCC_BIN_EDGES) - 1)).fillna(0)
        median = median.where(n >= MIN_STATIONS_PER_CELL)
        median = median.ffill(axis=0)  # sparse large-site cells borrow from the next smaller point class
        median = median.ffill(axis=1).fillna(0)  # higher occupancy bins borrow from the bin below
        median = median.cummax(axis=1)  # fuller sites are full at least as often
        median = median.cummin(axis=0)  # more points are full at most as often
        table[c] = median.round(4).values.tolist()
        counts[c] = n.astype(int).values.tolist()
    return table, counts


def save_sizing(stats, targets, out=OUT_DIR / "sizing.json"):
    if out.exists():
        print(f"{out} exists, skipping")
        return
    table, counts = sizing_table(stats)
    write_json(out, {
        "meta": {**meta("auslastung_taeglich_bw.parquet", synthetic=[]), "min_valid_days": MIN_VALID_DAYS,
                 "full_hour_threshold": FULL_HOUR, "min_stations_per_cell": MIN_STATIONS_PER_CELL,
                 "fill_rule": "cells with fewer stations take the next smaller point class, then the lower occupancy bin; then made monotone"},
        "reference_points": REFERENCE_POINTS,
        "size_steps": SIZE_STEPS,
        "point_classes": POINT_CLASSES,
        "point_class_edges": POINT_CLASS_EDGES[1:-1],
        "occ_bin_edges": OCC_BIN_EDGES,
        "target_percentile": TARGET_PERCENTILE,
        "targets": targets,
        "max_points": MAX_POINTS,
        "full_share": table,
        "station_counts": counts,
    })


def supply_trend():
    """BW charging points added per year (register commissioning dates), average over SUPPLY_TREND_YEARS."""
    register = json.load(open(require(PROCESSED / "ladesaeulen.json"), encoding="utf-8"))
    frame = pd.DataFrame(register["rows"], columns=register["columns"])
    year = pd.to_datetime(frame["Inbetriebnahmedatum"], format="%d.%m.%Y", errors="coerce").dt.year
    points = pd.to_numeric(frame["Anzahl Ladepunkte"], errors="coerce").fillna(0)
    per_year = points.groupby(year).sum()
    return {
        "points_today": int(points.sum()),
        "added_per_year": int(round(per_year.reindex(SUPPLY_TREND_YEARS).mean())),
        "trend_years": SUPPLY_TREND_YEARS,
    }


def save_scenarios(kreise, stats, out=OUT_DIR / "scenarios.json"):
    """Kreis factors for 2030 / 2035 (SYNTHETIC), occupancy cap and supply trend (real)."""
    if out.exists():
        print(f"{out} exists, skipping")
        return
    rng = np.random.default_rng(SYNTHETIC_SEED + 2)
    f2030 = 0.9 + 0.45 * rng.random(len(kreise))
    f2035 = np.minimum(1.6, f2030 * (1.05 + 0.2 * rng.random(len(kreise))))
    caps = {c: round(float(stats.loc[stats["cls"] == c, "occupancy"].quantile(OCC_CAP_PERCENTILE)), 4) for c in ("AC", "DC")}
    write_json(out, {
        "meta": {**meta("SYNTHETIC factors; supply trend from ladesaeulen.json", synthetic=["factors"]),
                 "factor_definition": "(public demand in year Y / 2026) / (BW charging points in year Y / 2026), per Kreis",
                 "occ_cap_percentile": OCC_CAP_PERCENTILE},
        "years": YEARS,
        "occ_cap": caps,
        "supply": supply_trend(),
        "factors": {ags: {"2030": round(float(a), 3), "2035": round(float(b), 3)} for ags, a, b in zip(kreise["AGS"], f2030, f2035)},
    })


def save_defaults(out=OUT_DIR / "defaults.json"):
    if out.exists():
        print(f"{out} exists, skipping")
        return
    write_json(out, {"meta": meta("assumed placeholders in src/mockup_data.py", synthetic=["budget_eur", "cost", "value"]), **DEFAULTS})


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    names = ["candidates", "cells", "stations", "overused", "sizing", "scenarios", "defaults"]
    if all((OUT_DIR / f"{n}.json").exists() for n in names):
        print(f"All mock-up files exist in {OUT_DIR}; delete one to regenerate it")
        return
    save_stations()
    save_defaults()
    kreise = load_kreise()
    stats = station_stats()
    targets = {c: round(float(stats.loc[stats["cls"] == c, "full_share"].quantile(TARGET_PERCENTILE)), 4) for c in ("AC", "DC")}
    print(f"Stations with >= {MIN_VALID_DAYS} valid days: {len(stats)}; sizing targets (share of full days): {targets}")
    save_sizing(stats, targets)
    save_scenarios(kreise, stats)
    feed = feed_locations()
    save_overused(stats, feed, targets)
    if not ((OUT_DIR / "candidates.json").exists() and (OUT_DIR / "cells.json").exists()):
        inputs = load_feature_inputs()
        save_cells(inputs, stats)
        save_candidates(inputs, kreise, stats, feed)


if __name__ == "__main__":
    main()
