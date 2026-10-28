"""Run data refresh and validation for the static EV charging map."""
from __future__ import annotations

import argparse
import json
import sys

from src import analyze
from src import validate


def run(refresh=False, history=False, grid=False):
    """Refresh requested sources, validate outputs, and publish update status."""
    if refresh:
        from src import extract

        extract.main(refresh=True, history=history)
    if grid:
        from src import extract_grid

        extract_grid.run(refresh=refresh)

    report = validate.validate_processed_data()
    report["ml"] = analyze.model_readiness()
    status_path = validate.write_status(report)
    report["status_file"] = str(status_path)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Refresh the configured live source files")
    parser.add_argument("--history", action="store_true", help="With --refresh, fetch one current history week")
    parser.add_argument("--grid", action="store_true", help="Refresh or rebuild grid proximity data")
    args = parser.parse_args()
    report = run(refresh=args.refresh, history=args.history, grid=args.grid)
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
