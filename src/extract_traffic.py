"""Traffic volumes: turn the Verkehrsmonitoring tables of all BW counting sites into a map layer.

The tables have no coordinates, so site positions come from the SVZ station list on MobiData BW.
"""
from pathlib import Path
import re
import urllib.request
import zipfile

import geopandas as gpd
import pandas as pd

SVZ_URL = "https://mobidata-bw.de/vm/Karte_Strassenverkehrszaehlung_BW/SVZ-Zaehlstellen_2026-06-26_augmented_SVZ2024.csv"
RAW_DIR = Path("data/raw/verkehr")
SVZ_PATH = RAW_DIR / "svz_zaehlstellen.csv"
# Verkehrsmonitoring tables for all counting sites, added by hand (Zeilenformat CSV + legend PDF)
COUNTERS_ZIP = RAW_DIR / "Test_Ergebnisse_2024_Excel.zip"
COUNTERS_OUT = Path("data/processed/verkehr_svz_bw.geojson")
COUNTER_FILE = re.compile(r"BW_VM_(\d{4})_[ABKL]_Zeilenformat\.csv$")


def _clean(text):
    return " ".join(str(text).split())


def _read_counters(archive):
    """Read the A, B, K and L tables of the zip and return them as one table with their year."""
    tables = []
    for member in archive.namelist():
        match = COUNTER_FILE.search(member)
        if match:
            with archive.open(member) as file:
                table = pd.read_csv(file, sep=";", encoding="utf-8-sig", dtype=str)
            tables.append(table.assign(year=int(match[1])))
    if not tables:
        raise ValueError(f"no BW_VM_*_Zeilenformat.csv files found in {COUNTERS_ZIP}")
    return pd.concat(tables, ignore_index=True)


def _count(table, column):
    """Return a count column as numbers. A zero means the source has no value."""
    counts = pd.to_numeric(table[column].str.replace(",", "."), errors="coerce")
    return counts.where(counts > 0).round()


def save_traffic_counters():
    """Save all counting sites of the Verkehrsmonitoring with their yearly traffic."""
    if COUNTERS_OUT.exists():
        print(f"{COUNTERS_OUT} already exists, skipping")
        return
    if not COUNTERS_ZIP.exists():
        print(f"{COUNTERS_ZIP} not found, skipping traffic counters: this file has no download link yet")
        return
    if not SVZ_PATH.exists():
        urllib.request.urlretrieve(SVZ_URL, SVZ_PATH)

    with zipfile.ZipFile(COUNTERS_ZIP) as archive:
        table = _read_counters(archive)
    year = int(table["year"].iloc[0])

    # Some direction labels are only network node codes such as 8411015A
    directions = table[["RI", "RII"]].where(~table[["RI", "RII"]].apply(lambda col: col.str.fullmatch(r"\d{7}[A-Z]?", na=False)))
    counters = pd.DataFrame({
        "station_id": table["TKZST"], "road": table["Str"].map(_clean),
        "direction_1": directions["RI"], "direction_2": directions["RII"],
        "count_type": table["Zählart"], "location": table["FSOD"], "lanes": _count(table, "FStr"),
        "last_counted": table["Erhebungsjahr"], "method": table["Hr-Art"], "comment": table["HR-Kommentar"],
        "year": year,
        "dtv": _count(table, f"DTV{year}"), "dtv_two_years_before": _count(table, f"DTV{year - 2}"),
        "dtv_cars": _count(table, "DTVLVm"), "dtv_heavy": _count(table, "DTVSV"),
        "dtv_workday": _count(table, f"DTVw{year}"), "dtv_holiday_workday": _count(table, f"DTVu{year}"),
        "dtv_sunday": _count(table, f"DTVs{year}"),
    })

    # The tables have no coordinates; the SVZ station list uses the same station number
    svz = pd.read_csv(SVZ_PATH, dtype={"svznr": str}, usecols=["svznr", "gpsx1", "gpsy1"]).drop_duplicates("svznr")
    counters = counters.merge(svz, left_on="station_id", right_on="svznr", how="left")
    placed = counters.dropna(subset=["gpsx1", "gpsy1"])
    points = gpd.GeoDataFrame(
        placed.drop(columns=["svznr", "gpsx1", "gpsy1"]),
        geometry=gpd.points_from_xy(placed["gpsx1"], placed["gpsy1"]),
        crs="EPSG:4326",
    )
    points.to_file(COUNTERS_OUT, driver="GeoJSON")
    print(f"{len(points)} counting sites saved to {COUNTERS_OUT}, {len(counters) - len(points)} left out: no position")


if __name__ == "__main__":
    save_traffic_counters()
