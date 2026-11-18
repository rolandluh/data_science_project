// Reports frontend errors to the server (POST /log-error -> logs/error.log).
// Needs `python src/serve.py`; with a plain static server the POST fails and is ignored.
// Loaded first so it sees everything. Capped per page load so an error loop cannot flood the log.
let sent = 0;
const MAX_REPORTS = 50;
const seen = new Set();

function report(message, stack = "") {
  const key = `${message}|${stack.slice(0, 200)}`;
  if (sent >= MAX_REPORTS || seen.has(key)) return;
  seen.add(key);
  sent++;
  try {
    fetch("/log-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, stack, url: location.href }),
      keepalive: true,
    }).catch(() => {});
  } catch (error) {
    /* logging must never throw */
  }
}

window.addEventListener("error", (event) => {
  if (event.error) report(event.error.message || String(event.message), event.error.stack || `${event.filename}:${event.lineno}`);
  else if (event.target && event.target !== window) report(`Resource failed to load: ${event.target.src || event.target.href}`); // scripts, styles
  else report(String(event.message), `${event.filename}:${event.lineno}`);
}, true);

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  report(`Unhandled rejection: ${reason && reason.message ? reason.message : String(reason)}`, (reason && reason.stack) || "");
});

// Handled errors (for example a layer that failed to load) go through console.error
const original = console.error.bind(console);
console.error = (...args) => {
  original(...args);
  const text = args.map((arg) => (arg instanceof Error ? arg.stack || arg.message : typeof arg === "string" ? arg : JSON.stringify(arg))).join(" ");
  report(text.split("\n")[0].slice(0, 500), text);
};
