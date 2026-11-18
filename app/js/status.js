// Loading, error and per-layer state shown in the UI
import { byId, escapeHtml } from "./util.js";

const cache = new Map(); // url -> Promise of parsed JSON
const pending = new Map(); // token -> label

function renderProgress() {
  const progress = byId("progress");
  const status = byId("status");
  const text = byId("status-text");
  const labels = [...pending.values()];
  progress.hidden = labels.length === 0;
  status.hidden = labels.length === 0;
  if (labels.length) {
    const extra = labels.length > 1 ? ` (+${labels.length - 1} more)` : "";
    text.textContent = `Loading ${labels[labels.length - 1]}${extra}…`;
  }
}

// Tracks any promise in the global loading indicator
export function track(label, promise) {
  const token = Symbol(label);
  pending.set(token, label);
  renderProgress();
  const done = () => {
    pending.delete(token);
    renderProgress();
  };
  promise.then(done, done);
  return promise;
}

// Fetches a JSON file once; later calls share the same promise. A failed load can be retried.
export function loadJSON(url, label = url) {
  if (!cache.has(url)) {
    const promise = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return response.json();
    });
    cache.set(url, promise);
    promise.catch(() => cache.delete(url));
    track(label, promise);
  }
  return cache.get(url);
}

// Marks the rows of a layer (developer switch and planner switch) as loading / error / ready
export function setLayerState(id, state) {
  document.querySelectorAll("[data-layer]").forEach((row) => {
    if (!row.dataset.layer.split(" ").includes(id)) return;
    if (state) row.dataset.state = state;
    else delete row.dataset.state;
  });
}

export function toast(message, kind = "error") {
  const container = byId("toasts");
  const item = document.createElement("div");
  item.className = `toast toast-${kind}`;
  item.setAttribute("role", kind === "error" ? "alert" : "status");
  item.innerHTML = `<span>${escapeHtml(message)}</span><button type="button" class="icon-btn" aria-label="Dismiss"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
  const remove = () => item.remove();
  item.querySelector("button").addEventListener("click", remove);
  container.append(item);
  setTimeout(remove, 8000);
}

// Standard error handling for a layer load
export function layerError(id, label, error) {
  console.error(`Could not load ${label}`, error);
  setLayerState(id, "error");
  toast(`Could not load ${label}. Check that the file exists in data/processed/.`);
}
