"""Central error log: every backend and frontend error is appended to logs/error.log with a timestamp.

Importing this module installs a hook that logs uncaught exceptions of any pipeline script.
Use log_error() for errors that are caught but should still be recorded.
The browser app reports its errors through src/serve.py (POST /log-error), which calls log_error().
"""
from datetime import datetime
from pathlib import Path
import sys
import threading
import traceback

LOG_PATH = Path(__file__).resolve().parent.parent / "logs" / "error.log"
_lock = threading.Lock()


def log_error(source, message):
    """Append one entry: ISO timestamp | source | message. Multi-line messages are indented under the first line."""
    stamp = datetime.now().astimezone().isoformat(timespec="seconds")
    lines = str(message).strip().splitlines() or [""]
    entry = f"{stamp} | {source} | {lines[0]}\n" + "".join(f"    {line}\n" for line in lines[1:])
    with _lock:
        LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as file:
            file.write(entry)


def _excepthook(exc_type, exc, tb):
    if not issubclass(exc_type, KeyboardInterrupt):
        script = Path(sys.argv[0]).name if sys.argv and sys.argv[0] else "python"
        log_error(f"backend:{script}", "".join(traceback.format_exception(exc_type, exc, tb)))
    sys.__excepthook__(exc_type, exc, tb)


sys.excepthook = _excepthook
