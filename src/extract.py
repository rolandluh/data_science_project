"""Data acquisition: download BKG district boundaries and Bundesnetzagentur charging stations, save Baden-Württemberg subsets."""
from datetime import date
import html
from pathlib import Path
import json
import os
import re
import urllib.error
import urllib.request
from urllib.parse import urljoin
import zipfile

import geopandas as gpd
import pandas as pd

URL = "https://daten.gdz.bkg.bund.de/produkte/vg/vg250_ebenen_0101/2020/vg250_01-01.geo84.shape.ebenen.zip"
ZIP_PATH = Path("data/raw/vg250.zip")
LAYER = "vg250_01-01.geo84.shape.ebenen/vg250_ebenen_0101/VG250_KRS.shp"
OUT_PATH = Path("data/processed/kreise_bw.geojson")
STATES_LAYER = "vg250_01-01.geo84.shape.ebenen/vg250_ebenen_0101/VG250_LAN.shp"
STATES_OUT = Path("data/processed/laender.geojson")

DEFAULT_CHARGERS_URL = "https://data.bundesnetzagentur.de/Bundesnetzagentur/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/Ladesaeulenregister_BNetzA_2026-09-01.csv"
CHARGERS_DOWNLOAD_PAGE = "https://www.bundesnetzagentur.de/DE/Fachthemen/ElektrizitaetundGas/E-Mobilitaet/DownloadundKontakt.html?nn=686258"
# Set CHARGERS_URL only to pin a specific official CSV release. Otherwise a
# refresh discovers the newest CSV linked from the official download page.
CHARGERS_URL = os.environ.get("CHARGERS_URL")
CHARGERS_PATH = Path("data/raw/ladesaeulenregister.csv")
CHARGERS_OUT = Path("data/processed/ladesaeulen.json")

POP_URL = "https://www.destatis.de/static/DE/zensus/gitterdaten/Zensus2022_Bevoelkerungszahl.zip"
POP_ZIP_PATH = Path("data/raw/zensus2022_bevoelkerung_gitter.zip")
POP_CSV = "Zensus2022_Bevoelkerungszahl_1km-Gitter.csv"
POP_OUT = Path("data/processed/bevoelkerung_1km.json")

KBA_URL = "https://www.kba.de/SharedDocs/Downloads/DE/Statistik/Fahrzeuge/"
FZ3_URL = KBA_URL + "FZ3/fz3_2024.xlsx?__blob=publicationFile&v=2"
FZ3_PATH = Path("data/raw/kba_fz3_2024.xlsx")
FZ27_URL = KBA_URL + "FZ27/fz27_202410.xlsx?__blob=publicationFile&v=2"
FZ27_PATH = Path("data/raw/kba_fz27_202410.xlsx")
GEM_LAYER = "vg250_01-01.geo84.shape.ebenen/vg250_ebenen_0101/VG250_GEM.shp"
GEMEINDEN_OUT = Path("data/processed/gemeinden_ev.geojson")

PARK_URL = "https://api.mobidata-bw.de/geoserver/MobiData-BW/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=MobiData-BW%3Apark-api_car&cql_filter=type%3C%3E%27ON_STREET%27%20OR%20type%20is%20NULL&maxFeatures=30000&outputFormat=csv"
PARK_CSV_PATH = Path("data/raw/parkplaetze_bw_wfs.csv")
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


def download(url, path, refresh=False):
    """Download a source file atomically, keeping the previous file on failure."""
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and not refresh:
        return False
    temporary = path.with_suffix(path.suffix + ".part")
    try:
        urllib.request.urlretrieve(url, temporary)
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise
    return True


def discover_chargers_url():
    """Return the newest official CSV link published on the BNetzA download page."""
    request = urllib.request.Request(
        CHARGERS_DOWNLOAD_PAGE,
        headers={"User-Agent": "BW-EV-research-pipeline/1.0"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        page = response.read().decode("utf-8", errors="replace")
    links = re.findall(r'href=["\']([^"\']+)["\']', page, flags=re.IGNORECASE)
    candidates = [
        urljoin(CHARGERS_DOWNLOAD_PAGE, html.unescape(link))
        for link in links
        if "ladesaeulen" in link.lower() and ".csv" in link.lower()
    ]
    if not candidates:
        raise ValueError("No charger-register CSV link found on the official download page")
    return candidates[0]


def save_districts():
    if not ZIP_PATH.exists():
        download(URL, ZIP_PATH)

    kreise = gpd.read_file(f"/vsizip/{ZIP_PATH.as_posix()}/{LAYER}", encoding="utf-8")
    # AGS 08 = Baden-Württemberg; 5-digit keys are districts
    kreise = kreise[kreise["AGS"].str.startswith("08") & (kreise["AGS"].str.len() == 5)]
    # Some districts are stored as several rows (e.g. Konstanz); merge them into one
    kreise = kreise.dissolve(by="AGS", aggfunc="first").reset_index()
    kreise[["AGS", "GEN", "BEZ", "geometry"]].to_file(OUT_PATH, driver="GeoJSON")
    print(f"{len(kreise)} districts saved to {OUT_PATH}")


def save_states():
    if not ZIP_PATH.exists():
        download(URL, ZIP_PATH)

    states = gpd.read_file(f"/vsizip/{ZIP_PATH.as_posix()}/{STATES_LAYER}", encoding="utf-8")
    # Merge multi-row entries so each state is one shape
    states = states.dissolve(by="AGS", aggfunc="first").reset_index()
    states[["AGS", "GEN", "geometry"]].to_file(STATES_OUT, driver="GeoJSON")
    print(f"{len(states)} states saved to {STATES_OUT}")


def save_chargers(refresh=False):
    """Refresh the configured or newest official Bundesnetzagentur register."""
    source_url = CHARGERS_URL or DEFAULT_CHARGERS_URL
    if refresh and CHARGERS_URL is None:
        try:
            source_url = discover_chargers_url()
        except (OSError, ValueError) as error:
            print(f"Could not discover the newest charger register; using configured fallback: {error}")
    download(source_url, CHARGERS_PATH, refresh=refresh)
    print(f"Charger register source: {source_url}")

    # The first 10 lines are notes; the header is on line 11
    chargers = pd.read_csv(CHARGERS_PATH, sep=";", skiprows=10, encoding="utf-8-sig", dtype=str)
    chargers = chargers[chargers["Bundesland"] == "Baden-Württemberg"]
    # Public keys are long cryptographic strings, not useful for the map
    chargers = chargers.drop(columns=[col for col in chargers.columns if col.startswith("Public Key")])
    # Coordinates use a comma as decimal separator
    for col in ["Breitengrad", "Längengrad"]:
        chargers[col] = chargers[col].str.replace(",", ".").astype(float)
    # A small number of records labelled Baden-Württemberg have coordinates far
    # outside the state. Excluding them prevents misplaced map markers and ML
    # features based on the wrong location.
    valid_coordinates = (
        chargers["Breitengrad"].between(47.0, 50.2)
        & chargers["Längengrad"].between(7.0, 10.8)
    )
    excluded = int((~valid_coordinates).sum())
    chargers = chargers[valid_coordinates].copy()
    if excluded:
        print(f"{excluded} charger records excluded because their coordinates are outside Baden-Württemberg")
    # Columns once, then rows as arrays: much smaller than one object per station
    rows = chargers.astype(object).where(chargers.notna(), None).values.tolist()
    with open(CHARGERS_OUT, "w", encoding="utf-8") as file:
        json.dump({"columns": list(chargers.columns), "rows": rows}, file, ensure_ascii=False)
    print(f"{len(chargers)} charging stations saved to {CHARGERS_OUT}")


def save_population():
    if not POP_ZIP_PATH.exists():
        download(POP_URL, POP_ZIP_PATH)

    with zipfile.ZipFile(POP_ZIP_PATH) as archive:
        with archive.open(POP_CSV) as file:
            cells = pd.read_csv(file, sep=";")
    cells["Einwohner"] = pd.to_numeric(cells["Einwohner"], errors="coerce")
    cells = cells[cells["Einwohner"] > 0]
    # Cell centres are in EPSG:3035 (metres); the map needs lat/lon
    points = gpd.GeoDataFrame(
        {"Einwohner": cells["Einwohner"].values},
        geometry=gpd.points_from_xy(cells["x_mp_1km"], cells["y_mp_1km"], crs="EPSG:3035").to_crs("EPSG:4326"),
    )
    # Keep only cells whose centre lies inside Baden-Württemberg
    states = gpd.read_file(STATES_OUT)
    points = gpd.sjoin(points, states[states["AGS"] == "08"][["geometry"]], predicate="within")
    rows = list(zip(points.geometry.y.tolist(), points.geometry.x.tolist(), points["Einwohner"].tolist()))
    with open(POP_OUT, "w", encoding="utf-8") as file:
        json.dump(rows, file)
    print(f"{len(rows)} populated 1 km cells saved to {POP_OUT}")


def read_ev_by_municipality():
    # FZ 27.17: car counts per municipality, no key; the district (Zulassungsbezirk) is only on the first row of each block
    ev = pd.read_excel(FZ27_PATH, sheet_name="FZ 27.17", header=None).iloc[:, 1:10]
    ev.columns = ["land", "bezirk", "gemeinde", "gew_pkw", "gew_bev", "gew_phev", "priv_pkw", "priv_bev", "priv_phev"]
    ev["bezirk"] = ev["bezirk"].ffill()
    ev = ev[ev["bezirk"].astype(str).str.match(r"\d{5}") & ev["gemeinde"].notna()]
    ev = ev[ev["gemeinde"].astype(str).str.upper() != "ZUSAMMEN"]
    ev["bez5"] = ev["bezirk"].astype(str).str[:5]
    ev["name"] = ev["gemeinde"].astype(str).str.strip()
    return ev


def read_municipality_keys():
    # FZ 3.1 has the 8-digit AGS next to each municipality name
    keys = pd.read_excel(FZ3_PATH, sheet_name="FZ 3.1", header=None).iloc[:, 2:4]
    keys.columns = ["bezirk", "gemeinde_ags"]
    keys["bezirk"] = keys["bezirk"].ffill()
    keys = keys[keys["bezirk"].astype(str).str.match(r"\d{5}") & keys["gemeinde_ags"].astype(str).str.match(r"\d{8} ")]
    keys["bez5"] = keys["bezirk"].str[:5]
    keys["ags"] = keys["gemeinde_ags"].str[:8]
    keys["name"] = keys["gemeinde_ags"].str[9:].str.strip()
    return keys.drop_duplicates(["bez5", "name"])[["bez5", "name", "ags"]]


def save_ev_municipalities():
    for url, path in [(FZ3_URL, FZ3_PATH), (FZ27_URL, FZ27_PATH), (URL, ZIP_PATH)]:
        if not path.exists():
            download(url, path)

    ev = read_ev_by_municipality().merge(read_municipality_keys(), on=["bez5", "name"], how="inner")
    counts = ["gew_pkw", "gew_bev", "gew_phev", "priv_pkw", "priv_bev", "priv_phev"]
    ev[counts] = ev[counts].apply(pd.to_numeric, errors="coerce")
    per_ags = ev.groupby("ags")[counts].sum()
    per_ags["pkw"] = per_ags["gew_pkw"] + per_ags["priv_pkw"]
    per_ags["bev"] = per_ags["gew_bev"] + per_ags["priv_bev"]
    per_ags["phev"] = per_ags["gew_phev"] + per_ags["priv_phev"]

    gemeinden = gpd.read_file(f"/vsizip/{ZIP_PATH.as_posix()}/{GEM_LAYER}", encoding="utf-8")[["AGS", "GEN", "geometry"]]
    # AGS 08 = Baden-Württemberg
    gemeinden = gemeinden[gemeinden["AGS"].str.startswith("08")]
    gemeinden = gemeinden.merge(per_ags[["pkw", "bev", "phev"]], left_on="AGS", right_index=True, how="left")
    # Simplify outlines (about 100 m) to keep the file small enough for the browser
    gemeinden["geometry"] = gemeinden.geometry.simplify(0.001, preserve_topology=True)
    gemeinden.to_file(GEMEINDEN_OUT, driver="GeoJSON")
    print(f"{gemeinden['bev'].notna().sum()} of {len(gemeinden)} municipalities with EV counts saved to {GEMEINDEN_OUT}")


def save_parking(refresh=False):
    """Refresh the live MobiData WFS parking feed when requested."""
    download(PARK_URL, PARK_CSV_PATH, refresh=refresh)

    parking = pd.read_csv(PARK_CSV_PATH, low_memory=False)
    # Geometry is WKT, e.g. "POINT (8.40 48.98)"
    parking = gpd.GeoDataFrame(parking[PARK_COLUMNS], geometry=gpd.GeoSeries.from_wkt(parking["geometry"]), crs="EPSG:4326")
    # The download also contains points outside Baden-Württemberg; keep only those inside its outline
    states = gpd.read_file(STATES_OUT)
    bw = states[states["AGS"] == "08"]
    parking = gpd.sjoin(parking, bw[["geometry"]], predicate="within")[PARK_COLUMNS + ["geometry"]]
    parking.to_file(PARK_OUT, driver="GeoJSON")
    print(f"{len(parking)} parking sites saved to {PARK_OUT}")


def latest_historic_file():
    """Return the newest cached historic file, or None when no snapshot is available."""
    files = sorted(HIST_DIR.glob("*_ladesaeulen*.csv.gz"), key=lambda item: item.stat().st_mtime)
    return files[-1] if files else None


def archive_historic_snapshot(points):
    """Keep one Baden-Württemberg status snapshot per ISO week for ML training."""
    timestamps = pd.to_datetime(points["datastore_updated_at"], errors="coerce")
    snapshot = timestamps.max()
    if pd.isna(snapshot):
        reference_date = date.today()
        year, week, _ = reference_date.isocalendar()
    else:
        iso = snapshot.isocalendar()
        year, week = int(iso.year), int(iso.week)
    archive = HIST_OUT.parent / "history" / f"{year}-W{week:02d}.geojson"
    archive.parent.mkdir(parents=True, exist_ok=True)
    temporary = archive.with_name(f"{archive.stem}.tmp.geojson")
    points[HIST_COLUMNS + ["geometry"]].to_file(temporary, driver="GeoJSON")
    temporary.replace(archive)
    return archive


def save_historic_stations():
    """Create the BW snapshot from the newest cached history file, if available."""
    history_file = latest_historic_file()
    if history_file is None:
        print("Historic data skipped: no cached history file. Run with --history to fetch one week.")
        return False
    history = pd.read_csv(history_file, compression="gzip", low_memory=False)
    history = history.sort_values("datastore_updated_at").drop_duplicates("id", keep="last")
    points = gpd.GeoDataFrame(
        history[HIST_COLUMNS],
        geometry=gpd.GeoSeries.from_wkt(history["geometry"]),
        crs="EPSG:4326",
    )
    states = gpd.read_file(STATES_OUT)
    points = gpd.sjoin(points, states[states["AGS"] == "08"][["geometry"]], predicate="within")
    points[HIST_COLUMNS + ["geometry"]].to_file(HIST_OUT, driver="GeoJSON")
    archive = archive_historic_snapshot(points)
    print(f"{len(points)} historic stations saved to {HIST_OUT}; training snapshot: {archive}")
    return True


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


def download_current_historic_week(refresh=False, on_date=None):
    """Download only the current historic week, avoiding the full Europe-wide archive."""
    reference_date = on_date or date.today()
    year, week, _ = reference_date.isocalendar()
    name = f"{year}{week:02d}"
    path = HIST_DIR / f"{name}_ladesaeulen_woche.csv.gz"
    if path.exists() and not refresh:
        return path
    try:
        download(HIST_WEEK_URL.format(year=year, week=name), path, refresh=refresh)
    except urllib.error.HTTPError as error:
        print(f"Current historic week {name} unavailable: {error}")
        return None
    return path


def main(refresh=False, history=False):
    """Build map data; refresh only the configured changing public sources."""
    save_districts()
    save_states()
    save_chargers(refresh=refresh)
    save_population()
    save_ev_municipalities()
    save_parking(refresh=refresh)
    if history:
        download_current_historic_week(refresh=refresh)
    save_historic_stations()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Refresh changing public sources")
    parser.add_argument("--history", action="store_true", help="Fetch and process one historic week")
    args = parser.parse_args()
    main(refresh=args.refresh, history=args.history)
