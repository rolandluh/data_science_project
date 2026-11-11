"""Data acquisition: download BKG district boundaries and Bundesnetzagentur charging stations, save Baden-Württemberg subsets."""
from functools import lru_cache
from pathlib import Path
import json
import urllib.error
import urllib.request
import zipfile

import geopandas as gpd
import numpy as np
import pandas as pd
from shapely.geometry import box
from sklearn.neighbors import KDTree

from extract_occupancy import save_daily_occupancy, save_occupancy_workbook
from extract_traffic import save_traffic_counters

URL = "https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/2020/vg250_01-01.geo84.shape.ebenen.zip"
ZIP_PATH = Path("data/raw/vg250.zip")
LAYER = "vg250_01-01.geo84.shape.ebenen/vg250_ebenen_0101/VG250_KRS.shp"
OUT_PATH = Path("data/processed/kreise_bw.geojson")
STATES_LAYER = "vg250_01-01.geo84.shape.ebenen/vg250_ebenen_0101/VG250_LAN.shp"
STATES_OUT = Path("data/processed/laender.geojson")

CHARGERS_URL = "https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenregister_BNetzA_2026-09-01.csv"
CHARGERS_PATH = Path("data/raw/Ladesaeulenregister_BNetzA_2026-09-01.csv")
CHARGERS_OUT = Path("data/processed/ladesaeulen.json")

POP_URL = "https://www.destatis.de/static/DE/zensus/gitterdaten/Zensus2022_Bevoelkerungszahl.zip"
POP_ZIP_PATH = Path("data/raw/zensus2022_bevoelkerung_gitter.zip")
POP_CSV = "Zensus2022_Bevoelkerungszahl_100m-Gitter.csv"
POP_CELL = 500  # 100 m cells are summed into 500 m cells (EPSG:3035, metres)
POP_OUT = Path("data/processed/bevoelkerung_500m.json")

# KBA share of cars with electric drive per 5 km cell (added by hand, no stable download URL)
EV_GRID_PATH = Path("data/raw/kba_pkw_elektro_gitterzellen_2025.csv")
EV_GRID_OUT = Path("data/processed/ev_anteil_5km_bw.geojson")
EV_POP_OUT = Path("data/processed/ev_bevoelkerung_500m_bw.json")
# Bundesagentur für Arbeit: median monthly gross wage and employees by place of residence (added by hand)
INCOME_ZIP_PATH = Path("data/raw/Grunddaten-regionale-Entgelte.zip")
INCOME_1KM_CSV = "Medianentgelt_1km_WO_202512.csv"
INCOME_5KM_CSV = "Medianentgelt_5km_WO_202512.csv"
# BA Entgeltstatistik by district, place of residence, full-time core group, 31 Dec 2025 (added by hand)
INCOME_KREIS_PATH = Path("data/raw/entgelt_kreise_wohnort_202512.xlsx")
INCOME_KREIS_SHEET = "9.1"
INCOME_POP_OUT = Path("data/processed/einkommen_500m_bw.json")

PARK_URL = "https://api.mobidata-bw.de/geoserver/MobiData-BW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=MobiData-BW%3Apark-api_car&cql_filter=type%3C%3E%27ON_STREET%27%20OR%20type%20is%20NULL&maxFeatures=30000&outputFormat=csv"
PARK_CSV_PATH = Path("data/raw/parkplaetze_bw_wfs.csv")
STREET_PARK_CSV_PATH = Path("data/raw/park-api_car.csv")
PARK_OUT = Path("data/processed/parkplaetze_bw.geojson")
HIST_DIR = Path("data/raw/historie")
HIST_CSV = HIST_DIR / "20261018_ladesaeulen.csv.gz"
HIST_OUT = Path("data/processed/historie_bw.geojson")
HIST_COLUMNS = [
    "id", "name", "operator_name", "address", "postal_code", "city", "source", "max_electric_power",
    "chargepoint_available_count", "chargepoint_charging_count", "chargepoint_reserved_count",
    "chargepoint_outoforder_count", "chargepoint_inoperative_count", "chargepoint_static_count",
    "chargepoint_unknown_count", "datastore_updated_at",
]
PARK_COLUMNS = [
    "name", "operator_name", "address", "type", "capacity", "opening_hours", "has_fee", "fee_description",
    "has_lighting", "is_covered", "max_height", "max_stay", "capacity_charging", "capacity_disabled",
    "capacity_women", "capacity_family", "capacity_resident", "parking_type", "public_url",
]


def save_districts():
    if OUT_PATH.exists():
        print(f"{OUT_PATH} already exists, skipping")
        return
    if not ZIP_PATH.exists():
        urllib.request.urlretrieve(URL, ZIP_PATH)

    kreise = gpd.read_file(f"/vsizip/{ZIP_PATH.as_posix()}/{LAYER}", encoding="utf-8")
    # AGS 08 = Baden-Württemberg; 5-digit keys are districts
    kreise = kreise[kreise["AGS"].str.startswith("08") & (kreise["AGS"].str.len() == 5)]
    # Some districts are stored as several rows (e.g. Konstanz); merge them into one
    kreise = kreise.dissolve(by="AGS", aggfunc="first").reset_index()
    kreise[["AGS", "GEN", "BEZ", "geometry"]].to_file(OUT_PATH, driver="GeoJSON")
    print(f"{len(kreise)} districts saved to {OUT_PATH}")


def save_states():
    if STATES_OUT.exists():
        print(f"{STATES_OUT} already exists, skipping")
        return
    if not ZIP_PATH.exists():
        urllib.request.urlretrieve(URL, ZIP_PATH)

    states = gpd.read_file(f"/vsizip/{ZIP_PATH.as_posix()}/{STATES_LAYER}", encoding="utf-8")
    # Merge multi-row entries so each state is one shape
    states = states.dissolve(by="AGS", aggfunc="first").reset_index()
    states[["AGS", "GEN", "geometry"]].to_file(STATES_OUT, driver="GeoJSON")
    print(f"{len(states)} states saved to {STATES_OUT}")


def save_chargers():
    if CHARGERS_OUT.exists():
        print(f"{CHARGERS_OUT} already exists, skipping")
        return
    if not CHARGERS_PATH.exists():
        urllib.request.urlretrieve(CHARGERS_URL, CHARGERS_PATH)

    # The first 10 lines are notes; the header is on line 11
    chargers = pd.read_csv(CHARGERS_PATH, sep=";", skiprows=10, encoding="utf-8-sig", dtype=str)
    chargers = chargers[chargers["Bundesland"] == "Baden-Württemberg"]
    # Public keys are long cryptographic strings, not useful for the map
    chargers = chargers.drop(columns=[col for col in chargers.columns if col.startswith("Public Key")])
    # Coordinates use a comma as decimal separator
    for col in ["Breitengrad", "Längengrad"]:
        chargers[col] = chargers[col].str.replace(",", ".").astype(float)
    # Columns once, then rows as arrays: much smaller than one object per station
    rows = chargers.astype(object).where(chargers.notna(), None).values.tolist()
    with open(CHARGERS_OUT, "w", encoding="utf-8") as file:
        json.dump({"columns": list(chargers.columns), "rows": rows}, file, ensure_ascii=False)
    print(f"{len(chargers)} charging stations saved to {CHARGERS_OUT}")


def read_bw_population_cells():
    """Zensus 2022 100 m cells summed to 500 m cells; populated cells whose centre lies in Baden-Württemberg, as lat/lon points."""
    if not POP_ZIP_PATH.exists():
        urllib.request.urlretrieve(POP_URL, POP_ZIP_PATH)
    with zipfile.ZipFile(POP_ZIP_PATH) as archive:
        with archive.open(POP_CSV) as file:
            cells = pd.read_csv(file, sep=";", usecols=["x_mp_100m", "y_mp_100m", "Einwohner"])
    cells["Einwohner"] = pd.to_numeric(cells["Einwohner"], errors="coerce")
    cells = cells[cells["Einwohner"] > 0]
    # Both grids are EPSG:3035 and aligned: each 500 m cell holds exactly 5 x 5 cells of 100 m
    cells["x_ll"] = cells["x_mp_100m"] // POP_CELL * POP_CELL
    cells["y_ll"] = cells["y_mp_100m"] // POP_CELL * POP_CELL
    cells = cells.groupby(["x_ll", "y_ll"], as_index=False)["Einwohner"].sum()
    cells["x_mp"] = cells["x_ll"] + POP_CELL // 2
    cells["y_mp"] = cells["y_ll"] + POP_CELL // 2
    cells["cell_id"] = f"CRS3035RES{POP_CELL}mN" + cells["y_ll"].astype(str) + "E" + cells["x_ll"].astype(str)
    # Cell centres are in EPSG:3035 (metres); the map needs lat/lon
    points = gpd.GeoDataFrame(
        cells[["cell_id", "x_mp", "y_mp", "Einwohner"]],
        geometry=gpd.points_from_xy(cells["x_mp"], cells["y_mp"], crs="EPSG:3035").to_crs("EPSG:4326"),
    )
    states = gpd.read_file(STATES_OUT)
    return gpd.sjoin(points, states[states["AGS"] == "08"][["geometry"]], predicate="within").drop(columns="index_right")


def save_population():
    if POP_OUT.exists():
        print(f"{POP_OUT} already exists, skipping")
        return
    points = read_bw_population_cells()
    rows = list(zip(points.geometry.y.tolist(), points.geometry.x.tolist(), points["Einwohner"].tolist()))
    with open(POP_OUT, "w", encoding="utf-8") as file:
        json.dump(rows, file)
    print(f"{len(rows)} populated {POP_CELL} m cells saved to {POP_OUT}")


def save_ev_grid():
    if EV_GRID_OUT.exists():
        print(f"{EV_GRID_OUT} already exists, skipping")
        return
    if not EV_GRID_PATH.exists():
        raise FileNotFoundError(f"{EV_GRID_PATH} is missing; download the KBA 5 km grid by hand")

    cells = pd.read_csv(EV_GRID_PATH, encoding="utf-8-sig")
    # Cell IDs like "5kmN2685E4340" give the lower-left corner in km, EPSG:3035
    corner = cells["5km-Gitterzelle-ID"].str.extract(r"N(\d+)E(\d+)").astype(int) * 1000
    north, east = corner[0], corner[1]
    squares = [box(e, n, e + 5000, n + 5000) for e, n in zip(east, north)]
    # "-" in the ZS column marks cells without a published value (stored as 0); keep them as no data
    share = cells["Anteil (in%)"].where(cells["ZS_Anteil_Pkw_mit_Elektro-Antrieb"] != "-")
    grid = gpd.GeoDataFrame(
        {"cell_id": cells["5km-Gitterzelle-ID"], "ev_share": share, "year": cells["Berichtsjahr"]},
        geometry=squares,
        crs="EPSG:3035",
    ).to_crs("EPSG:4326")
    # Keep cells that touch Baden-Württemberg (border cells included)
    states = gpd.read_file(STATES_OUT)
    bw = states[states["AGS"] == "08"][["geometry"]].to_crs("EPSG:4326")
    grid = gpd.sjoin(grid, bw, predicate="intersects").drop(columns="index_right")
    grid = grid.drop_duplicates("cell_id")
    grid.to_file(EV_GRID_OUT, driver="GeoJSON")
    print(f"{len(grid)} 5 km cells ({grid['ev_share'].notna().sum()} with EV share) saved to {EV_GRID_OUT}")


def save_ev_population_grid():
    # Dasymetric step: each 500 m cell keeps the EV share of its 5 km parent cell and is weighted by its residents.
    # ev_index = residents x share; cells without residents get no EVs, and the population-weighted
    # mean share of the 100 children equals the published 5 km share.
    if EV_POP_OUT.exists():
        print(f"{EV_POP_OUT} already exists, skipping")
        return
    if not EV_GRID_PATH.exists():
        raise FileNotFoundError(f"{EV_GRID_PATH} is missing; download the KBA 5 km grid by hand")

    shares = pd.read_csv(EV_GRID_PATH, encoding="utf-8-sig")
    shares["ev_share"] = shares["Anteil (in%)"].where(shares["ZS_Anteil_Pkw_mit_Elektro-Antrieb"] != "-")
    shares = shares.rename(columns={"5km-Gitterzelle-ID": "cell_5km"})[["cell_5km", "ev_share"]]

    cells = read_bw_population_cells()
    # Both grids are EPSG:3035 and aligned, so the parent is the 5 km cell containing the 500 m centre
    north = (cells["y_mp"] // 5000 * 5).astype(int).astype(str)
    east = (cells["x_mp"] // 5000 * 5).astype(int).astype(str)
    cells["cell_5km"] = "5kmN" + north + "E" + east
    cells = cells.merge(shares, on="cell_5km", how="left")
    cells["ev_index"] = (cells["Einwohner"] * cells["ev_share"] / 100).round(1)

    columns = ["lat", "lon", "Einwohner", "ev_share", "ev_index", "cell_5km"]
    rows = [
        [round(p.y, 5), round(p.x, 5), int(e), None if pd.isna(s) else s, None if pd.isna(i) else i, c]
        for p, e, s, i, c in zip(cells.geometry, cells["Einwohner"], cells["ev_share"], cells["ev_index"], cells["cell_5km"])
    ]
    with open(EV_POP_OUT, "w", encoding="utf-8") as file:
        json.dump({"columns": columns, "rows": rows}, file)
    print(f"{len(rows)} {POP_CELL} m cells ({cells['ev_share'].notna().sum()} with EV share) saved to {EV_POP_OUT}")


GAP_RADIUS_M = 1500  # catchment around each 500 m cell in which demand and charging points are summed
GAP_OUT = Path("data/processed/nachfrage_luecke_500m_bw.json")

DWELL_URL = "https://www.destatis.de/static/DE/zensus/gitterdaten/Wohnungen_nach_Gebaeudetyp_Groesse.zip"
DWELL_ZIP_PATH = Path("data/raw/zensus2022_wohnungen_gebaeudetyp.zip")
DWELL_CSV = "Zensus2022_Wohnung_Gebaeudetyp_Groesse_100m-Gitter.csv"
# Dwellings in detached, semi-detached and terraced 1- and 2-family houses: usually with a private parking space
DWELL_HOUSE_COLUMNS = ["FreiEFH", "EFH_DHH", "EFH_Reihenhaus", "Freist_ZFH", "ZFH_DHH", "ZFH_Reihenhaus"]
DWELL_OTHER_COLUMNS = ["MFH_3bis6Wohnungen", "MFH_7bis12Wohnungen", "MFH_13undmehrWohnungen", "AndererGebaeudetyp"]
# Share of EV owners in 1- and 2-family houses who charge at home and need no public charger.
# Calibrated against observed AC station occupancy (MobiData BW history, 3,909 stations; src/sensitivity_home_charging.py):
# 0.9 is the best fit of the log-occupancy regression at GAP_RADIUS_M; see docs/sensitivity_home_charging_rate.md
HOME_CHARGING_RATE = 0.9


def read_house_shares():
    """Zensus 2022 dwellings by building type, 100 m cells summed to 500 m: share of dwellings in 1- and 2-family houses."""
    if not DWELL_ZIP_PATH.exists():
        urllib.request.urlretrieve(DWELL_URL, DWELL_ZIP_PATH)
    columns = ["x_mp_100m", "y_mp_100m", *DWELL_HOUSE_COLUMNS, *DWELL_OTHER_COLUMNS]
    with zipfile.ZipFile(DWELL_ZIP_PATH) as archive:
        with archive.open(DWELL_CSV) as file:
            # "–" marks an empty class; cp1252 decodes it, to_numeric turns it into 0
            cells = pd.read_csv(file, sep=";", encoding="cp1252", usecols=columns, dtype=str)
    counts = cells[DWELL_HOUSE_COLUMNS + DWELL_OTHER_COLUMNS].apply(pd.to_numeric, errors="coerce").fillna(0)
    # Same EPSG:3035 grid as the population: each 500 m cell holds exactly 5 x 5 cells of 100 m
    counts["x_ll"] = cells["x_mp_100m"].astype(int) // POP_CELL * POP_CELL
    counts["y_ll"] = cells["y_mp_100m"].astype(int) // POP_CELL * POP_CELL
    counts = counts.groupby(["x_ll", "y_ll"]).sum()
    houses = counts[DWELL_HOUSE_COLUMNS].sum(axis=1)
    total = houses + counts[DWELL_OTHER_COLUMNS].sum(axis=1)
    # The share uses the sum of the classes as total, since published counts are perturbed and may not add up
    return (houses / total.where(total > 0)).rename("house_share").reset_index()


def save_demand_gap_grid():
    # Floating catchment: around each 500 m cell, the public EV demand within GAP_RADIUS_M is set against the public
    # charging points (Bundesnetzagentur register) within the same radius. ev_per_point = demand / points,
    # where no charging point in reach counts as one, so those cells are ranked by their demand alone (points stays 0).
    # Home-charging correction: ev_public = ev_index x (1 - HOME_CHARGING_RATE x share of dwellings in 1-2-family houses),
    # since owners with their own driveway or garage mostly charge at home. Cells without dwelling data keep ev_index.
    # The register extract holds only BW stations, so cells near the state border overstate the gap.
    if GAP_OUT.exists():
        print(f"{GAP_OUT} already exists, skipping")
        return
    save_chargers()
    save_ev_population_grid()

    with open(EV_POP_OUT, encoding="utf-8") as file:
        grid = json.load(file)
    cells = pd.DataFrame(grid["rows"], columns=grid["columns"])
    with open(CHARGERS_OUT, encoding="utf-8") as file:
        register = json.load(file)
    chargers = pd.DataFrame(register["rows"], columns=register["columns"])
    points = pd.to_numeric(chargers["Anzahl Ladepunkte"], errors="coerce").fillna(1).to_numpy()
    kw = pd.to_numeric(chargers["Nennleistung Ladeeinrichtung [kW]"].str.replace(",", "."), errors="coerce").fillna(0)

    # Distances in metres: both point sets go to EPSG:3035
    def metres(lon, lat):
        projected = gpd.GeoSeries(gpd.points_from_xy(lon, lat, crs="EPSG:4326")).to_crs("EPSG:3035")
        return np.column_stack([projected.x, projected.y])

    cell_xy = metres(cells["lon"], cells["lat"])
    charger_xy = metres(chargers["Längengrad"], chargers["Breitengrad"])
    kw = kw.to_numpy()

    # The cell centre lies 250 m inside its 500 m cell, so flooring finds the lower-left corner despite rounded lat/lon
    cells["x_ll"] = (cell_xy[:, 0] // POP_CELL * POP_CELL).astype(int)
    cells["y_ll"] = (cell_xy[:, 1] // POP_CELL * POP_CELL).astype(int)
    cells = cells.merge(read_house_shares(), on=["x_ll", "y_ll"], how="left")  # a left merge keeps the row order
    cells["house_share"] = cells["house_share"].round(3)
    cells["ev_public"] = (cells["ev_index"] * (1 - HOME_CHARGING_RATE * cells["house_share"].fillna(0))).round(1)
    ev_public = cells["ev_public"].fillna(0).to_numpy()

    near_cells = KDTree(cell_xy).query_radius(cell_xy, r=GAP_RADIUS_M)
    near_chargers = KDTree(charger_xy).query_radius(cell_xy, r=GAP_RADIUS_M)
    cells["demand"] = [ev_public[idx].sum().round(1) for idx in near_cells]
    cells["stations"] = [len(idx) for idx in near_chargers]
    cells["points"] = [int(points[idx].sum()) for idx in near_chargers]
    cells["kw"] = [round(kw[idx].sum()) for idx in near_chargers]
    cells["ev_per_point"] = (cells["demand"] / cells["points"].clip(lower=1)).round(1)

    # Only cells with demand of their own are shown
    cells = cells[cells["ev_index"] > 0]
    columns = ["lat", "lon", "Einwohner", "ev_index", "house_share", "ev_public", "demand", "stations", "points", "kw", "ev_per_point"]
    rows = cells[columns].astype(object).where(cells[columns].notna(), None).to_dict("split")["data"]
    with open(GAP_OUT, "w", encoding="utf-8") as file:
        json.dump(
            {"columns": columns, "radius_m": GAP_RADIUS_M, "home_charging_rate": HOME_CHARGING_RATE, "rows": rows}, file
        )
    no_point = (cells["points"] == 0).sum()
    print(f"{len(rows)} {POP_CELL} m cells ({no_point} without a charging point within {GAP_RADIUS_M} m) saved to {GAP_OUT}")


def _read_income_grid(archive, name):
    # Bundesagentur für Arbeit grid: ";" separator, "." thousands separator, cp1252; trailing rows are empty
    with archive.open(name) as file:
        grid = pd.read_csv(file, sep=";", encoding="cp1252", thousands=".", dtype={"Gitter-ID": str})
    grid.columns = ["cell", "median_eur", "employees"]
    grid = grid.dropna(subset=["cell"])
    # A median is only published for cells with at least 500 employees; 0 means "not published"
    grid["median_eur"] = grid["median_eur"].where(grid["median_eur"] > 0)
    return grid.set_index("cell")


def _read_income_districts():
    """Median monthly gross wage per district (Kreis) by place of residence, BA sheet 9.1."""
    table = pd.read_excel(INCOME_KREIS_PATH, sheet_name=INCOME_KREIS_SHEET, header=None, dtype={0: str})
    # Column A: region key (5 digits = district), column J: median in EUR
    table = table[table[0].str.fullmatch(r"\d{5}", na=False)]
    return pd.to_numeric(table.set_index(0)[9], errors="coerce").rename("median_eur")


def save_income_population_grid():
    # Each 500 m cell takes the median wage of its 1 km parent, else of its 5 km parent, else of its district
    # (Kreis), wherever the finer value is not published. The median is an intensive value, so it is assigned,
    # not split. The employee count is a count, so the 1 km value is split over the 500 m children by their
    # share of residents.
    if INCOME_POP_OUT.exists():
        print(f"{INCOME_POP_OUT} already exists, skipping")
        return
    for path in [INCOME_ZIP_PATH, INCOME_KREIS_PATH]:
        if not path.exists():
            raise FileNotFoundError(f"{path} is missing; download the BA data by hand")
    with zipfile.ZipFile(INCOME_ZIP_PATH) as archive:
        grid_1km = _read_income_grid(archive, INCOME_1KM_CSV)
        grid_5km = _read_income_grid(archive, INCOME_5KM_CSV)
    districts = _read_income_districts()

    cells = read_bw_population_cells()
    # All grids are EPSG:3035 and aligned; parent IDs come from the 500 m cell centre
    cells["cell_1km"] = ("1kmN" + (cells["y_mp"] // 1000).astype(int).astype(str)
                         + "E" + (cells["x_mp"] // 1000).astype(int).astype(str))
    cells["cell_5km"] = ("5kmN" + (cells["y_mp"] // 5000 * 5).astype(int).astype(str)
                         + "E" + (cells["x_mp"] // 5000 * 5).astype(int).astype(str))
    # District of each cell centre; the nearest district catches centres on a simplified border
    kreise = gpd.read_file(OUT_PATH)[["AGS", "geometry"]].to_crs("EPSG:3035")
    nearest = gpd.sjoin_nearest(cells[["geometry"]].to_crs("EPSG:3035"), kreise, how="left")
    cells["AGS"] = nearest[~nearest.index.duplicated()]["AGS"]
    median_1km = cells["cell_1km"].map(grid_1km["median_eur"])
    median_5km = cells["cell_5km"].map(grid_5km["median_eur"])
    median_kreis = cells["AGS"].map(districts)
    cells["median_income"] = median_1km.fillna(median_5km).fillna(median_kreis)
    cells["income_source"] = np.select(
        [median_1km.notna(), median_5km.notna(), median_kreis.notna()], ["1km", "5km", "kreis"], default=None
    )

    # Residents of each 1 km parent = sum over its 500 m children in BW
    parent_pop = cells.groupby("cell_1km")["Einwohner"].transform("sum")
    cells["employees"] = (cells["cell_1km"].map(grid_1km["employees"]).fillna(0) * cells["Einwohner"] / parent_pop).round(1)
    # Monthly gross wage sum of resident employees (EUR), a purchasing-power proxy
    cells["wage_sum"] = (cells["employees"] * cells["median_income"]).round(0)

    columns = ["lat", "lon", "Einwohner", "median_income", "income_source", "employees", "wage_sum", "cell_1km"]
    rows = [
        [round(p.y, 5), round(p.x, 5), int(e), None if pd.isna(m) else m, None if pd.isna(s) else s, emp,
         None if pd.isna(w) else w, c]
        for p, e, m, s, emp, w, c in zip(cells.geometry, cells["Einwohner"], cells["median_income"],
                                         cells["income_source"], cells["employees"], cells["wage_sum"], cells["cell_1km"])
    ]
    with open(INCOME_POP_OUT, "w", encoding="utf-8") as file:
        json.dump({"columns": columns, "rows": rows}, file)
    counts = cells["income_source"].value_counts()
    print(f"{len(rows)} {POP_CELL} m cells (median from 1 km: {counts.get('1km', 0)}, 5 km: {counts.get('5km', 0)}, "
          f"district: {counts.get('kreis', 0)}) "
          f"saved to {INCOME_POP_OUT}")


def _load_parking_csv(path, columns):
    """Read a parking CSV and return a GeoDataFrame with the given columns."""
    df = pd.read_csv(path, low_memory=False)
    # Keep only rows that have a parseable geometry
    df = df[df["geometry"].notna()]
    present = [c for c in columns if c in df.columns]
    gdf = gpd.GeoDataFrame(df[present], geometry=gpd.GeoSeries.from_wkt(df["geometry"]), crs="EPSG:4326")
    # Fill missing columns so both sources share the same schema
    for c in columns:
        if c not in gdf.columns:
            gdf[c] = None
    return gdf[columns + ["geometry"]]


def save_parking():
    if PARK_OUT.exists():
        print(f"{PARK_OUT} already exists, skipping")
        return
    if not PARK_CSV_PATH.exists():
        urllib.request.urlretrieve(PARK_URL, PARK_CSV_PATH)

    off_street = _load_parking_csv(PARK_CSV_PATH, PARK_COLUMNS)

    # Street parking (ON_STREET) from a separate download
    if STREET_PARK_CSV_PATH.exists():
        street = _load_parking_csv(STREET_PARK_CSV_PATH, PARK_COLUMNS)
        # Carry FID through for dedup; _load_parking_csv doesn't include it
        off_street["_fid"] = pd.read_csv(PARK_CSV_PATH, low_memory=False, usecols=["FID"])["FID"].values
        street["_fid"] = pd.read_csv(STREET_PARK_CSV_PATH, low_memory=False, usecols=["FID"])["FID"].values
        parking = pd.concat([off_street, street], ignore_index=True)
        # Drop duplicates that appear in both downloads (same FID)
        parking = gpd.GeoDataFrame(parking.drop_duplicates("_fid", keep="first").drop(columns="_fid"), crs="EPSG:4326")
        print(f"  off-street: {len(off_street)}, street: {len(street)}, after dedup: {len(parking)}")
    else:
        parking = off_street
        print("  street parking file not found, using off-street only")

    # The download also contains points outside Baden-Württemberg; keep only those inside its outline
    states = gpd.read_file(STATES_OUT)
    bw = states[states["AGS"] == "08"]
    parking = gpd.sjoin(parking, bw[["geometry"]], predicate="within")[PARK_COLUMNS + ["geometry"]]
    parking.to_file(PARK_OUT, driver="GeoJSON")
    print(f"{len(parking)} parking sites saved to {PARK_OUT}")


COMBINED_PARK_OUT = Path("data/processed/parkplaetze_kombiniert_bw.geojson")
PARK_MATCH_M = 10  # max distance between an OSM and a MobiData parking site to count as the same site
OSM_PARK_COLUMNS = ["osm_id", "osm_type", "parking", "access", "fee", "surface"]


def save_combined_parking():
    """OSM parking is the base; MobiData attributes are joined on within PARK_MATCH_M, unmatched MobiData sites are appended."""
    if COMBINED_PARK_OUT.exists():
        print(f"{COMBINED_PARK_OUT} already exists, skipping")
        return
    save_parking()
    save_osm_parking()
    # Metric CRS for the distance threshold
    osm = gpd.read_file(OSM_PARK_OUT).to_crs(25832).reset_index(drop=True)
    mobi = gpd.read_file(PARK_OUT).to_crs(25832).reset_index(drop=True)
    mobi["_mobi_id"] = mobi.index

    joined = gpd.sjoin_nearest(
        osm, mobi, how="left", max_distance=PARK_MATCH_M, distance_col="_dist", lsuffix="osm", rsuffix="mobi"
    )
    # Ties give several rows per OSM site; keep one. Each MobiData site is attached to its closest OSM site only.
    joined = joined.sort_values("_dist").drop_duplicates(["osm_id", "osm_type"])
    # Further OSM sites near an already attached MobiData site stay as plain OSM sites without MobiData attributes
    extra = joined["_mobi_id"].notna() & joined.duplicated("_mobi_id")
    mobi_cols = [c for c in joined.columns if c.endswith("_mobi") or c in PARK_COLUMNS or c == "_mobi_id"]
    joined.loc[extra, mobi_cols] = None
    matched = joined[joined["_mobi_id"].notna()]

    # Columns that exist in both sources get the MobiData value, with the OSM value as fallback
    joined["name"] = joined["name_mobi"].combine_first(joined["name_osm"])
    joined["operator_name"] = joined["operator_name"].combine_first(joined["operator"])
    joined["capacity"] = pd.to_numeric(joined["capacity_mobi"], errors="coerce").combine_first(
        pd.to_numeric(joined["capacity_osm"], errors="coerce"))
    joined["source"] = np.where(joined["_mobi_id"].notna(), "osm+mobidata", "osm")

    columns = PARK_COLUMNS + OSM_PARK_COLUMNS + ["source"]
    both = joined.reindex(columns=columns + ["geometry"])
    mobi_only = mobi[~mobi["_mobi_id"].isin(matched["_mobi_id"])].copy()
    mobi_only["source"] = "mobidata"
    mobi_only["capacity"] = pd.to_numeric(mobi_only["capacity"], errors="coerce")
    combined = pd.concat([both, mobi_only.reindex(columns=columns + ["geometry"])], ignore_index=True)
    combined = gpd.GeoDataFrame(combined, geometry="geometry", crs=25832).to_crs(4326)
    combined.to_file(COMBINED_PARK_OUT, driver="GeoJSON")
    counts = combined["source"].value_counts().to_dict()
    print(f"{len(combined)} combined parking sites saved to {COMBINED_PARK_OUT} ({counts})")


def save_historic_stations():
    if HIST_OUT.exists():
        print(f"{HIST_OUT} already exists, skipping")
        return
    # One day of the MobiData BW history (18 Oct 2026); keep the latest snapshot per station
    history = pd.read_csv(HIST_CSV, compression="gzip", low_memory=False)
    history = history.sort_values("datastore_updated_at").drop_duplicates("id", keep="last")
    points = gpd.GeoDataFrame(
        history[HIST_COLUMNS],
        geometry=gpd.GeoSeries.from_wkt(history["geometry"]),
        crs="EPSG:4326",
    )
    states = gpd.read_file(STATES_OUT)
    points = gpd.sjoin(points, states[states["AGS"] == "08"][["geometry"]], predicate="within")
    points[HIST_COLUMNS + ["geometry"]].to_file(HIST_OUT, driver="GeoJSON")
    print(f"{len(points)} historic stations in Baden-Württemberg saved to {HIST_OUT}")


OSM_PARK_OUT = Path("data/processed/parkplaetze_osm_bw.geojson")
OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """
[out:json][timeout:300];
area["name"="Baden-Württemberg"]["admin_level"="4"]->.bw;
(node["amenity"="parking"](area.bw);way["amenity"="parking"](area.bw););
out center;
"""


def save_osm_parking():
    if OSM_PARK_OUT.exists():
        print(f"{OSM_PARK_OUT} already exists, skipping")
        return
    import requests
    resp = requests.post(OVERPASS_URL, data={"data": OVERPASS_QUERY}, timeout=300)
    resp.raise_for_status()
    elements = resp.json().get("elements", [])
    features = []
    for el in elements:
        if el["type"] == "node":
            lat, lon = el["lat"], el["lon"]
        elif "center" in el:
            lat, lon = el["center"]["lat"], el["center"]["lon"]
        else:
            continue
        tags = el.get("tags", {})
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "osm_id": el["id"], "osm_type": el["type"],
                "name": tags.get("name"), "parking": tags.get("parking"),
                "access": tags.get("access"), "capacity": tags.get("capacity"),
                "fee": tags.get("fee"), "surface": tags.get("surface"),
                "operator": tags.get("operator"),
            },
        })
    with open(OSM_PARK_OUT, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False)
    print(f"{len(features)} OSM parking features saved to {OSM_PARK_OUT}")


OSM_PBF_URL = "https://download.geofabrik.de/europe/germany/baden-wuerttemberg-latest.osm.pbf"
OSM_PBF_PATH = Path("data/raw/baden-wuerttemberg-latest.osm.pbf")
OSM_ROADS_OUT = Path("data/processed/strassen_osm_bw.geojson")
OSM_ROAD_POINTS_OUT = Path("data/processed/strassenpunkte_osm_bw.geojson")
OSM_POIS_OUT = Path("data/processed/poi_osm_bw.geojson")
OSM_SUBSTATIONS_OUT = Path("data/processed/umspannwerke_osm_bw.geojson")
OSM_KEYS = ("highway", "power", "shop", "office", "amenity", "landuse")
OSM_ROAD_TYPES = {"motorway", "trunk", "primary"}
OSM_RETAIL_SHOPS = {"mall", "department_store", "doityourself", "furniture", "electronics", "garden_centre"}


def _osm_poi_category(tags):
    """Return the POI category of an OSM object, or None if it is not a POI we use."""
    shop = tags.get("shop")
    if shop == "supermarket":
        return "supermarket"
    if shop in OSM_RETAIL_SHOPS:
        return "retail"
    if "office" in tags and tags.get("office") != "no":
        return "office"
    if tags.get("landuse") in ("industrial", "commercial"):
        return "industrial"
    amenity = tags.get("amenity")
    if amenity == "hospital":
        return "hospital"
    if amenity in ("university", "college"):
        return "university"
    return None


def _classify_osm_point(tags):
    """Return (layer, properties) for an OSM node or area, or None if it is not needed."""
    highway = tags.get("highway")
    if highway == "motorway_junction":
        return "road_points", {"kind": "junction", "name": tags.get("name"), "ref": tags.get("ref")}
    if highway in ("rest_area", "services"):
        return "road_points", {"kind": highway, "name": tags.get("name"), "ref": tags.get("ref")}
    if tags.get("power") == "substation":
        return "substations", {
            "name": tags.get("name"), "operator": tags.get("operator"),
            "voltage": tags.get("voltage"), "substation": tags.get("substation"),
        }
    category = _osm_poi_category(tags)
    if category:
        return "pois", {"category": category, "name": tags.get("name")}
    return None


@lru_cache(maxsize=1)
def _read_osm():
    """Read roads, road points, POIs and substations from the PBF in one pass (several minutes)."""
    import osmium
    import shapely

    if not OSM_PBF_PATH.exists():
        urllib.request.urlretrieve(OSM_PBF_URL, OSM_PBF_PATH)

    layers = {"roads": [], "road_points": [], "pois": [], "substations": []}
    wkb = osmium.geom.WKBFactory()
    broken_areas = 0
    # Tag filtering runs in C++, so Python only sees the objects that can match
    objects = (
        osmium.FileProcessor(str(OSM_PBF_PATH))
        .with_locations()
        .with_areas()
        .with_filter(osmium.filter.KeyFilter(*OSM_KEYS))
    )
    for obj in objects:
        if obj.is_way():
            highway = obj.tags.get("highway")
            if highway in OSM_ROAD_TYPES:
                coords = [(node.lon, node.lat) for node in obj.nodes if node.location.valid()]
                if len(coords) >= 2:
                    layers["roads"].append((shapely.LineString(coords), {
                        "osm_id": obj.id, "highway": highway, "ref": obj.tags.get("ref"),
                        "name": obj.tags.get("name"), "maxspeed": obj.tags.get("maxspeed"),
                        "lanes": obj.tags.get("lanes"),
                    }))
        elif obj.is_node():
            match = _classify_osm_point(obj.tags)
            if match and obj.location.valid():
                layer, properties = match
                layers[layer].append((shapely.Point(obj.lon, obj.lat), {"osm_id": obj.id, "osm_type": "node", **properties}))
        elif obj.is_area():
            match = _classify_osm_point(obj.tags)
            if match:
                try:
                    shape = shapely.from_wkb(wkb.create_multipolygon(obj))
                except RuntimeError:
                    broken_areas += 1
                    continue
                layer, properties = match
                # Areas become their centre point, so nodes and areas share one geometry type
                osm_type = "way" if obj.from_way() else "relation"
                layers[layer].append((shape.centroid, {"osm_id": obj.orig_id(), "osm_type": osm_type, **properties}))
    if broken_areas:
        print(f"  {broken_areas} OSM areas skipped: invalid geometry")
    return layers


def _save_osm_layer(layer, out_path, predicate="within"):
    if out_path.exists():
        print(f"{out_path} already exists, skipping")
        return
    rows = _read_osm()[layer]
    features = gpd.GeoDataFrame([row[1] for row in rows], geometry=[row[0] for row in rows], crs="EPSG:4326")
    # The Geofabrik extract reaches slightly beyond the state border
    states = gpd.read_file(STATES_OUT)
    features = gpd.sjoin(features, states[states["AGS"] == "08"][["geometry"]], predicate=predicate)
    features.drop(columns="index_right").to_file(out_path, driver="GeoJSON")
    print(f"{len(features)} OSM {layer} features saved to {out_path}")


def save_osm_roads():
    # Roads crossing the border stay whole
    _save_osm_layer("roads", OSM_ROADS_OUT, predicate="intersects")


def save_osm_road_points():
    _save_osm_layer("road_points", OSM_ROAD_POINTS_OUT)


def save_osm_pois():
    _save_osm_layer("pois", OSM_POIS_OUT)


def save_osm_substations():
    _save_osm_layer("substations", OSM_SUBSTATIONS_OUT)


HIST_WEEK_URL = "https://mobidata-bw.de/daten/historisierung/woche/{year}/{week}_89fb3a0b-cc42-48a6-b17a-8f1b46abccf1.csv.gz"


def download_historic_weeks(start="2026-02-01", end="2026-10-18"):
    # Weekly snapshots (ISO weeks) of the charger history; already downloaded weeks are skipped
    HIST_DIR.mkdir(parents=True, exist_ok=True)
    days = pd.date_range(start, end).isocalendar()
    for year, week in sorted(set(zip(days["year"], days["week"]))):
        name = f"{year}{week:02d}"
        path = HIST_DIR / f"{name}_ladesaeulen_woche.csv.gz"
        if path.exists():
            continue
        try:
            urllib.request.urlretrieve(HIST_WEEK_URL.format(year=year, week=name), path.with_suffix(".part"))
            path.with_suffix(".part").rename(path)
            print(f"week {name} downloaded")
        except urllib.error.HTTPError as error:
            print(f"week {name} skipped: {error}")


def main():
    save_districts()
    save_states()
    save_chargers()
    save_population()
    save_ev_grid()
    save_ev_population_grid()
    save_demand_gap_grid()
    save_income_population_grid()
    save_parking()
    save_historic_stations()
    save_osm_parking()
    save_combined_parking()
    save_osm_roads()
    save_osm_road_points()
    save_osm_pois()
    save_osm_substations()
    save_traffic_counters()
    save_daily_occupancy()
    save_occupancy_workbook()


if __name__ == "__main__":
    main()
