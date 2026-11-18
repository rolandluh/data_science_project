// Detail card for one 500 m grid cell: hover to preview, click (or tap) to pin.
// Joins the supply gap, EV index and income grids by cell centre, so the card shows every figure at once.
import { map } from "./map.js";
import { grids, gapBreaks, gapColors } from "./layers.js";
import { byId, popupHtml, classIndex, euro, num } from "./util.js";
import { loadJSON } from "./status.js";

const card = byId("cell-card");
const body = byId("cell-card-body");
const title = byId("cell-card-title");
const eyebrow = byId("cell-card-eyebrow");
const gridInputs = Object.values(grids).map((g) => byId(g.input));

const dLat = 0.00225; // half a 500 m cell (see gridLayer in layers.js)
const bucket = 0.01;
const bucketKey = (lat, lon) => `${Math.floor(lat / bucket)},${Math.floor(lon / bucket)}`;

let index = null; // Promise of Map bucket -> [cell]
let pinned = null; // the pinned cell, or null
let hovered = null;

// Outline of the inspected cell, drawn above the grid and below the points
map.createPane("cellHighlight");
map.getPane("cellHighlight").style.zIndex = 450;
map.getPane("cellHighlight").style.pointerEvents = "none";
const highlight = L.rectangle(
  [
    [0, 0],
    [0, 0],
  ],
  { pane: "cellHighlight", interactive: false, weight: 2.5, color: "#0ea5e9", fill: false }
);

function rowsToObjects({ columns, rows }) {
  return rows.map((row) => Object.fromEntries(columns.map((name, i) => [name, row[i]])));
}

function buildIndex() {
  index =
    index ||
    Promise.all(
      Object.entries(grids).map(([key, g]) =>
        loadJSON(g.url, g.label)
          .then((data) => [key, rowsToObjects(data)])
          .catch((error) => {
            console.error(`Detail card: could not load ${g.label}`, error);
            return [key, []];
          })
      )
    ).then((parts) => {
      const cells = new Map(); // "lat,lon" -> merged cell
      parts.forEach(([key, rows]) => {
        rows.forEach((row) => {
          const id = `${row.lat},${row.lon}`;
          if (!cells.has(id)) cells.set(id, { lat: row.lat, lon: row.lon, residents: row.Einwohner });
          cells.get(id)[key] = row;
        });
      });
      const buckets = new Map();
      cells.forEach((cell) => {
        const k = bucketKey(cell.lat, cell.lon);
        if (!buckets.has(k)) buckets.set(k, []);
        buckets.get(k).push(cell);
      });
      return buckets;
    });
  return index;
}

// The cell whose (approximate) square contains the point, if any
function cellAt(buckets, { lat, lng }) {
  const by = Math.floor(lat / bucket);
  const bx = Math.floor(lng / bucket);
  const dLon = dLat / Math.cos((lat * Math.PI) / 180);
  let best = null;
  let bestDistance = Infinity;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      (buckets.get(`${by + dy},${bx + dx}`) || []).forEach((cell) => {
        const ny = Math.abs(cell.lat - lat) / dLat;
        const nx = Math.abs(cell.lon - lng) / dLon;
        if (ny > 1 || nx > 1) return;
        const distance = Math.max(nx, ny);
        if (distance < bestDistance) {
          best = cell;
          bestDistance = distance;
        }
      });
    }
  }
  return best;
}

const active = () => gridInputs.some((input) => input.checked);
// On phones the card is a bottom sheet: only shown for a pinned (tapped) cell
const compact = () => matchMedia("(max-width: 640px)").matches;

function metric(label, value, hint = "") {
  return `<div class="metric"><dt>${label}</dt><dd>${value}${hint ? `<span class="metric-hint">${hint}</span>` : ""}</dd></div>`;
}

function render(cell) {
  const gap = cell.gap;
  const ev = cell.ev;
  const income = cell.income;
  const residents = cell.residents;

  eyebrow.textContent = pinned ? "500 m grid cell · pinned" : "500 m grid cell · hover";
  let html = "";

  if (gap) {
    const cls = classIndex(gap.ev_per_point, gapBreaks);
    title.textContent = `Supply gap ${num(gap.ev_per_point, 1)}`;
    const steps = gapColors
      .map((color, i) => `<span class="${i === cls ? "is-current" : ""}" style="background:${color}"></span>`)
      .join("");
    html +=
      '<div class="gap-hero">' +
      `<p class="gap-caption">Public EV demand per charging point within 1.5 km${gap.points ? "" : " (no point in reach, counted as one)"}</p>` +
      `<div class="gap-steps" role="img" aria-label="Class ${cls + 1} of ${gapColors.length}">${steps}</div>` +
      `<p class="gap-class">Class ${cls + 1} of ${gapColors.length} · higher = more under-served</p>` +
      "</div>";
  } else {
    title.textContent = "No supply-gap value";
  }

  html += '<dl class="metrics">';
  if (gap) {
    html += metric("Public EV demand", num(gap.demand, 1), "within 1.5 km");
    html += metric("Charging points", num(gap.points), `${num(gap.stations)} stations · 1.5 km`);
    html += metric("Charging power", `${num(gap.kw)} kW`, "within 1.5 km");
    html += metric("Home-charging share", gap.house_share == null ? "–" : `${Math.round(gap.house_share * 100)} %`, "dwellings in 1–2-family houses");
  }
  html += metric("Residents", num(residents), "in this cell");
  html += metric("EV share", ev && ev.ev_share != null ? `${num(ev.ev_share, 1)} %` : "–", "of cars, 5 km parent");
  html += metric("EV index", ev && ev.ev_index != null ? num(ev.ev_index, 1) : "–", "residents × share");
  html += metric(
    "Median wage",
    income && income.median_income != null ? euro(income.median_income) : "–",
    income ? { "1km": "1 km cell", "5km": "5 km cell", kreis: "district value" }[income.income_source] || "" : ""
  );
  html += "</dl>";

  const tables = Object.entries(grids)
    .filter(([key]) => cell[key])
    .map(([key, g]) => `<h3>${g.title}</h3>${popupHtml(g.popupRow(cell[key]))}`)
    .join("");
  html += `<details class="all-attrs"><summary>All attributes</summary>${tables}</details>`;
  html += `<p class="card-foot">${cell.lat.toFixed(4)}° N, ${cell.lon.toFixed(4)}° E · ${
    pinned ? "Esc or × to release" : "Click to pin"
  }</p>`;
  body.innerHTML = html;

  const dLon = dLat / Math.cos((cell.lat * Math.PI) / 180);
  highlight.setBounds([
    [cell.lat - dLat, cell.lon - dLon],
    [cell.lat + dLat, cell.lon + dLon],
  ]);
  highlight.addTo(map);
}

function showEmpty() {
  eyebrow.textContent = "500 m grid cell";
  title.textContent = "Inspect a cell";
  body.innerHTML =
    '<p class="empty">Hover over a coloured grid cell to preview its figures. Click or tap a cell to pin it.</p>';
  map.removeLayer(highlight);
}

function showLoading() {
  eyebrow.textContent = "500 m grid cell";
  title.textContent = "Loading grid data…";
  body.innerHTML = '<div class="skeleton"><span></span><span></span><span></span></div>';
}

export function closeCard() {
  pinned = null;
  hovered = null;
  map.removeLayer(highlight);
  if (active() && !compact()) showEmpty();
  else card.hidden = true;
}

function update() {
  card.hidden = !active() || (compact() && !pinned);
  if (!active()) {
    pinned = null;
    map.removeLayer(highlight);
    return;
  }
  if (pinned) render(pinned);
  else if (hovered) render(hovered);
  else showEmpty();
}

gridInputs.forEach((input) =>
  input.addEventListener("change", () => {
    if (input.checked) {
      card.hidden = compact() && !pinned;
      if (!pinned && !hovered) showLoading();
      buildIndex().then(update);
    } else {
      update();
    }
  })
);

// Hover preview (mouse only), throttled to one lookup per animation frame
let frame = null;
map.on("mousemove", (event) => {
  if (!active() || pinned || frame) return;
  frame = requestAnimationFrame(() => {
    frame = null;
    if (!index) return;
    index.then((buckets) => {
      if (pinned) return;
      const cell = cellAt(buckets, event.latlng);
      if (cell === hovered) return;
      hovered = cell;
      if (cell) render(cell);
      else showEmpty();
    });
  });
});

map.on("mouseout", () => {
  if (pinned || !active()) return;
  hovered = null;
  showEmpty();
});

map.on("click", (event) => {
  if (!active() || !index) return;
  index.then((buckets) => {
    const cell = cellAt(buckets, event.latlng);
    if (cell) {
      pinned = cell;
      card.hidden = false;
      render(cell);
      card.classList.add("is-pinned");
    } else if (pinned) {
      card.classList.remove("is-pinned");
      closeCard();
    }
  });
});

byId("cell-card-close").addEventListener("click", () => {
  card.classList.remove("is-pinned");
  closeCard();
  byId("map").focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pinned) {
    card.classList.remove("is-pinned");
    closeCard();
  }
});
