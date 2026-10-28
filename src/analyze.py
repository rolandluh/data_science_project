"""ML-readiness checks for the EV charging demand model.

The project deliberately does not train a model from one status snapshot. A
weekly history is needed to create a defensible utilisation target and to keep
separate regions and weeks for validation.
"""
from __future__ import annotations

from pathlib import Path


HISTORY_DIR = Path("data/processed/history")
MINIMUM_WEEKLY_SNAPSHOTS = 4


def model_readiness(history_dir=HISTORY_DIR):
    """Describe whether sufficient weekly data exists to start ML work."""
    snapshots = sorted(Path(history_dir).glob("*-W*.geojson"))
    count = len(snapshots)
    if count < MINIMUM_WEEKLY_SNAPSHOTS:
        return {
            "status": "collecting_history",
            "weekly_snapshots": count,
            "minimum_weekly_snapshots": MINIMUM_WEEKLY_SNAPSHOTS,
            "message": (
                "ML training has not started. Collect more weekly charger-status snapshots "
                "before fitting and evaluating a utilisation model."
            ),
        }
    return {
        "status": "ready_for_feature_building",
        "weekly_snapshots": count,
        "minimum_weekly_snapshots": MINIMUM_WEEKLY_SNAPSHOTS,
        "message": (
            "Enough weekly snapshots are available to build features, train a baseline, "
            "and validate by held-out district and time period."
        ),
    }
