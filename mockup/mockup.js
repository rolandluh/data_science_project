// Concept mock-up of the EV charging site recommender.
// Reads the browser-sized files written by src/mockup_data.py (schema: mockup/README.md), runs the v1 optimizer
// (decision record §9) live on every input change, and explains every input and output with info points (explain.json).
import "../app/js/errorlog.js";
import { byId, escapeHtml, num, classIndex, storage } from "../app/js/util.js";
import { loadJSON, toast } from "../app/js/status.js";

const DATA = "../data/processed/mockup/";
const LOAD_ID = Date.now();
const FILES = ["candidates", "cells", "stations", "overused", "sizing", "scenarios", "defaults"];
const TYPES = ["AC", "DC"];
const COST_ROWS = [
  ["per_point", "Hardware + install per point"],
  ["grid_per_site", "Grid connection per site"],
  ["civil_per_site", "Civil works per site"],
  ["subsidy_per_site", "Subsidy per site (deducted)"],
  ["om_per_point_year", "O&M per point per year"],
];
const VALUE_ROWS = [
  ["delivered_kw", "Delivered kW while occupied", 1],
  ["price_eur_kwh", "Price €/kWh", 0.01],
  ["energy_cost_eur_kwh", "Energy cost €/kWh", 0.01],
];
const USAGE_BREAKS = [1.5, 2, 3, 4, 5, 7]; // hours per point per day
const USAGE_COLORS = ["#fff7ec", "#fee8c8", "#fdd49e", "#fdbb84", "#fc8d59", "#e34a33", "#b30000"];
const MAX_CANDIDATE_DOTS = 15000;
const RANKED_LIMIT = 200; // picks beyond this rank get a plain dot on the map and no list row (keeps big budgets fast)
const RUN_DELAY_MS = 120;

const clone = (value) => JSON.parse(JSON.stringify(value));
const hours = (occupancy) => occupancy * 24;
const euro = (value) => `${value < 0 ? "−" : ""}€${num(Math.abs(Math.round(value)))}`;

// ---------------------------------------------------------------------------
// Theme, drawers
// ---------------------------------------------------------------------------
const root = document.documentElement;
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && systemDark.matches);

function themeChanged() {
  const dark = isDark();
  const button = byId("theme-toggle");
  button.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  button.setAttribute("aria-pressed", String(dark));
  if (map) {
    map.getContainer().classList.toggle("tiles-muted", !dark);
    map.getContainer().classList.toggle("tiles-dark", dark);
    if (mask) mask.setStyle({ fillColor: dark ? "#000000" : "#64748b", fillOpacity: dark ? 0.5 : 0.35 });
    styleKreise();
  }
}
byId("theme-toggle").addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  storage.set("theme", root.dataset.theme);
  themeChanged();
});
systemDark.addEventListener("change", () => {
  if (!root.dataset.theme) themeChanged();
});

function drawer(bodyClass, toggleId, closeId) {
  const button = byId(toggleId);
  const set = (open) => {
    document.body.classList.toggle(bodyClass, open);
    button.setAttribute("aria-expanded", String(open));
    byId("scrim").hidden = !(document.body.classList.contains("sidebar-open") || document.body.classList.contains("results-open"));
  };
  button.addEventListener("click", () => set(!document.body.classList.contains(bodyClass)));
  byId(closeId).addEventListener("click", () => set(false));
  byId("scrim").addEventListener("click", () => set(false));
  return set;
}
const setSidebar = drawer("sidebar-open", "sidebar-toggle", "sidebar-close");
const setResults = drawer("results-open", "results-toggle", "results-close");

// ---------------------------------------------------------------------------
// Info points (texts in explain.json)
// ---------------------------------------------------------------------------
let explain = {};
const popover = byId("popover");
let popoverOwner = null;

function closePopover() {
  popover.hidden = true;
  if (popoverOwner) popoverOwner.setAttribute("aria-expanded", "false");
  popoverOwner = null;
}

function openPopover(button) {
  const key = button.dataset.info;
  const entry = explain[key];
  if (!entry) {
    toast(`No info text for "${key}" in explain.json`);
    return;
  }
  if (popoverOwner) popoverOwner.setAttribute("aria-expanded", "false");
  popoverOwner = button;
  button.setAttribute("aria-expanded", "true");
  byId("popover-title").textContent = entry.title;
  const body = entry.items
    ? `<ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(entry.text)}</p>`;
  byId("popover-body").innerHTML = body;
  byId("popover-ref").textContent = entry.ref ? `Reference: ${entry.ref}` : "";
  popover.hidden = false;
  const rect = button.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  let left = Math.min(Math.max(8, rect.left - 12), window.innerWidth - width - 8);
  let top = rect.bottom + 8;
  if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - 8);
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-info]");
  if (button) {
    event.preventDefault();
    event.stopPropagation();
    if (popoverOwner === button && !popover.hidden) closePopover();
    else openPopover(button);
    return;
  }
  if (!popover.hidden && !popover.contains(event.target)) closePopover();
}, true);
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!popover.hidden) {
    const owner = popoverOwner;
    closePopover();
    if (owner) owner.focus();
  } else {
    setSidebar(false);
    setResults(false);
  }
});
byId("popover-close").addEventListener("click", closePopover);

// ---------------------------------------------------------------------------
// Map
// ---------------------------------------------------------------------------
const badenWuerttemberg = L.latLngBounds([47.5, 7.5], [49.8, 10.5]);
const map = L.map("map", { preferCanvas: true, zoomControl: false, minZoom: 6 });
map.fitBounds(badenWuerttemberg);
L.control.zoom({ position: "bottomright" }).addTo(map);
L.control.scale({ position: "bottomright", imperial: false }).addTo(map);
L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
map.createPane("mask");
map.getPane("mask").style.zIndex = 250;
map.getPane("mask").style.pointerEvents = "none";
map.createPane("usage");
map.getPane("usage").style.zIndex = 300;
map.getPane("usage").style.pointerEvents = "none";
map.createPane("picks");
map.getPane("picks").style.zIndex = 650;
let mask = null;
let kreiseLayer = null;
themeChanged();

const areaLayer = L.layerGroup().addTo(map);
const picksLayer = L.layerGroup().addTo(map);
const candidatesLayer = L.layerGroup();
const overusedLayer = L.layerGroup();
const stationsLayer = L.layerGroup();
const markers = new Map(); // candidate id -> pick marker

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
let D = null; // all loaded files
let C = null; // candidates as typed arrays
let kreisFeatures = []; // index-aligned with D.candidates.kreise

function fatal(message) {
  byId("fatal-text").innerHTML = message;
  byId("fatal").hidden = false;
}

async function loadAll() {
  explain = await loadJSON("explain.json", "info texts").catch((error) => {
    console.error("Could not load explain.json", error);
    toast("Info texts (mockup/explain.json) could not be loaded; info points stay empty.");
    return {};
  });
  // Query string per page load: regenerated files are never hidden by the browser cache
  const results = await Promise.allSettled(FILES.map((name) => loadJSON(`${DATA}${name}.json?load=${LOAD_ID}`, `${name}.json`)));
  const missing = FILES.filter((name, i) => results[i].status === "rejected");
  if (missing.length) {
    results.forEach((result) => result.status === "rejected" && console.error("Mock-up data", result.reason));
    fatal(`Could not load ${missing.map((name) => `<code>data/processed/mockup/${name}.json</code>`).join(", ")}. ` +
      "Generate the mock-up data first:");
    return false;
  }
  D = Object.fromEntries(FILES.map((name, i) => [name, results[i].value]));
  return true;
}

function prepareCandidates() {
  const { columns, rows } = D.candidates;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  const n = rows.length;
  const arrays = {
    n,
    col,
    rows,
    lat: new Float64Array(n),
    lon: new Float64Array(n),
    occ: new Float32Array(n),
    kreis: new Uint8Array(n),
    type: new Uint8Array(n), // 0 AC, 1 DC
    low: new Uint8Array(n),
    score: new Float32Array(n), // scratch: scenario occupancy at 2 points
  };
  rows.forEach((row, i) => {
    arrays.lat[i] = row[col.lat];
    arrays.lon[i] = row[col.lon];
    arrays.occ[i] = row[col.occ];
    arrays.kreis[i] = row[col.kreis];
    arrays.type[i] = row[col.type] === "DC" ? 1 : 0;
    arrays.low[i] = row[col.low_conf];
  });
  return arrays;
}

// ---------------------------------------------------------------------------
// State and inputs
// ---------------------------------------------------------------------------
const state = {
  areaMode: "radius",
  center: [48.7758, 9.1829],
  radiusKm: 15,
  kreise: new Set(),
  charger: "both",
  budgetMode: "simple",
  budget: { AC: 0, DC: 0 },
  cost: null,
  value: null,
  year: "today",
  maxPts: { AC: 8, DC: 12 },
  spacing: { AC: 500, DC: 3000 },
  hideLow: false,
  overrides: new Map(), // candidate id -> points
  tab: "AC",
  active: null, // selected pick id
};

const activeTypes = () => (state.charger === "both" ? TYPES : [state.charger.toUpperCase()]);
const costFor = (type) => (state.budgetMode === "detailed" ? state.cost[type] : D.defaults.cost[type]);
const radioValue = (name) => document.querySelector(`input[name="${name}"]:checked`).value;
const numberOf = (input, fallback) => {
  const value = Number(input.value);
  return input.value === "" || !Number.isFinite(value) ? fallback : value;
};

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, RUN_DELAY_MS);
}

function buildCostTables() {
  const costBody = byId("cost-body");
  costBody.innerHTML = COST_ROWS.map(([key, label]) =>
    `<tr><th scope="row">${label}</th>${TYPES.map((t) =>
      `<td data-type="${t}"><input type="number" min="0" step="500" data-cost="${t}.${key}" aria-label="${t} ${label}"></td>`).join("")}</tr>`).join("");
  const valueBody = byId("value-body");
  valueBody.innerHTML = VALUE_ROWS.map(([key, label, step]) =>
    `<tr><th scope="row">${label}</th>${TYPES.map((t) =>
      `<td data-type="${t}"><input type="number" min="0" step="${step}" data-value="${t}.${key}" aria-label="${t} ${label}"></td>`).join("")}</tr>`).join("");
  fillCostInputs();
  document.querySelectorAll("[data-cost], [data-value]").forEach((input) => input.addEventListener("input", readInputs));
}

function fillCostInputs() {
  document.querySelectorAll("[data-cost]").forEach((input) => {
    const [t, key] = input.dataset.cost.split(".");
    input.value = state.cost[t][key];
  });
  document.querySelectorAll("[data-value]").forEach((input) => {
    const [t, key] = input.dataset.value.split(".");
    input.value = state.value[t][key];
  });
  byId("value-lifetime").value = state.value.lifetime_years;
  byId("value-rate").value = +(state.value.discount_rate * 100).toFixed(2);
}

function buildKreisList() {
  const list = byId("kreis-list");
  list.innerHTML = D.candidates.kreise.map((k, i) =>
    `<li data-name="${escapeHtml(k.name.toLowerCase())}"><label><input type="checkbox" value="${i}"> ${escapeHtml(k.name)}<span class="kreis-type">${escapeHtml(k.type)}</span></label></li>`).join("");
  list.addEventListener("change", (event) => {
    const i = Number(event.target.value);
    if (event.target.checked) state.kreise.add(i);
    else state.kreise.delete(i);
    kreiseChanged();
    fitArea();
  });
  byId("kreis-filter").addEventListener("input", (event) => {
    const query = event.target.value.trim().toLowerCase();
    list.querySelectorAll("li").forEach((li) => {
      li.hidden = query !== "" && !li.dataset.name.includes(query);
    });
  });
  byId("kreis-chips").addEventListener("click", (event) => {
    const chip = event.target.closest(".chip");
    if (!chip) return;
    state.kreise.delete(Number(chip.dataset.kreis));
    kreiseChanged();
  });
}

function kreiseChanged() {
  byId("kreis-list").querySelectorAll("input").forEach((input) => {
    input.checked = state.kreise.has(Number(input.value));
  });
  byId("kreis-chips").innerHTML = state.kreise.size
    ? [...state.kreise].map((i) =>
      `<button type="button" class="chip" data-kreis="${i}" aria-label="Remove ${escapeHtml(D.candidates.kreise[i].name)}">${escapeHtml(D.candidates.kreise[i].name)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`).join("")
    : '<span class="hint">No Kreis selected yet: tick one below or click the map.</span>';
  schedule();
}

function readInputs() {
  state.areaMode = radioValue("area-mode");
  state.radiusKm = Math.max(0.5, numberOf(byId("radius"), 15));
  state.charger = radioValue("charger");
  state.budgetMode = radioValue("budget-mode");
  state.year = radioValue("year");
  state.hideLow = byId("hide-low").checked;
  TYPES.forEach((t) => {
    state.budget[t] = Math.max(0, numberOf(byId(`budget-${t}`), 0));
    state.maxPts[t] = Math.max(1, Math.round(numberOf(byId(`maxpts-${t}`), D.defaults.max_points[t])));
    state.spacing[t] = Math.max(0, numberOf(byId(`spacing-${t}`), D.defaults.spacing_m[t]));
  });
  document.querySelectorAll("[data-cost]").forEach((input) => {
    const [t, key] = input.dataset.cost.split(".");
    state.cost[t][key] = Math.max(0, numberOf(input, D.defaults.cost[t][key]));
  });
  document.querySelectorAll("[data-value]").forEach((input) => {
    const [t, key] = input.dataset.value.split(".");
    state.value[t][key] = Math.max(0, numberOf(input, D.defaults.value[t][key]));
  });
  state.value.lifetime_years = Math.max(1, numberOf(byId("value-lifetime"), D.defaults.value.lifetime_years));
  state.value.discount_rate = Math.max(0, numberOf(byId("value-rate"), D.defaults.value.discount_rate * 100) / 100);

  byId("area-radius").hidden = state.areaMode !== "radius";
  byId("area-kreis").hidden = state.areaMode !== "kreis";
  byId("cost-detail").hidden = state.budgetMode !== "detailed";
  document.querySelectorAll("[data-type]").forEach((el) => el.classList.toggle("is-off", !activeTypes().includes(el.dataset.type)));
  if (!activeTypes().includes(state.tab)) setTab(activeTypes()[0]);
  schedule();
}

function setTab(type) {
  state.tab = type;
  const input = document.querySelector(`input[name="picks-tab"][value="${type}"]`);
  if (input) input.checked = true;
}

function initInputs() {
  const d = D.defaults;
  state.cost = clone(d.cost);
  state.value = clone(d.value);
  if (d.area) {
    state.center = d.area.center;
    state.radiusKm = d.area.radius_km;
    byId("radius").value = d.area.radius_km;
  }
  TYPES.forEach((t) => {
    byId(`budget-${t}`).value = d.budget_eur[t];
    byId(`maxpts-${t}`).value = d.max_points[t];
    byId(`spacing-${t}`).value = d.spacing_m[t];
  });
  buildCostTables();
  buildKreisList();
  kreiseChanged();

  document.querySelectorAll(".inputs input:not([data-cost]):not([data-value]):not(#kreis-filter):not([type=checkbox][value])")
    .forEach((input) => input.addEventListener(input.type === "radio" || input.type === "checkbox" ? "change" : "input", readInputs));
  document.querySelectorAll('input[name="area-mode"]').forEach((input) => input.addEventListener("change", fitArea));
  document.querySelectorAll('input[name="picks-tab"]').forEach((input) => input.addEventListener("change", () => {
    state.tab = radioValue("picks-tab");
    renderResults();
  }));
  byId("cost-reset").addEventListener("click", () => {
    state.cost = clone(d.cost);
    fillCostInputs();
    readInputs();
  });
  byId("override-reset").addEventListener("click", () => {
    state.overrides.clear();
    schedule();
  });
  ["layer-candidates", "layer-usage", "layer-overused", "layer-stations"].forEach((id) => byId(id).addEventListener("change", applyLayers));
}

// ---------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------
const M_PER_DEG_LAT = 110540;
const mPerDegLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

function distanceM(lat1, lon1, lat2, lon2) {
  const dy = (lat1 - lat2) * M_PER_DEG_LAT;
  const dx = (lon1 - lon2) * mPerDegLon((lat1 + lat2) / 2);
  return Math.hypot(dx, dy);
}

function areaFilter() {
  if (state.areaMode === "radius") {
    const [clat, clon] = state.center;
    const r = state.radiusKm * 1000;
    const dLat = r / M_PER_DEG_LAT;
    const dLon = r / mPerDegLon(clat);
    return (i) => Math.abs(C.lat[i] - clat) <= dLat && Math.abs(C.lon[i] - clon) <= dLon && distanceM(C.lat[i], C.lon[i], clat, clon) <= r;
  }
  return (i) => state.kreise.has(C.kreis[i]);
}

function pointInRing(lat, lon, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function kreisAt(lat, lon) {
  return kreisFeatures.findIndex((feature) => {
    if (!feature) return false;
    const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    return polygons.some((rings) => rings.reduce((inside, ring) => (pointInRing(lat, lon, ring) ? !inside : inside), false));
  });
}

function drawArea() {
  areaLayer.clearLayers();
  if (state.areaMode === "radius") {
    L.circle(state.center, { radius: state.radiusKm * 1000, color: "#2563eb", weight: 2, dashArray: "6 6", fillOpacity: 0.04, interactive: false }).addTo(areaLayer);
    L.circleMarker(state.center, { radius: 5, color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1, interactive: false }).addTo(areaLayer);
    byId("center-label").textContent = `Centre ${state.center[0].toFixed(3)}, ${state.center[1].toFixed(3)}.`;
  }
  styleKreise();
}

function styleKreise() {
  if (!kreiseLayer) return;
  const dark = isDark();
  kreiseLayer.eachLayer((layer) => {
    const selected = state.areaMode === "kreis" && state.kreise.has(layer.feature.properties.index);
    layer.setStyle({
      color: selected ? "#2563eb" : dark ? "#94a3b8" : "#475569",
      weight: selected ? 2.5 : state.areaMode === "kreis" ? 1 : 0.6,
      opacity: state.areaMode === "kreis" || selected ? 0.9 : 0.4,
      fillColor: "#2563eb",
      fillOpacity: selected ? 0.08 : 0,
    });
  });
}

function fitArea() {
  if (state.areaMode === "radius") {
    map.fitBounds(L.latLng(state.center).toBounds(state.radiusKm * 2000), { padding: [30, 30] });
  } else if (state.kreise.size && kreiseLayer) {
    const bounds = L.latLngBounds([]);
    kreiseLayer.eachLayer((layer) => state.kreise.has(layer.feature.properties.index) && bounds.extend(layer.getBounds()));
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [30, 30] });
  }
}

map.on("click", (event) => {
  if (!D) return;
  const { lat, lng } = event.latlng;
  if (state.areaMode === "radius") {
    state.center = [lat, lng];
    schedule();
  } else {
    const i = kreisAt(lat, lng);
    if (i < 0) return;
    if (state.kreise.has(i)) state.kreise.delete(i);
    else state.kreise.add(i);
    kreiseChanged();
  }
});

// ---------------------------------------------------------------------------
// Sizing (§5) and optimizer (§9)
// ---------------------------------------------------------------------------
function yearFactors() {
  const factors = new Float32Array(D.candidates.kreise.length).fill(1);
  if (state.year === "today") return factors;
  D.candidates.kreise.forEach((k, i) => {
    const entry = D.scenarios.factors[k.ags];
    factors[i] = entry ? entry[state.year] : 1;
  });
  return factors;
}

function lookupFullShare(type, points, occupancy) {
  const S = D.sizing;
  const pc = classIndex(points, S.point_class_edges);
  const bin = Math.min(classIndex(occupancy, S.occ_bin_edges.slice(1, -1)), S.occ_bin_edges.length - 2);
  return S.full_share[type][pc][bin];
}

// Smallest point count (2, 4, 6, ...) whose expected share of full days is at or below the class target; capped
function sizeFor(type, occ2) {
  const S = D.sizing;
  const ref = S.reference_points;
  const max = state.maxPts[type];
  const steps = [];
  for (let n = 2; n <= max; n += 2) steps.push(n);
  if (!steps.length || steps[steps.length - 1] !== max) steps.push(max);
  for (const n of steps) {
    const share = lookupFullShare(type, n, (occ2 * ref) / n);
    if (share <= S.targets[type]) return { n, share, capped: false };
  }
  return { n: max, share: lookupFullShare(type, max, (occ2 * ref) / max), capped: true };
}

function siteCost(type, points) {
  const c = costFor(type);
  return Math.max(0, c.grid_per_site + c.civil_per_site - c.subsidy_per_site + c.per_point * points);
}

function returnsFor(type, pointHours, points, cost) {
  const v = state.value[type];
  const om = costFor(type).om_per_point_year;
  const energy = pointHours * v.delivered_kw * 365;
  const margin = energy * (v.price_eur_kwh - v.energy_cost_eur_kwh) - om * points;
  const r = state.value.discount_rate;
  const L_ = state.value.lifetime_years;
  const annuity = r > 0 ? (1 - Math.pow(1 + r, -L_)) / r : L_;
  return { energy, margin, npv: -cost + margin * annuity, payback: margin > 0 ? cost / margin : null };
}

function optimize(type, inArea, factors) {
  const t = type === "AC" ? 0 : 1;
  const budget = activeTypes().includes(type) ? state.budget[type] : 0;
  const cap = D.scenarios.occ_cap[type];
  const ref = D.sizing.reference_points;
  const result = { type, budget, used: 0, picks: [], inArea: 0, skippedSpacing: 0 };
  if (!activeTypes().includes(type)) return result;

  // 1. candidates of this type in the area, scored by (scenario) point-hours
  const order = [];
  for (let i = 0; i < C.n; i++) {
    if (C.type[i] !== t || (state.hideLow && C.low[i]) || !inArea(i)) continue;
    C.score[i] = Math.min(C.occ[i] * factors[C.kreis[i]], cap);
    order.push(i);
  }
  result.inArea = order.length;
  if (budget <= 0) return result;
  // 2. rank by predicted point-hours (occupancy x 2 points x 24 h; same order as occupancy)
  order.sort((a, b) => C.score[b] - C.score[a]);

  // 3. greedy: skip within spacing of an earlier pick of this type, add site cost until the budget is used
  const spacing = state.spacing[type];
  const cellM = Math.max(spacing, 1);
  const lonScale = mPerDegLon(48.6);
  const grid = new Map();
  const key = (gx, gy) => `${gx},${gy}`;
  const minOverride = Math.min(2, ...state.overrides.values());
  const cheapest = siteCost(type, minOverride);
  let remaining = budget;
  for (const i of order) {
    if (remaining < cheapest) break;
    const gx = Math.floor((C.lon[i] * lonScale) / cellM);
    const gy = Math.floor((C.lat[i] * M_PER_DEG_LAT) / cellM);
    let tooClose = false;
    if (spacing > 0) {
      for (let dx = -1; dx <= 1 && !tooClose; dx++) {
        for (let dy = -1; dy <= 1 && !tooClose; dy++) {
          const bucket = grid.get(key(gx + dx, gy + dy));
          if (bucket) tooClose = bucket.some((j) => distanceM(C.lat[i], C.lon[i], C.lat[j], C.lon[j]) < spacing);
        }
      }
    }
    if (tooClose) {
      result.skippedSpacing++;
      continue;
    }
    const id = C.rows[i][C.col.id];
    const sized = sizeFor(type, C.score[i]);
    const override = state.overrides.get(id);
    const points = override || sized.n;
    const cost = siteCost(type, points);
    if (cost > remaining) continue;
    remaining -= cost;
    const pointHours = C.score[i] * ref * 24;
    result.picks.push({
      i,
      id,
      type,
      occ2: C.score[i],
      factor: factors[C.kreis[i]],
      capped: C.occ[i] * factors[C.kreis[i]] > cap,
      pointHours,
      hoursPerPoint: pointHours / points,
      points,
      sized,
      override: Boolean(override),
      cost,
      low: Boolean(C.low[i]),
      ...returnsFor(type, pointHours, points, cost),
    });
    if (!grid.has(key(gx, gy))) grid.set(key(gx, gy), []);
    grid.get(key(gx, gy)).push(i);
  }
  result.used = budget - remaining;
  return result;
}

// ---------------------------------------------------------------------------
// Run and render
// ---------------------------------------------------------------------------
let results = { AC: null, DC: null };
let lastAreaKey = "";

function run() {
  if (!D) return;
  const start = performance.now();
  const inArea = areaFilter();
  const factors = yearFactors();
  results = { AC: optimize("AC", inArea, factors), DC: optimize("DC", inArea, factors) };
  const elapsed = performance.now() - start;
  drawArea();
  renderPicks();
  renderResults();
  renderYearNote(factors);
  const areaKey = `${state.areaMode}|${state.center}|${state.radiusKm}|${[...state.kreise]}|${state.charger}|${state.hideLow}`;
  if (areaKey !== lastAreaKey) {
    lastAreaKey = areaKey;
    if (byId("layer-candidates").checked) drawCandidates();
  }
  byId("override-count").textContent = state.overrides.size ? `${state.overrides.size} active.` : "";
  byId("override-reset").disabled = state.overrides.size === 0;
  byId("timing").textContent = `Optimizer ran in ${num(elapsed, 0)} ms over ${num(results.AC.inArea + results.DC.inArea)} candidates in the area.`;
}

function kreisName(i) {
  return D.candidates.kreise[C.kreis[i]].name;
}

function placeLabel(pick) {
  const row = C.rows[pick.i];
  const parking = row[C.col.parking] ? row[C.col.parking].replace(/[_-]/g, " ") : "parking";
  return `${kreisName(pick.i)} · ${parking}`;
}

function reasonText(pick) {
  const reason = C.rows[pick.i][C.col.dc_reason];
  return pick.type === "DC" ? `DC: ${reason}` : "AC: no motorway, primary road or supermarket nearby";
}

function pickDetailHtml(pick) {
  const row = C.rows[pick.i];
  const yearNote = state.year === "today" ? "" :
    `<dt>Kreis factor ${state.year}</dt><dd>×${num(pick.factor, 2)} <span class="tag-synthetic">synthetic</span>${pick.capped ? " · capped" : ""}</dd>`;
  return `<dl>
    <dt>Site demand</dt><dd>${num(pick.pointHours, 1)} point-hours / day <span class="tag-synthetic">synthetic</span></dd>
    <dt>Sizing <button class="info" type="button" data-info="points">i</button></dt><dd>${pick.override ? `override (rule: ${pick.sized.n})` : `${pick.sized.n} points`} · full on ~${num(lookupFullShare(pick.type, pick.points, (pick.occ2 * 2) / pick.points) * 100, 0)} % of days${pick.sized.capped && !pick.override ? " · at cap" : ""}</dd>
    ${yearNote}
    <dt>Energy <button class="info" type="button" data-info="energy">i</button></dt><dd>${num(pick.energy / 1000, 0)} MWh / year <span class="tag-assumed">estimate</span></dd>
    <dt>Returns <button class="info" type="button" data-info="returns">i</button></dt><dd>${euro(pick.margin)} / year · NPV ${euro(pick.npv)}${pick.payback ? ` · payback ${num(pick.payback, 1)} y` : ""} <span class="tag-assumed">estimate</span></dd>
    <dt>Type <button class="info" type="button" data-info="dc_reason">i</button></dt><dd>${escapeHtml(reasonText(pick))}</dd>
    <dt>Nearby</dt><dd>${num(row[C.col.residents_1km])} residents within 1 km · ${num(row[C.col.destinations_500m])} destinations within 500 m</dd>
    <dt>Feed station</dt><dd>${num(row[C.col.feed_m] / 1000, 1)} km to the nearest</dd>
  </dl>
  <div class="pick-flags">${pick.low ? '<span class="tag-low">Low confidence</span> <button class="info" type="button" data-info="confidence">i</button>' : ""}</div>`;
}

function renderPicks() {
  picksLayer.clearLayers();
  markers.clear();
  TYPES.forEach((type) => {
    const res = results[type];
    if (!res) return;
    res.picks.forEach((pick, rank) => {
      const cls = `pick-icon ${type.toLowerCase()}${pick.low ? " low" : ""}${state.active === pick.id ? " is-active" : ""}`;
      const marker = rank < RANKED_LIMIT
        ? L.marker([C.lat[pick.i], C.lon[pick.i]], {
          pane: "picks",
          icon: L.divIcon({ className: "", html: `<div class="${cls}">${rank + 1}</div>`, iconSize: [24, 24], iconAnchor: [12, 12] }),
          title: `${type} #${rank + 1}`,
          keyboard: false,
        })
        : L.circleMarker([C.lat[pick.i], C.lon[pick.i]], { pane: "picks", radius: 4, color: "#ffffff", weight: 1, fillColor: cssVar(type === "AC" ? "--ac" : "--dc"), fillOpacity: 0.9 });
      marker.bindPopup(() =>
        `<p class="popup-title">${type} pick #${rank + 1} · ${pick.hoursPerPoint.toFixed(1)} h per point per day</p>` +
        `<p class="hint" style="margin:0 0 6px">${escapeHtml(placeLabel(pick))} · ${pick.points} points · ${euro(pick.cost)}</p>${pickDetailHtml(pick)}`,
      { maxWidth: 340, className: "pick-popup", autoPanPaddingTopLeft: [280, 20], autoPanPaddingBottomRight: [20, 20] });
      marker.on("click", () => selectPick(pick.id, false));
      marker.addTo(picksLayer);
      markers.set(pick.id, marker);
    });
  });
}

function renderResults() {
  const summary = byId("summary");
  summary.innerHTML = TYPES.map((type) => {
    const res = results[type];
    if (!res || !activeTypes().includes(type)) {
      return `<div class="summary-card ${type.toLowerCase()}"><div class="summary-top"><strong>${type}</strong><span class="summary-empty">not selected</span></div></div>`;
    }
    const share = res.budget > 0 ? Math.min(100, (res.used / res.budget) * 100) : 0;
    const points = res.picks.reduce((sum, p) => sum + p.points, 0);
    const pointHours = res.picks.reduce((sum, p) => sum + p.pointHours, 0);
    return `<div class="summary-card ${type.toLowerCase()}">
      <div class="summary-top"><strong>${type} · ${res.picks.length} site${res.picks.length === 1 ? "" : "s"}, ${points} points</strong><span>${euro(res.used)}</span></div>
      <div class="bar" role="img" aria-label="${num(share, 0)} % of the ${type} budget used"><span style="width:${share}%"></span></div>
      <div class="summary-sub">${euro(res.budget - res.used)} left of ${euro(res.budget)} · ${num(pointHours, 0)} point-hours / day</div>
      ${res.inArea === 0 ? `<div class="summary-sub">No ${type} candidates in the area.</div>` : ""}
    </div>`;
  }).join("");

  TYPES.forEach((type) => {
    byId(`tab-count-${type}`).textContent = results[type] ? results[type].picks.length : 0;
  });
  const res = results[state.tab];
  const list = byId("picks");
  if (!res || !res.picks.length) {
    const why = !res || !activeTypes().includes(state.tab) ? `${state.tab} is not selected.` :
      res.inArea === 0 ? (state.areaMode === "kreis" && !state.kreise.size ? "Select at least one Landkreis." : `No ${state.tab} candidates in the area.`) :
        res.budget <= 0 ? `The ${state.tab} budget is 0.` : `The ${state.tab} budget is smaller than the cheapest site (${euro(siteCost(state.tab, 2))}).`;
    list.innerHTML = `<li class="picks-empty">No picks. ${why}</li>`;
    return;
  }
  const more = res.picks.length - RANKED_LIMIT;
  list.innerHTML = res.picks.slice(0, RANKED_LIMIT).map((pick, rank) => `
    <li class="pick ${pick.type.toLowerCase()}${state.active === pick.id ? " is-active" : ""}" data-id="${pick.id}">
      <div class="pick-main" role="button" tabindex="0" aria-expanded="${state.active === pick.id}">
        <span class="pick-rank">${rank + 1}</span>
        <span class="pick-what">
          <span class="pick-hours">${pick.hoursPerPoint.toFixed(1)} h</span>
          ${pick.low ? '<span class="tag-low" title="Low confidence">low conf.</span>' : ""}
          <span class="pick-where">${num(pick.pointHours, 0)} point-h/day · ${escapeHtml(placeLabel(pick))}</span>
        </span>
        <span class="pick-points"><input type="number" min="1" max="40" step="1" value="${pick.points}" class="${pick.override ? "is-override" : ""}" aria-label="Points at pick ${rank + 1}" data-points="${pick.id}"></span>
        <span class="pick-cost">${euro(pick.cost)}</span>
      </div>
      ${state.active === pick.id ? `<div class="pick-detail">${pickDetailHtml(pick)}</div>` : ""}
    </li>`).join("") + (more > 0 ? `<li class="picks-empty">+ ${num(more)} more ${state.tab} sites (shown as dots on the map; click one for details).</li>` : "");
}

byId("picks").addEventListener("click", (event) => {
  if (event.target.closest("input, [data-info]")) return;
  const item = event.target.closest(".pick");
  if (item) selectPick(Number(item.dataset.id), true);
});
byId("picks").addEventListener("keydown", (event) => {
  if ((event.key === "Enter" || event.key === " ") && event.target.classList.contains("pick-main")) {
    event.preventDefault();
    selectPick(Number(event.target.closest(".pick").dataset.id), true);
  }
});
byId("picks").addEventListener("change", (event) => {
  const input = event.target.closest("[data-points]");
  if (!input) return;
  const id = Number(input.dataset.points);
  const value = Math.round(Number(input.value));
  if (Number.isFinite(value) && value >= 1) state.overrides.set(id, Math.min(value, 40));
  else state.overrides.delete(id);
  state.active = id;
  schedule();
});

function selectPick(id, fly) {
  state.active = state.active === id && fly ? null : id;
  const pick = [...(results.AC?.picks || []), ...(results.DC?.picks || [])].find((p) => p.id === id);
  if (pick && pick.type !== state.tab) setTab(pick.type);
  renderResults();
  renderPicks();
  if (pick && state.active === id) {
    if (fly) map.flyTo([C.lat[pick.i], C.lon[pick.i]], Math.max(map.getZoom(), 15), { duration: 0.6 });
    const marker = markers.get(id);
    if (marker) setTimeout(() => marker.openPopup(), fly ? 650 : 0);
    const row = byId("picks").querySelector(`[data-id="${id}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }
}

function renderYearNote(factors) {
  const note = byId("year-note");
  const supply = D.scenarios.supply;
  if (state.year === "today") {
    note.textContent = `Predictions at 2026 levels. BW today: ${num(supply.points_today)} register points.`;
    return;
  }
  const year = Number(state.year);
  const values = [...factors];
  const projected = supply.points_today + supply.added_per_year * (year - 2026);
  note.innerHTML = `Kreis factors ${num(Math.min(...values), 2)}–${num(Math.max(...values), 2)} <span class="tag-synthetic">synthetic</span>. ` +
    `Supply trend (real): +${num(supply.added_per_year)} points / year → ~${num(projected)} in ${year}.` +
    (year === 2035 ? " Long-term: weakest scenario." : "");
}

// ---------------------------------------------------------------------------
// Layers and legend
// ---------------------------------------------------------------------------
const cssVar = (name) => getComputedStyle(root).getPropertyValue(name).trim();

function drawCandidates() {
  candidatesLayer.clearLayers();
  const inArea = areaFilter();
  const types = activeTypes().map((t) => (t === "AC" ? 0 : 1));
  let drawn = 0;
  let total = 0;
  const colors = [cssVar("--ac"), cssVar("--dc")];
  for (let i = 0; i < C.n; i++) {
    if (!types.includes(C.type[i]) || (state.hideLow && C.low[i]) || !inArea(i)) continue;
    total++;
    if (drawn >= MAX_CANDIDATE_DOTS) continue;
    drawn++;
    L.circleMarker([C.lat[i], C.lon[i]], { radius: 2.5, stroke: false, fillColor: colors[C.type[i]], fillOpacity: 0.55, interactive: false }).addTo(candidatesLayer);
  }
  candidatesLayer.total = total;
  candidatesLayer.drawn = drawn;
  renderLegend();
}

// 500 m cells drawn into canvas tiles (fast for ~49k cells)
const UsageLayer = L.GridLayer.extend({
  createTile(coords) {
    const tile = document.createElement("canvas");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    const ctx = tile.getContext("2d");
    const origin = coords.scaleBy(size);
    const nw = map.unproject(origin, coords.z);
    const se = map.unproject(origin.add(size), coords.z);
    const dLat = 0.00225;
    for (let b = Math.floor(se.lat / 0.1) - 1; b <= Math.floor(nw.lat / 0.1) + 1; b++) {
      for (let a = Math.floor(nw.lng / 0.1) - 1; a <= Math.floor(se.lng / 0.1) + 1; a++) {
        const cells = cellBuckets.get(`${b},${a}`);
        if (!cells) continue;
        for (const [lat, lon, occ] of cells) {
          const dLon = dLat / Math.cos((lat * Math.PI) / 180);
          const p1 = map.project([lat + dLat, lon - dLon], coords.z).subtract(origin);
          const p2 = map.project([lat - dLat, lon + dLon], coords.z).subtract(origin);
          ctx.fillStyle = USAGE_COLORS[classIndex(hours(occ), USAGE_BREAKS)];
          ctx.fillRect(p1.x, p1.y, Math.max(1, p2.x - p1.x), Math.max(1, p2.y - p1.y));
        }
      }
    }
    return tile;
  },
});
const cellBuckets = new Map();
const usageLayer = new UsageLayer({ pane: "usage", opacity: 0.7 });

function prepareCells() {
  const { columns, rows } = D.cells;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  rows.forEach((row) => {
    const lat = row[col.lat];
    const lon = row[col.lon];
    const key = `${Math.floor(lat / 0.1)},${Math.floor(lon / 0.1)}`;
    if (!cellBuckets.has(key)) cellBuckets.set(key, []);
    cellBuckets.get(key).push([lat, lon, row[col.occ]]);
  });
}

let overusedBuilt = false;
function buildOverused() {
  if (overusedBuilt) return;
  overusedBuilt = true;
  const { columns, rows, meta } = D.overused;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  rows.filter((row) => row[col.overused]).forEach((row) => {
    const type = row[col.type];
    L.circleMarker([row[col.lat], row[col.lon]], { radius: 5, color: "#ffffff", weight: 1.5, fillColor: "#dc2626", fillOpacity: 0.9 })
      .bindPopup(`<p class="popup-title">Overused ${type} station</p>
        <p>${escapeHtml(row[col.name] || "")}<br><span class="hint" style="margin:0">${escapeHtml(row[col.operator] || "")}</span></p>
        <p>Fully occupied hour on <b>${num(row[col.full_share] * 100, 0)} %</b> of ${row[col.days]} valid days
        (target ${num(meta.targets[type] * 100, 0)} %). Mean occupancy ${num(hours(row[col.occ]), 1)} h per point per day.</p>`)
      .addTo(overusedLayer);
  });
}

let stationsBuilt = false;
function buildStations() {
  if (stationsBuilt) return;
  stationsBuilt = true;
  const { columns, rows } = D.stations;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  rows.forEach((row) => {
    const dc = row[col.kw] >= 50;
    L.circleMarker([row[col.lat], row[col.lon]], { radius: dc ? 3.5 : 2.5, color: "#0f172a", weight: 0.6, fillColor: dc ? "#64748b" : "#cbd5e1", fillOpacity: 0.9 })
      .bindPopup(() => `<p class="popup-title">${escapeHtml(row[col.operator] || "Charging station")}</p>
        <p>${escapeHtml(row[col.city] || "")} · ${row[col.points] ?? "?"} points · ${num(row[col.kw], 0)} kW</p>`)
      .addTo(stationsLayer);
  });
}

function applyLayers() {
  const on = (id) => byId(id).checked;
  if (on("layer-candidates")) {
    drawCandidates();
    candidatesLayer.addTo(map);
  } else map.removeLayer(candidatesLayer);
  if (on("layer-usage")) usageLayer.addTo(map);
  else map.removeLayer(usageLayer);
  if (on("layer-overused")) {
    buildOverused();
    overusedLayer.addTo(map);
  } else map.removeLayer(overusedLayer);
  if (on("layer-stations")) {
    buildStations();
    stationsLayer.addTo(map);
  } else map.removeLayer(stationsLayer);
  renderLegend();
}

function renderLegend() {
  const blocks = [`<div class="legend-block"><p class="legend-title">Recommended sites</p><ul>
    <li><span class="legend-pick" style="background:var(--ac)"></span>AC pick (rank)</li>
    <li><span class="legend-pick dc" style="background:var(--dc)"></span>DC pick (rank)</li>
    <li><span class="legend-pick low" style="background:var(--text-3)"></span>Low confidence</li></ul></div>`];
  if (byId("layer-usage").checked) {
    blocks.push(`<div class="legend-block"><p class="legend-title">Expected usage <span class="tag-synthetic">synthetic</span></p>
      <p class="legend-sub">Hours per point per day, typical station, today</p>
      <div class="ramp">${USAGE_COLORS.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ramp-ends"><span>&lt; ${USAGE_BREAKS[0]} h</span><span>≥ ${USAGE_BREAKS[USAGE_BREAKS.length - 1]} h</span></div></div>`);
  }
  if (byId("layer-candidates").checked && candidatesLayer.total !== undefined) {
    const capped = candidatesLayer.total > candidatesLayer.drawn ? ` (first ${num(candidatesLayer.drawn)} shown)` : "";
    blocks.push(`<div class="legend-block"><p class="legend-title">Candidates: ${num(candidatesLayer.total)}${capped}</p></div>`);
  }
  if (byId("layer-overused").checked) {
    blocks.push(`<div class="legend-block"><ul><li><span class="swatch dot" style="background:#dc2626"></span>Overused station (feed)</li></ul></div>`);
  }
  if (byId("layer-stations").checked) {
    blocks.push(`<div class="legend-block"><ul><li><span class="swatch dot" style="background:#cbd5e1"></span>Register station, AC</li>
      <li><span class="swatch dot" style="background:#64748b"></span>Register station, DC (≥ 50 kW)</li></ul></div>`);
  }
  byId("legend").innerHTML = blocks.join("");
}

// Context layers from data/processed (real); failures only cost the outline, not the mock-up
function loadContext() {
  loadJSON("../data/processed/laender.geojson", "state borders")
    .then((data) => {
      const bw = data.features.find((feature) => feature.properties.AGS === "08");
      if (!bw) return;
      const world = [[85, -180], [85, 180], [-85, 180], [-85, -180]];
      const parts = bw.geometry.type === "Polygon" ? [bw.geometry.coordinates] : bw.geometry.coordinates;
      mask = L.polygon([world, ...parts.map((p) => p[0].map(([lon, lat]) => [lat, lon]))], { pane: "mask", interactive: false, stroke: false }).addTo(map);
      themeChanged();
    })
    .catch((error) => console.error("Could not load laender.geojson", error));
  return loadJSON("../data/processed/kreise_bw.geojson", "Kreis boundaries")
    .then((data) => {
      const index = Object.fromEntries(D.candidates.kreise.map((k, i) => [k.ags, i]));
      kreisFeatures = new Array(D.candidates.kreise.length).fill(null);
      data.features.forEach((feature) => {
        const i = index[feature.properties.AGS];
        if (i === undefined) return;
        feature.properties.index = i;
        kreisFeatures[i] = feature;
      });
      kreiseLayer = L.geoJSON(data, { interactive: false }).addTo(map);
      styleKreise();
    })
    .catch((error) => {
      console.error("Could not load kreise_bw.geojson", error);
      toast("Kreis boundaries (data/processed/kreise_bw.geojson) are missing: run python src/extract.py. Kreis selection still works from the list.");
    });
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
async function start() {
  try {
    if (!(await loadAll())) return;
    C = prepareCandidates();
    prepareCells();
    initInputs();
    readInputs();
    await loadContext();
    applyLayers();
    fitArea();
    run();
  } catch (error) {
    console.error("Mock-up failed to start", error);
    fatal(`The mock-up data could not be read (${escapeHtml(error.message)}). The files may be outdated or incomplete; delete <code>data/processed/mockup/</code> and regenerate them:`);
  }
}
start();
