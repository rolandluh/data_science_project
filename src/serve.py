"""Static file server for the map (replaces `python -m http.server`) that also records frontend errors.

Usage: python src/serve.py [port]    ->  http://localhost:8000/app/
The browser posts errors to /log-error; they are appended to logs/error.log.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import json
import sys

from error_log import log_error

ROOT = Path(__file__).resolve().parent.parent
MAX_BODY = 20_000


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        if self.path != "/log-error":
            self.send_error(404)
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), MAX_BODY)
            report = json.loads(self.rfile.read(length) or b"{}")
            where = f" @ {report['url']}" if report.get("url") else ""
            log_error("frontend", f"{str(report.get('message', ''))[:2000]}{where}\n{str(report.get('stack', ''))[:4000]}")
        except Exception as error:  # a broken report must never break the server
            log_error("backend:serve.py", f"Could not read frontend error report: {error!r}")
            self.send_error(400)
            return
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    print(f"Serving {ROOT} at http://localhost:{port}/app/  (errors -> {Path('logs/error.log')})")
    ThreadingHTTPServer(("", port), Handler).serve_forever()
