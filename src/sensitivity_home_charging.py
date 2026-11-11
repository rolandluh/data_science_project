"""Sensitivity check of HOME_CHARGING_RATE (src/extract.py) against observed station occupancy.

For every MobiData BW station with at least MIN_DAYS valid days and a location:
    pressure(rate) = public EV demand within R / register charging points within R
    public demand  = sum(ev_index) - rate * sum(ev_index * house_share)
and compare pressure with the station's time-weighted occupancy. Checks:
1. Spearman correlation per rate, radius and station type (AC < 50 kW, DC >= 50 kW)
2. Partial Spearman, controlling for population within R, station power and charging points within R
3. Bootstrap of the best rate (partial Spearman)
4. Log-occupancy regression: log(occ) ~ log(demand) + log(points) + log(kW) + log(population), R^2 per rate
5. Spatial hold-out: best rate fitted on the northern half, tested on the southern half and vice versa

Run from the project root: python src/sensitivity_home_charging.py
Results: docs/sensitivity_home_charging_rate.md
"""
import json

import geopandas as gpd
import numpy as np
import pandas as pd
from scipy.stats import rankdata, spearmanr
from sklearn.neighbors import KDTree

import extract as e

MIN_DAYS = 14
DC_KW = 50
RADII = [1000, 1500, 2000, 3000]
DETAIL_RADII = [1000, 1500]
RATES = np.round(np.arange(0, 2.0001, 0.05), 2)  # beyond 1 is impossible; used to detect confounding
BOOTSTRAP = 300
rng = np.random.default_rng(0)


def metres(lon, lat):
    points = gpd.GeoSeries(gpd.points_from_xy(lon, lat, crs="EPSG:4326")).to_crs("EPSG:3035")
    return np.column_stack([points.x, points.y])


def load_cells():
    with open(e.EV_POP_OUT, encoding="utf-8") as file:
        grid = json.load(file)
    cells = pd.DataFrame(grid["rows"], columns=grid["columns"])
    xy = metres(cells["lon"], cells["lat"])
    cells["x_ll"] = (xy[:, 0] // e.POP_CELL * e.POP_CELL).astype(int)
    cells["y_ll"] = (xy[:, 1] // e.POP_CELL * e.POP_CELL).astype(int)
    cells = cells.merge(e.read_house_shares(), on=["x_ll", "y_ll"], how="left")
    return cells, xy


def load_register():
    with open(e.CHARGERS_OUT, encoding="utf-8") as file:
        register = json.load(file)
    register = pd.DataFrame(register["rows"], columns=register["columns"])
    points = pd.to_numeric(register["Anzahl Ladepunkte"], errors="coerce").fillna(1).to_numpy()
    return metres(register["Längengrad"], register["Breitengrad"]), points


def load_stations():
    daily = pd.read_parquet(e.Path("data/processed/auslastung_taeglich_bw.parquet"))
    daily = daily[daily["valid"]]
    occ = daily.groupby("id").agg(
        cph=("charging_point_hours", "sum"), cap=("capacity_point_hours", "sum"), days=("date", "nunique")
    )
    occ = occ[(occ["days"] >= MIN_DAYS) & (occ["cap"] > 0)]
    occ["occupancy"] = occ["cph"] / occ["cap"]
    meta = pd.read_parquet("data/processed/auslastung_stationen_bw.parquet").set_index("id")
    occ["kw"] = pd.to_numeric(meta["max_electric_power"], errors="coerce").reindex(occ.index) / 1000
    # The station table has no coordinates; the historic snapshot shares the station IDs
    locations = gpd.read_file(e.HIST_OUT)[["id", "geometry"]].drop_duplicates("id")
    locations["id"] = locations["id"].astype(str)
    stations = occ.join(locations.set_index("id"), how="inner")
    stations = stations[stations["geometry"].notna()]
    geometry = gpd.GeoSeries(stations["geometry"], crs="EPSG:4326")
    stations["lat"] = geometry.y
    stations["type"] = np.where(stations["kw"] >= DC_KW, "DC", "AC")
    return stations, metres(geometry.x, geometry.y)


def catchment(cells, cell_xy, reg_xy, reg_points, st_xy, radius):
    """Sums within radius of each station: EV index (A), EV index in houses (B), charging points (P), residents."""
    ev = cells["ev_index"].fillna(0).to_numpy()
    evh = (cells["ev_index"] * cells["house_share"]).fillna(0).to_numpy()
    pop = cells["Einwohner"].to_numpy()
    near_c = KDTree(cell_xy).query_radius(st_xy, r=radius)
    near_r = KDTree(reg_xy).query_radius(st_xy, r=radius)
    A = np.array([ev[i].sum() for i in near_c])
    B = np.array([evh[i].sum() for i in near_c])
    P = np.array([max(reg_points[i].sum(), 1) for i in near_r])
    POP = np.array([pop[i].sum() for i in near_c])
    return A, B, P, POP


def pressure(A, B, P, rate):
    return np.clip(A - rate * B, 0, None) / P


def partial_curve(A, B, P, POP, kw, y):
    """Partial Spearman of pressure and occupancy per rate, controls: residents, power, charging points (all ranked)."""
    Z = np.column_stack([np.ones(len(y)), rankdata(POP), rankdata(kw), rankdata(P)])
    proj = Z @ np.linalg.pinv(Z)
    ry = rankdata(y)
    ry = ry - proj @ ry
    curve = []
    for rate in RATES:
        rx = rankdata(pressure(A, B, P, rate))
        rx = rx - proj @ rx
        curve.append(np.corrcoef(rx, ry)[0, 1])
    return np.array(curve)


def r2_curve(A, B, P, POP, kw, y):
    ly = np.log(y + 1e-3)
    curve = []
    for rate in RATES:
        X = np.column_stack(
            [np.ones(len(y)), np.log(np.clip(A - rate * B, 0, None) + 1), np.log(P), np.log(kw), np.log(POP + 1)]
        )
        beta = np.linalg.lstsq(X, ly, rcond=None)[0]
        curve.append(1 - ((ly - X @ beta) ** 2).sum() / ((ly - ly.mean()) ** 2).sum())
    return np.array(curve)


def at(curve, rate):
    return curve[list(RATES).index(rate)]


def main():
    cells, cell_xy = load_cells()
    reg_xy, reg_points = load_register()
    st, st_xy = load_stations()
    print(f"Stations with >= {MIN_DAYS} valid days and a location: {len(st)} "
          f"(AC {(st.type == 'AC').sum()}, DC {(st.type == 'DC').sum()})\n")

    print("1. Spearman(pressure, occupancy)")
    rows = []
    for radius in RADII:
        A, B, P, POP = catchment(cells, cell_xy, reg_xy, reg_points, st_xy, radius)
        for subset in ["AC", "DC", "all"]:
            m = np.ones(len(st), bool) if subset == "all" else (st["type"] == subset).to_numpy()
            y = st["occupancy"].to_numpy()[m]
            for rate in RATES[RATES <= 1]:
                rho = spearmanr(pressure(A[m], B[m], P[m], rate), y).statistic
                rows.append({"subset": subset, "radius": radius, "rate": rate, "rho": round(rho, 4)})
    print(pd.DataFrame(rows).pivot_table(index="rate", columns=["subset", "radius"], values="rho").to_string(), "\n")

    ac = (st["type"] == "AC").to_numpy()
    y = st["occupancy"].to_numpy()[ac]
    kw = st["kw"].fillna(22).to_numpy()[ac]
    lat = st["lat"].to_numpy()[ac]
    for radius in DETAIL_RADII:
        A, B, P, POP = (v[ac] for v in catchment(cells, cell_xy, reg_xy, reg_points, st_xy, radius))
        print(f"R = {radius} m, AC stations (n = {len(y)})")
        partial = partial_curve(A, B, P, POP, kw, y)
        print("2. Partial Spearman | residents, power, points: "
              + ", ".join(f"{r:.2f}: {at(partial, r):.4f}" for r in [0, 0.5, 0.8, 0.9, 1.0, 1.25, 1.5, 2.0])
              + f"; best {RATES[np.argmax(partial)]:.2f}")

        best_free, best_feasible, gain = [], [], []
        for _ in range(BOOTSTRAP):
            idx = rng.integers(0, len(y), len(y))
            c = partial_curve(A[idx], B[idx], P[idx], POP[idx], kw[idx], y[idx])
            best_free.append(RATES[np.argmax(c)])
            best_feasible.append(RATES[RATES <= 1][np.argmax(c[RATES <= 1])])
            gain.append(at(c, 1.0) - at(c, 0.8))
        best_free, best_feasible, gain = map(np.array, (best_free, best_feasible, gain))
        print(f"3. Bootstrap ({BOOTSTRAP}x): best rate unconstrained median {np.median(best_free):.2f} "
              f"(90 % {np.percentile(best_free, 5):.2f}-{np.percentile(best_free, 95):.2f}); "
              f"within [0, 1] at 1.00 in {np.mean(best_feasible == 1.0):.0%}; "
              f"rho(1.0) - rho(0.8) = {gain.mean():.4f} (90 % {np.percentile(gain, 5):.4f}-{np.percentile(gain, 95):.4f})")

        r2 = r2_curve(A, B, P, POP, kw, y)
        print("4. Log-occupancy regression R^2: "
              + ", ".join(f"{r:.2f}: {at(r2, r):.4f}" for r in [0, 0.5, 0.8, 0.9, 1.0])
              + f"; best {RATES[np.argmax(r2)]:.2f}")

        north = lat >= np.median(lat)
        for name, train, test in [("north -> south", north, ~north), ("south -> north", ~north, north)]:
            fit = partial_curve(A[train], B[train], P[train], POP[train], kw[train], y[train])
            check = partial_curve(A[test], B[test], P[test], POP[test], kw[test], y[test])
            best = RATES[np.argmax(fit)]
            print(f"5. Hold-out {name}: train best {best:.2f}; test rho at train best {at(check, best):.4f}, "
                  f"at 0.8 {at(check, 0.8):.4f}, at 0.9 {at(check, 0.9):.4f}, at 1.0 {at(check, 1.0):.4f}; "
                  f"test best {RATES[np.argmax(check)]:.2f}")
        print()


if __name__ == "__main__":
    main()
