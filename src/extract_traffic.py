"""Traffic volumes: download the BW permanent counting station results and turn them into tidy outputs.

Source: MobiData BW, "Ergebnisse Ganglinien Dauerzählstellen" (Datenlizenz Deutschland Namensnennung 2.0).
The results have no coordinates, so station positions come from the SVZ station list of the same portal.

Only the monthly workbooks are read. Quarter, half-year and year workbooks repeat the same counts.
"""
from pathlib import Path
import json
import re
import urllib.error
import urllib.request
import zipfile

import geopandas as gpd
import openpyxl
import pandas as pd

YEARS = range(2022, 2027)
ZIP_URL = "https://mobidata-bw.de/vm/Ergebnisse_Ganglinien_Dauerzaehlstellen_BW/Ergebnisse_{year}_Excel.zip"
SVZ_URL = "https://mobidata-bw.de/vm/Karte_Strassenverkehrszaehlung_BW/SVZ-Zaehlstellen_2026-06-26_augmented_SVZ2024.csv"
RAW_DIR = Path("data/raw/verkehr")
SVZ_PATH = RAW_DIR / "svz_zaehlstellen.csv"
MONTHLY_OUT = Path("data/processed/verkehr_monatlich.json")
STATIONS_OUT = Path("data/processed/verkehr_zaehlstellen_bw.geojson")

SVZ_YEAR = 2024
SVZ_MAX_DTV_DIFFERENCE = 0.3
MONTHLY_FILE = re.compile(r"VZ_(\d{4})_(\d{2})\.xlsx$")
ROAD_CLASSES = ("A", "B", "L", "K", "G")
MEASURES = ["dtv_kfz", "dtv_kfz_mofr", "dtv_kfz_sofei", "dtv_sv", "dtv_sv_mofr"]

# Stations renumbered in the 2026 workbooks, old number -> current number.
# Checked by reproducing the published 26/25 change from the 2025 counts, except the last two
# (station outages leave too few months), which keep their road and name.
RENUMBERED = {
    "72141035": "73141035",  # A 5 Achern
    "68221091": "68221059",  # A 6 Schwabbach
    "75181028": "73231028",  # A 81 Horb
    "81181036": "81181063",  # A 81 Geisingen
    "69161100": "69171100",  # B 3 Karlsruhe 2
    "69211216": "70211222",  # L 1115 Grossbottwar, now listed as B 328
    "84111109": "83111109",  # B 532 Palmrainbrücke
    "75128235": "75121205",  # L 98 Goldscheuer Ost
    "75128236": "75121206",  # L 98 Goldscheuer West
    "75128535": "75121105",  # L 75 Goldscheuer Nord
    "75128536": "75121106",  # L 75 Goldscheuer Süd
    "77121205": "77121204",  # L 104 Rheinhausen
    "77128232": "77121410",  # K 5345 Mahlberg
    "74211103": "75211103",  # B 312 Reutlingen
    "77148704": "77151100",  # B 33 Gutach 2
}
# The 2026 workbooks list Karlsruhe 1 under the number of B 3 Emmendingen-Wasser
NUMBER_BY_ROAD_AND_NAME = {("A 5", "karlsruhe 1"): "70161022"}


def download_results():
    """Download and unzip each year. Delete a year's zip to fetch newer months, as for the running year."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    for year in YEARS:
        zip_path = RAW_DIR / f"Ergebnisse_{year}_Excel.zip"
        if not zip_path.exists():
            part_path = zip_path.with_suffix(".part")
            try:
                urllib.request.urlretrieve(ZIP_URL.format(year=year), part_path)
            except urllib.error.HTTPError as error:
                print(f"traffic results {year} skipped: {error}")
                continue
            part_path.rename(zip_path)
        with zipfile.ZipFile(zip_path) as archive:
            archive.extractall(RAW_DIR)
    if not SVZ_PATH.exists():
        urllib.request.urlretrieve(SVZ_URL, SVZ_PATH)


def _number(value):
    """Return a count as a float. Text notes such as "Ausfall" and zero counts both mean no data."""
    if isinstance(value, str):
        value = value.replace("*", "").strip()
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _valid_days(value):
    """Return the reported valid days (GT). Zero is kept: such months still report counts."""
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _note(value):
    """Return the operator's remark when a count cell holds text instead of a number."""
    if isinstance(value, str) and re.search(r"[A-Za-zÄÖÜäöü]", value):
        return value.strip()
    return None


def _percent(value):
    """Return a published change, stored as a number or as text such as '   1.5  %'."""
    if isinstance(value, (int, float)):
        return float(value)
    match = re.search(r"-?\d+(\.\d+)?", str(value))
    return float(match[0]) if match else None


def _clean(text):
    return " ".join(str(text).split())


def _station_number(road, name, raw_number):
    number = NUMBER_BY_ROAD_AND_NAME.get((road, name.casefold()))
    if number is None:
        number = re.sub(r"\D", "", str(raw_number))
    return RENUMBERED.get(number, number)


def _read_layout_2022_2025(workbook):
    """2022-2025: one sheet with cars and heavy vehicles side by side, repeated per road class."""
    rows = []
    for row in workbook["BW_DTV_GQ"].iter_rows(values_only=True):
        if row[0] not in ROAD_CLASSES or not row[4]:
            continue
        road = str(row[0]) if row[1] is None else f"{row[0]} {row[1]}"
        name = _clean(row[4])
        rows.append({
            "station_id": _station_number(road, name, row[3]), "road": road, "name": name,
            "lanes": _number(row[2]), "valid_days": _valid_days(row[5]),
            "dtv_kfz": _number(row[6]), "dtv_kfz_mofr": _number(row[8]), "dtv_kfz_sofei": _number(row[10]),
            "dtv_sv": _number(row[12]), "dtv_sv_mofr": _number(row[14]),
            "published_change_pct": _percent(row[7]), "note": _note(row[6]),
        })
    return rows


def _rows_2026(workbook, prefix):
    for sheet in workbook.sheetnames:
        if sheet.startswith(prefix):
            for row in workbook[sheet].iter_rows(values_only=True):
                if isinstance(row[0], int) and row[2]:
                    yield row


def _read_layout_2026(workbook):
    """2026: separate multi-page sheets for cars and heavy vehicles, joined on the first column."""
    heavy = {row[0]: row for row in _rows_2026(workbook, "DTV SV GQ")}
    rows = []
    for row in _rows_2026(workbook, "DTV Kfz GQ"):
        road, name = _clean(row[1]), _clean(row[2])
        lanes = [int(part) for part in re.findall(r"\d+", str(row[5]))]
        heavy_row = heavy.get(row[0])
        rows.append({
            "station_id": _station_number(road, name, row[3]), "road": road, "name": name,
            "lanes": float(sum(lanes)) if lanes else None, "valid_days": _valid_days(row[4]),
            "dtv_kfz": _number(row[6]), "dtv_kfz_mofr": _number(row[8]), "dtv_kfz_sofei": _number(row[10]),
            "dtv_sv": _number(heavy_row[6]) if heavy_row else None,
            "dtv_sv_mofr": _number(heavy_row[8]) if heavy_row else None,
            "published_change_pct": _percent(row[7]), "note": _note(row[6]),
        })
    return rows


def read_monthly_results():
    """Return one row per station and month for all downloaded years."""
    rows = []
    for path in sorted(RAW_DIR.glob("Ergebnisse_*_Excel/VZ_*.xlsx")):
        match = MONTHLY_FILE.search(path.name)
        if not match:
            continue
        workbook = openpyxl.load_workbook(path, data_only=True, read_only=True)
        reader = _read_layout_2022_2025 if "BW_DTV_GQ" in workbook.sheetnames else _read_layout_2026
        month_rows = reader(workbook)
        workbook.close()
        if not month_rows:
            raise ValueError(f"no stations found in {path}: the workbook layout may have changed")
        for row in month_rows:
            row["year"], row["month"] = int(match[1]), int(match[2])
        rows += month_rows
    monthly = pd.DataFrame(rows)
    # A few months list a station twice; keep the row that has a count
    monthly = monthly.sort_values("dtv_kfz", na_position="last")
    return monthly.drop_duplicates(["station_id", "year", "month"]).sort_values(["station_id", "year", "month"])


def _days_weighted_mean(group):
    """Mean daily traffic over the months with data, with each month weighted by its calendar days."""
    valid = group.dropna(subset=["dtv_kfz"])
    if valid.empty:
        return None
    days = pd.to_datetime(dict(year=valid["year"], month=valid["month"], day=1)).dt.days_in_month
    return round((valid["dtv_kfz"] * days).sum() / days.sum())


def summarize_stations(monthly):
    """Return one row per station: latest labels, position, and yearly traffic."""
    latest = monthly.sort_values(["year", "month"]).groupby("station_id").last()
    stations = latest[["road", "name", "lanes"]].copy()
    stations["road_class"] = stations["road"].str[0]

    for year, year_rows in monthly.groupby("year"):
        groups = year_rows.groupby("station_id")
        stations[f"dtv_kfz_{year}"] = groups.apply(_days_weighted_mean, include_groups=False)
        stations[f"months_{year}"] = groups["dtv_kfz"].count()
        stations[f"months_{year}"] = stations[f"months_{year}"].fillna(0).astype(int)

    # A running year misses its later months, so its mean is not comparable with a full year.
    # Compare it with the previous year over the months both have, per station.
    last_year = int(monthly["year"].max())
    published_months = monthly.loc[monthly["year"] == last_year, "month"].nunique()
    if published_months < 12:
        valid = monthly.dropna(subset=["dtv_kfz"])
        current = valid[valid["year"] == last_year]
        previous = valid[valid["year"] == last_year - 1]
        pairs = current.merge(previous, on=["station_id", "month"], suffixes=("", "_previous"))
        groups = pairs.groupby("station_id")
        stations[f"dtv_kfz_ytd_{last_year}"] = groups.apply(_days_weighted_mean, include_groups=False)
        stations[f"dtv_kfz_ytd_{last_year - 1}"] = groups.apply(
            lambda rows: _days_weighted_mean(rows.assign(dtv_kfz=rows["dtv_kfz_previous"])), include_groups=False,
        )
        print(f"  {last_year} is partial ({published_months} months): use dtv_kfz_ytd_* to compare years")

    return _add_positions(stations).reset_index()


def _position_check(station, match):
    """Return how a station list entry was confirmed, or None if it is a different station.

    Numbers alone are not safe: some point to another counting site in the list.
    """
    counted = station.get(f"dtv_kfz_{SVZ_YEAR}")
    listed = pd.to_numeric(match["DTV2024"], errors="coerce")
    if pd.notna(counted) and pd.notna(listed) and listed > 0:
        return "dtv" if abs(counted / listed - 1) <= SVZ_MAX_DTV_DIFFERENCE else None
    # A station without counts that year can only be compared by road
    road_number = re.sub(r"\D", "", station["road"])
    return "road" if (match["klasse"], match["nummer"]) == (station["road_class"], road_number) else None


def _add_positions(stations):
    """Add lon/lat from the SVZ station list, trying the number used in that list first."""
    svz = pd.read_csv(SVZ_PATH, dtype=str).drop_duplicates("svznr").set_index("svznr")
    previous_number = {new: old for old, new in RENUMBERED.items()}
    found = {}
    for station_id, station in stations.iterrows():
        for number in (previous_number.get(station_id), station_id):
            if number in svz.index:
                check = _position_check(station, svz.loc[number])
                if check:
                    match = svz.loc[number]
                    found[station_id] = {
                        "gpsx1": float(match["gpsx1"]), "gpsy1": float(match["gpsy1"]), "position_check": check,
                    }
                    break
    return stations.join(pd.DataFrame.from_dict(found, orient="index"))


def check_published_changes(monthly):
    """Print how closely the published year-on-year changes match our own station series."""
    valid = monthly.dropna(subset=["dtv_kfz", "published_change_pct"])
    previous = valid.assign(year=valid["year"] + 1)[["station_id", "year", "month", "dtv_kfz"]]
    pairs = valid.merge(previous, on=["station_id", "year", "month"], suffixes=("", "_previous"))
    error = ((pairs["dtv_kfz"] / pairs["dtv_kfz_previous"] - 1) * 100 - pairs["published_change_pct"]).abs()
    for year, year_error in error.groupby(pairs["year"]):
        print(f"  {year}: {(year_error < 0.5).mean():.0%} of {len(year_error)} changes within 0.5 points of the published value")


def save_traffic():
    if MONTHLY_OUT.exists() and STATIONS_OUT.exists():
        print(f"{MONTHLY_OUT} and {STATIONS_OUT} already exist, skipping")
        return
    download_results()
    monthly = read_monthly_results()
    check_published_changes(monthly)

    columns = ["station_id", "year", "month", *MEASURES, "valid_days", "published_change_pct", "note"]
    rows = monthly[columns].astype(object).where(monthly[columns].notna(), None).values.tolist()
    with open(MONTHLY_OUT, "w", encoding="utf-8") as file:
        json.dump({"columns": columns, "rows": rows}, file, ensure_ascii=False)
    print(f"{len(rows)} station months saved to {MONTHLY_OUT}")

    stations = summarize_stations(monthly)
    points = gpd.GeoDataFrame(
        stations.drop(columns=["gpsx1", "gpsy1"]),
        geometry=gpd.points_from_xy(stations["gpsx1"], stations["gpsy1"]),
        crs="EPSG:4326",
    )
    points.to_file(STATIONS_OUT, driver="GeoJSON")
    print(f"{len(points)} counting stations saved to {STATIONS_OUT}, {stations['gpsx1'].isna().sum()} without a position")


if __name__ == "__main__":
    save_traffic()
