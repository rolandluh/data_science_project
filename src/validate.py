"""Validate the processed map files and write a small public update-status file."""
from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path


DATA_DIR = Path("data/processed")
STATUS_FILE = "update_status.json"
REQUIRED_FILES = {
    "ladesaeulen.json": "charger register",
    "bevoelkerung_1km.json": "population grid",
    "gemeinden_ev.geojson": "municipality EV data",
    "kreise_bw.geojson": "district boundaries",
    "laender.geojson": "state boundaries",
    "parkplaetze_bw.geojson": "parking locations",
    "historie_bw.geojson": "historic charger status",
    "stromnetz_bw.geojson": "grid proximity",
}


def _load_json(path: Path):
    with path.open(encoding="utf-8") as file:
        return json.load(file)


def _geojson_count(payload, name):
    if payload.get("type") != "FeatureCollection" or not isinstance(payload.get("features"), list):
        raise ValueError("expected a GeoJSON FeatureCollection")
    if not payload["features"]:
        raise ValueError("contains no features")
    for feature in payload["features"]:
        if feature.get("type") != "Feature" or not feature.get("geometry"):
            raise ValueError("contains a feature without geometry")
    return len(payload["features"])


def _charger_count(payload):
    columns = payload.get("columns")
    rows = payload.get("rows")
    required = {"Ladeeinrichtungs-ID", "Bundesland", "Breitengrad", "Längengrad"}
    if not isinstance(columns, list) or not isinstance(rows, list):
        raise ValueError("expected columns and rows arrays")
    if not required.issubset(columns):
        raise ValueError("is missing required charger columns")
    if not rows:
        raise ValueError("contains no charger rows")
    latitude = columns.index("Breitengrad")
    longitude = columns.index("Längengrad")
    invalid = 0
    for row in rows:
        try:
            lat, lon = float(row[latitude]), float(row[longitude])
            if not (47.0 <= lat <= 50.2 and 7.0 <= lon <= 10.8):
                invalid += 1
        except (IndexError, TypeError, ValueError):
            invalid += 1
    if invalid:
        raise ValueError(f"contains {invalid} invalid or out-of-area coordinates")
    return len(rows)


def _population_count(payload):
    if not isinstance(payload, list) or not payload:
        raise ValueError("expected a non-empty population row array")
    invalid = 0
    for row in payload:
        try:
            lat, lon, residents = map(float, row)
            if not (47.0 <= lat <= 50.2 and 7.0 <= lon <= 10.8 and residents > 0):
                invalid += 1
        except (TypeError, ValueError):
            invalid += 1
    if invalid:
        raise ValueError(f"contains {invalid} invalid population rows")
    return len(payload)


def validate_processed_data(data_dir=DATA_DIR):
    """Return a JSON-serialisable report without changing any data files."""
    data_dir = Path(data_dir)
    datasets = []
    for filename, label in REQUIRED_FILES.items():
        path = data_dir / filename
        item = {"file": filename, "label": label, "ok": False, "records": None}
        if not path.exists():
            item["error"] = "file is missing"
            datasets.append(item)
            continue
        try:
            payload = _load_json(path)
            if filename == "ladesaeulen.json":
                records = _charger_count(payload)
            elif filename == "bevoelkerung_1km.json":
                records = _population_count(payload)
            else:
                records = _geojson_count(payload, filename)
            item.update(ok=True, records=records, modified_at=datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat())
        except (OSError, ValueError, json.JSONDecodeError) as error:
            item["error"] = str(error)
        datasets.append(item)
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ok": all(item["ok"] for item in datasets),
        "datasets": datasets,
    }


def write_status(report, data_dir=DATA_DIR):
    """Atomically publish the validation report for the map and update logs."""
    path = Path(data_dir) / STATUS_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(".tmp")
    temporary.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(path)
    return path


if __name__ == "__main__":
    report = validate_processed_data()
    write_status(report)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    raise SystemExit(0 if report["ok"] else 1)
