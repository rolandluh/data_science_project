// Concept mock-up of the EV charging site recommender.
// Reads the browser-sized files written by src/mockup_data.py (schema: mockup/README.md), runs the v1 optimizer
// (decision record §9) live on every input change, and explains every input and output with info points (explain.json).
import "../app/js/errorlog.js";
import { byId, escapeHtml, num, classIndex, storage } from "../app/js/util.js";
import { loadJSON, toast } from "../app/js/status.js";

const DATA = "../data/processed/mockup/";
const LOAD_ID = Date.now();
const DATA_VERSION = 4; // must match DATA_VERSION in src/mockup_data.py
const FILES = ["candidates", "cells", "stations", "overused", "sizing", "scenarios", "defaults", "places"];
const TYPES = ["AC", "DC"];
const YEARS = ["2030", "2035"];
const COST_ROWS = [
  ["per_point", "Hardware + install per point (€)", 500],
  ["grid_per_site", "Grid connection per site (€)", 500],
  ["civil_per_site", "Civil works per site (€)", 500],
  ["subsidy_per_site", "Subsidy per site (€, deducted)", 500],
  ["subsidy_pct", "Subsidy (% of site cost)", 1],
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
  byId("popover-body").innerHTML = entry.items
    ? `<ul>${entry.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : `<p>${escapeHtml(entry.text)}</p>`;
  byId("popover-ref").textContent = entry.ref ? `Reference: ${entry.ref}` : "";
  popover.hidden = false;
  const rect = button.getBoundingClientRect();
  const width = popover.offsetWidth;
  const height = popover.offsetHeight;
  const left = Math.min(Math.max(8, rect.left - 12), window.innerWidth - width - 8);
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
let factors = null; // { "2030": Float32Array per Kreis index, "2035": ... }
const places = new Map(); // datalist label -> [lat, lon]

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
      "The data folder is not in git; generate it on this computer:");
    return false;
  }
  D = Object.fromEntries(FILES.map((name, i) => [name, results[i].value]));
  const outdated = FILES.filter((name) => (D[name].meta || {}).version !== DATA_VERSION);
  if (outdated.length) {
    console.error("Mock-up data outdated", outdated);
    fatal(`${outdated.map((name) => `<code>${name}.json</code>`).join(", ")} ${outdated.length === 1 ? "was" : "were"} made by an older version of the generator. ` +
      "Run it again; it rewrites only the outdated files:");
    return false;
  }
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
    low: new Uint8Array(n), // derived from feedM and the user's low-confidence distance (setLowConfidence)
    feedM: new Float32Array(n),
  };
  rows.forEach((row, i) => {
    arrays.lat[i] = row[col.lat];
    arrays.lon[i] = row[col.lon];
    arrays.occ[i] = row[col.occ];
    arrays.kreis[i] = row[col.kreis];
    arrays.type[i] = row[col.type] === "DC" ? 1 : 0;
    arrays.feedM[i] = row[col.feed_m];
  });
  return arrays;
}

// Low confidence = nearest station with usage data further away than the threshold (§7, simplified)
function setLowConfidence(km) {
  const limit = km * 1000;
  let count = 0;
  for (let i = 0; i < C.n; i++) {
    C.low[i] = C.feedM[i] > limit ? 1 : 0;
    count += C.low[i];
  }
  return count;
}

function prepareFactors() {
  factors = {};
  YEARS.forEach((year) => {
    factors[year] = Float32Array.from(D.candidates.kreise, (k) => (D.scenarios.factors[k.ags] || {})[year] || 1);
  });
}

function preparePlaces() {
  const { columns, rows } = D.places;
  const col = Object.fromEntries(columns.map((name, i) => [name, i]));
  const kreisName = Object.fromEntries(D.candidates.kreise.map((k) => [k.ags, k.name]));
  const counts = {};
  rows.forEach((row) => { counts[row[col.name]] = (counts[row[col.name]] || 0) + 1; });
  rows.forEach((row) => {
    const name = row[col.name];
    // Towns with the same name get their Kreis added
    const label = counts[name] > 1 ? `${name} (${kreisName[row[col.kreis_ags]] || row[col.kreis_ags]})` : name;
    places.set(label.toLowerCase(), { label, latlng: [row[col.lat], row[col.lon]] });
  });
  byId("place-list").innerHTML = [...places.values()].map((p) => `<option value="${escapeHtml(p.label)}"></option>`).join("");
}

// ---------------------------------------------------------------------------
// State and inputs (everything starts empty; Advanced and cost components start at their defaults)
// ---------------------------------------------------------------------------
const state = {
  areaMode: null, // "radius" | "kreis"
  center: null, // [lat, lon]
  radiusKm: null,
  kreise: new Set(),
  charger: null, // "ac" | "dc" | "both"
  budgetMode: "simple",
  budget: { AC: null, DC: null },
  cost: null,
  maxPts: { AC: 8, DC: 12 },
  spacing: { AC: 500, DC: 3000 },
  hideLow: false,
  level: "standard", // occupancy level for sizing: comfortable / standard / lean
  lowConfKm: 2,
  minUse: { AC: null, DC: null }, // minimum hours per point per day at the recommended size
  lowCount: 0,
  overrides: new Map(), // candidate id -> points
  tab: "AC",
  active: null, // selected pick id
  fitPending: false, // zoom to the area after the next run
};

const activeTypes = () => (!state.charger ? [] : state.charger === "both" ? TYPES : [state.charger.toUpperCase()]);
const costFor = (type) => (state.budgetMode === "detailed" ? state.cost[type] : D.defaults.cost[type]);
const radioValue = (name) => {
  const checked = document.querySelector(`input[name="${name}"]:checked`);
  return checked ? checked.value : null;
};
const numberOrNull = (input) => {
  const value = Number(input.value);
  return input.value.trim() === "" || !Number.isFinite(value) ? null : value;
};
const numberOf = (input, fallback) => numberOrNull(input) ?? fallback;

function areaComplete() {
  if (state.areaMode === "radius") return Boolean(state.center && state.radiusKm > 0);
  if (state.areaMode === "kreis") return state.kreise.size > 0;
  return false;
}

// What is still missing before the optimizer can run (shown as a checklist)
function missingInputs() {
  const steps = [];
  steps.push({ label: "Area", done: areaComplete(),
    hint: !state.areaMode ? "choose Radius or Landkreise" :
      state.areaMode === "radius" ? (!state.center ? "set a centre (town or map click)" : "enter a radius in km") : "pick at least one Landkreis" });
  steps.push({ label: "Charger type", done: activeTypes().length > 0, hint: "AC, DC or both" });
  const budgetsDone = activeTypes().length > 0 && activeTypes().every((t) => state.budget[t] > 0);
  steps.push({ label: "Budget", done: budgetsDone,
    hint: activeTypes().length ? `enter the ${activeTypes().filter((t) => !(state.budget[t] > 0)).join(" and ")} budget` : "after the charger type" });
  return steps;
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(run, RUN_DELAY_MS);
}

function buildCostTable() {
  byId("cost-body").innerHTML = COST_ROWS.map(([key, label, step]) =>
    `<tr><th scope="row">${label}</th>${TYPES.map((t) =>
      `<td data-type="${t}"><input type="number" min="0" step="${step}" data-cost="${t}.${key}" aria-label="${t} ${label}"></td>`).join("")}</tr>`).join("");
  fillCostInputs();
  document.querySelectorAll("[data-cost]").forEach((input) => input.addEventListener("input", readInputs));
}

function fillCostInputs() {
  document.querySelectorAll("[data-cost]").forEach((input) => {
    const [t, key] = input.dataset.cost.split(".");
    input.value = state.cost[t][key];
  });
}

function buildKreisList() {
  const list = byId("kreis-list");
  list.innerHTML = D.candidates.kreise.map((k, i) =>
    `<li data-name="${escapeHtml(k.name.toLowerCase())}"><label><input type="checkbox" value="${i}"> ${escapeHtml(k.name)}<span class="kreis-type">${escapeHtml(k.type)}</span></label></li>`).join("");
  list.addEventListener("change", (event) => {
    const i = Number(event.target.value);
    if (event.target.checked) state.kreise.add(i);
    else state.kreise.delete(i);
    state.fitPending = true;
    kreiseChanged();
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

function setCenter(latlng, label) {
  state.center = latlng;
  byId("place").value = label || "";
  state.fitPending = true;
  schedule();
}

function readInputs() {
  const previousRadius = state.radiusKm;
  state.areaMode = radioValue("area-mode");
  state.radiusKm = numberOrNull(byId("radius"));
  if (state.radiusKm !== null && state.radiusKm <= 0) state.radiusKm = null;
  if (state.radiusKm !== previousRadius) state.fitPending = true;
  state.charger = radioValue("charger");
  state.budgetMode = radioValue("budget-mode");
  state.hideLow = byId("hide-low").checked;
  state.level = radioValue("level") || "standard";
  const lowConfKm = Math.max(0.1, numberOf(byId("lowconf-km"), D.candidates.meta.low_confidence_m / 1000));
  if (lowConfKm !== state.lowConfKm || !state.lowCount) {
    state.lowConfKm = lowConfKm;
    state.lowCount = setLowConfidence(lowConfKm);
  }
  byId("lowconf-note").textContent = `${num((state.lowCount / C.n) * 100, 1)} % of all candidates`;
  const targets = D.sizing.targets_by_level[state.level];
  byId("level-note").textContent = `A new site may be full (a whole hour with every point busy) on at most ${num(targets.AC * 100, 1)} % of days (AC) / ` +
    `${num(targets.DC * 100, 1)} % (DC): as full as the ${num(D.sizing.levels[state.level] * 100, 0)}th percentile of today's stations.`;
  TYPES.forEach((t) => {
    const budget = numberOrNull(byId(`budget-${t}`));
    state.budget[t] = budget === null ? null : Math.max(0, budget);
    state.maxPts[t] = Math.max(1, Math.round(numberOf(byId(`maxpts-${t}`), D.defaults.max_points[t])));
    state.spacing[t] = Math.max(0, numberOf(byId(`spacing-${t}`), D.defaults.spacing_m[t]));
    const minUse = numberOrNull(byId(`minuse-${t}`));
    state.minUse[t] = minUse === null || minUse <= 0 ? null : Math.min(minUse, 24);
  });
  document.querySelectorAll("[data-cost]").forEach((input) => {
    const [t, key] = input.dataset.cost.split(".");
    state.cost[t][key] = Math.max(0, numberOf(input, D.defaults.cost[t][key]));
  });
  state.cost.AC.subsidy_pct = Math.min(100, state.cost.AC.subsidy_pct);
  state.cost.DC.subsidy_pct = Math.min(100, state.cost.DC.subsidy_pct);

  byId("area-hint").hidden = Boolean(state.areaMode);
  byId("area-radius").hidden = state.areaMode !== "radius";
  byId("area-kreis").hidden = state.areaMode !== "kreis";
  byId("budget-hint").hidden = activeTypes().length > 0;
  byId("cost-detail").hidden = state.budgetMode !== "detailed" || !activeTypes().length;
  document.querySelectorAll("[data-type]").forEach((el) => el.classList.toggle("is-off", !activeTypes().includes(el.dataset.type)));
  if (activeTypes().length && !activeTypes().includes(state.tab)) setTab(activeTypes()[0]);
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
  TYPES.forEach((t) => {
    byId(`budget-${t}`).value = "";
    byId(`budget-${t}`).placeholder = `e.g. ${num(d.budget_eur[t])}`;
    byId(`maxpts-${t}`).value = d.max_points[t];
    byId(`spacing-${t}`).value = d.spacing_m[t];
  });
  byId("radius").value = "";
  byId("lowconf-km").value = D.candidates.meta.low_confidence_m / 1000;
  TYPES.forEach((t) => { byId(`minuse-${t}`).value = ""; });
  byId("place").value = "";
  document.querySelectorAll('input[name="area-mode"], input[name="charger"]').forEach((input) => { input.checked = false; });
  buildCostTable();
  buildKreisList();
  kreiseChanged();

  document.querySelectorAll(".inputs input:not([data-cost]):not(#kreis-filter):not(#place):not([type=checkbox][value])")
    .forEach((input) => input.addEventListener(input.type === "radio" || input.type === "checkbox" ? "change" : "input", readInputs));
  document.querySelectorAll('input[name="area-mode"]').forEach((input) => input.addEventListener("change", () => {
    state.fitPending = true;
  }));
  byId("place").addEventListener("change", (event) => {
    const query = event.target.value.trim().toLowerCase();
    if (!query) return;
    const place = places.get(query) || [...places.values()].find((p) => p.label.toLowerCase().startsWith(query));
    if (place) setCenter(place.latlng, place.label);
    else toast(`No Baden-Württemberg town called "${event.target.value}". Pick one from the list or click the map.`, "info");
  });
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
  if (!areaComplete()) return () => false;
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
  if (state.areaMode === "radius" && state.center) {
    if (state.radiusKm > 0) {
      L.circle(state.center, { radius: state.radiusKm * 1000, color: "#2563eb", weight: 2, dashArray: "6 6", fillOpacity: 0.04, interactive: false }).addTo(areaLayer);
    }
    L.circleMarker(state.center, { radius: 5, color: "#ffffff", weight: 2, fillColor: "#2563eb", fillOpacity: 1, interactive: false }).addTo(areaLayer);
  }
  byId("center-label").textContent = state.center
    ? `Centre ${state.center[0].toFixed(3)}, ${state.center[1].toFixed(3)}. Click the map to move it.`
    : "No centre yet: type a town or click the map.";
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
  if (state.areaMode === "radius" && state.center) {
    if (state.radiusKm > 0) map.flyToBounds(L.latLng(state.center).toBounds(state.radiusKm * 2000), { padding: [30, 30], duration: 0.6 });
    else map.flyTo(state.center, Math.max(map.getZoom(), 11), { duration: 0.6 });
  } else if (state.areaMode === "kreis" && state.kreise.size && kreiseLayer) {
    const bounds = L.latLngBounds([]);
    kreiseLayer.eachLayer((layer) => state.kreise.has(layer.feature.properties.index) && bounds.extend(layer.getBounds()));
    if (bounds.isValid()) map.flyToBounds(bounds, { padding: [30, 30], duration: 0.6 });
  }
}

map.on("click", (event) => {
  if (!D) return;
  const { lat, lng } = event.latlng;
  if (state.areaMode === "radius") {
    setCenter([lat, lng], "");
  } else if (state.areaMode === "kreis") {
    const i = kreisAt(lat, lng);
    if (i < 0) return;
    if (state.kreise.has(i)) state.kreise.delete(i);
    else state.kreise.add(i);
    kreiseChanged();
  }
});

// ---------------------------------------------------------------------------
// Sizing (§5) and optimizer (§9); picks and sizing use today's prediction
// ---------------------------------------------------------------------------
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
    if (share <= S.targets_by_level[state.level][type]) return { n, share, capped: false };
  }
  return { n: max, share: lookupFullShare(type, max, (occ2 * ref) / max), capped: true };
}

function siteCost(type, points) {
  const c = costFor(type);
  const gross = c.grid_per_site + c.civil_per_site + c.per_point * points - c.subsidy_per_site;
  return Math.max(0, gross * (1 - (c.subsidy_pct || 0) / 100));
}

// Site demand in a scenario year: point-hours x Kreis factor, capped at today's highest occupancy (§9)
function scenarioDemand(pick, year) {
  const cap = D.scenarios.occ_cap[pick.type];
  const raw = C.occ[pick.i] * factors[year][C.kreis[pick.i]];
  const occ2 = Math.min(raw, cap);
  const pointHours = occ2 * D.sizing.reference_points * 24;
  return { pointHours, hoursPerPoint: pointHours / pick.points, capped: raw > cap };
}

function optimize(type, inArea) {
  const t = type === "AC" ? 0 : 1;
  const active = activeTypes().includes(type);
  const budget = active ? state.budget[type] || 0 : 0;
  const ref = D.sizing.reference_points;
  const result = { type, budget, used: 0, picks: [], inArea: 0, skippedSpacing: 0, skippedMinUse: 0 };
  if (!active) return result;

  // 1. candidates of this type in the area
  const order = [];
  for (let i = 0; i < C.n; i++) {
    if (C.type[i] !== t || (state.hideLow && C.low[i]) || !inArea(i)) continue;
    order.push(i);
  }
  result.inArea = order.length;
  if (budget <= 0) return result;
  // 2. rank by predicted point-hours per day (occupancy x 2 points x 24 h; same order as occupancy)
  order.sort((a, b) => C.occ[b] - C.occ[a]);

  // 3. greedy: skip within spacing of an earlier pick of this type, add site cost until the budget is used
  const spacing = state.spacing[type];
  const cellM = Math.max(spacing, 1);
  const lonScale = mPerDegLon(48.6);
  const grid = new Map();
  const key = (gx, gy) => `${gx},${gy}`;
  const cheapest = siteCost(type, Math.min(2, ...state.overrides.values()));
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
    const sized = sizeFor(type, C.occ[i]);
    const override = state.overrides.get(id);
    const points = override || sized.n;
    const pointHours = C.occ[i] * ref * 24;
    if (state.minUse[type] !== null && pointHours / points < state.minUse[type]) {
      result.skippedMinUse++;
      continue;
    }
    const cost = siteCost(type, points);
    if (cost > remaining) continue;
    remaining -= cost;
    result.picks.push({ i, id, type, occ2: C.occ[i], pointHours, hoursPerPoint: pointHours / points, points, sized,
      override: Boolean(override), cost, low: Boolean(C.low[i]) });
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
let ready = false;

function run() {
  if (!D) return;
  const steps = missingInputs();
  ready = steps.every((s) => s.done);
  const start = performance.now();
  const inArea = areaFilter();
  results = ready ? { AC: optimize("AC", inArea), DC: optimize("DC", inArea) } : { AC: null, DC: null };
  const elapsed = performance.now() - start;
  if (!ready) state.active = null;
  drawArea();
  renderStart(steps);
  renderPicks();
  renderResults();
  renderLegend();
  if (state.fitPending && areaComplete()) {
    state.fitPending = false;
    fitArea();
  }
  const areaKey = `${state.areaMode}|${state.center}|${state.radiusKm}|${[...state.kreise]}|${state.charger}|${state.hideLow}|${state.lowConfKm}`;
  if (areaKey !== lastAreaKey) {
    lastAreaKey = areaKey;
    if (byId("layer-candidates").checked) drawCandidates();
  }
  byId("override-count").textContent = state.overrides.size ? `${state.overrides.size} active.` : "";
  byId("override-reset").disabled = state.overrides.size === 0;
  byId("timing").textContent = ready
    ? `Optimizer ran in ${num(elapsed, 0)} ms over ${num(results.AC.inArea + results.DC.inArea)} candidates in the area.` : "";
}

function renderStart(steps) {
  const box = byId("start");
  byId("summary-block").hidden = !ready;
  byId("picks-block").hidden = !ready;
  box.hidden = ready;
  if (ready) return;
  box.innerHTML = `<p class="start-title">Set the inputs to get recommendations</p>
    <ol class="start-steps">${steps.map((s) => `<li class="${s.done ? "is-done" : ""}">
      <span class="start-check" aria-hidden="true">${s.done ? "✓" : ""}</span>
      <span><b>${s.label}</b>${s.done ? "" : ` <span class="hint-inline">${escapeHtml(s.hint)}</span>`}</span></li>`).join("")}</ol>
    <p class="hint">Advanced settings and cost components already hold default values.</p>`;
}

function kreisName(i) {
  return D.candidates.kreise[C.kreis[i]].name;
}

function parkingLabel(pick) {
  const parking = C.rows[pick.i][C.col.parking];
  return parking ? parking.replace(/[_-]/g, " ") : "parking";
}

function placeLabel(pick) {
  return `${kreisName(pick.i)} · ${parkingLabel(pick)}`;
}

function reasonText(pick) {
  const reason = C.rows[pick.i][C.col.dc_reason];
  return pick.type === "DC" ? `DC: ${reason}` : "AC: no motorway, primary road or supermarket nearby";
}

function pointIcons(pick) {
  return `<span class="point-icons" aria-hidden="true">${'<i></i>'.repeat(Math.min(pick.points, 40))}</span>`;
}

// Per-pick facts, shared by the map popup and the expanded list row
function pickInfoHtml(pick) {
  const row = C.rows[pick.i];
  const years = YEARS.map((year) => ({ year, ...scenarioDemand(pick, year) }));
  const today = { year: "Today", pointHours: pick.pointHours, hoursPerPoint: pick.hoursPerPoint };
  const cells = [today, ...years];
  const fullShare = lookupFullShare(pick.type, pick.points, (pick.occ2 * D.sizing.reference_points) / pick.points);
  return `
    <div class="points-cue">${pointIcons(pick)}<span><b>${pick.points}</b> charging points${pick.override ? ` <span class="hint-inline">(your override; rule: ${pick.sized.n})</span>` : ""}
      <button class="info" type="button" data-info="points">i</button></span></div>
    <p class="hint flush">Full on ~${num(fullShare * 100, 0)} % of days at this size${pick.sized.capped && !pick.override ? " · at the cap" : ""}</p>
    <table class="demand-table">
      <caption>Site demand <span class="tag-synthetic">synthetic</span> <button class="info" type="button" data-info="demand_years">i</button></caption>
      <thead><tr><th></th>${cells.map((c) => `<th scope="col">${c.year}</th>`).join("")}</tr></thead>
      <tbody>
        <tr><th scope="row">Point-h / day</th>${cells.map((c) => `<td>${num(c.pointHours, 0)}${c.capped ? "*" : ""}</td>`).join("")}</tr>
        <tr><th scope="row">h / point / day</th>${cells.map((c) => `<td>${c.hoursPerPoint.toFixed(1)}</td>`).join("")}</tr>
      </tbody>
    </table>
    ${years.some((y) => y.capped) ? '<p class="hint flush">* capped at today\'s highest occupancy</p>' : ""}
    <dl class="pick-facts">
      <dt>Site cost <button class="info" type="button" data-info="site_cost">i</button></dt><dd>${euro(pick.cost)}</dd>
      <dt>Type <button class="info" type="button" data-info="dc_reason">i</button></dt><dd>${escapeHtml(reasonText(pick))}</dd>
      <dt>Nearby</dt><dd>${num(row[C.col.residents_1km])} residents within 1 km · ${num(row[C.col.destinations_500m])} destinations within 500 m</dd>
      <dt>Nearest station with usage data <button class="info" type="button" data-info="nearest_station">i</button></dt><dd>${num(row[C.col.feed_m] / 1000, 1)} km</dd>
    </dl>
    ${pick.low ? '<div class="pick-flags"><span class="tag-low">Low confidence</span> <button class="info" type="button" data-info="confidence">i</button></div>' : ""}`;
}

// Popup: facts on the left, Google Street View on the right (same keyless embed as app/js/streetview.js)
function popupContent(pick, rank) {
  const ll = `${C.lat[pick.i].toFixed(6)},${C.lon[pick.i].toFixed(6)}`;
  const box = document.createElement("div");
  box.className = "sv-bubble pick-bubble";
  box.innerHTML = `<div class="sv-info pick-info">
      <p class="eyebrow">${pick.type} pick #${rank + 1} · ${escapeHtml(kreisName(pick.i))}</p>
      <p class="popup-title">${escapeHtml(parkingLabel(pick))}</p>
      ${pickInfoHtml(pick)}
      <p class="sv-links"><a href="https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${ll}" target="_blank" rel="noopener noreferrer">Street View in Google Maps ↗</a>
        <button class="info" type="button" data-info="streetview">i</button></p>
    </div>`;
  const iframe = document.createElement("iframe");
  iframe.title = "Google Street View";
  iframe.referrerPolicy = "no-referrer";
  iframe.allow = "accelerometer; gyroscope; fullscreen";
  iframe.allowFullscreen = true;
  iframe.loading = "lazy";
  iframe.src = `https://www.google.com/maps?layer=c&cbll=${ll}&cbp=12,0,0,0,0&output=svembed`;
  box.appendChild(iframe);
  const { width, stacked } = popupLayout();
  box.style.width = `${width}px`;
  if (!stacked) iframe.style.width = `${width - 280}px`;
  return box;
}

// Popup size follows the map area: info and Street View side by side when there is room, stacked otherwise
function popupLayout() {
  const width = Math.max(260, Math.min(780, map.getSize().x - 60));
  return { width, stacked: width < 600 };
}

function popupOptions() {
  const { width, stacked } = popupLayout();
  return { minWidth: width, maxWidth: width, className: `sv-popup pick-popup${stacked ? " stacked" : ""}`,
    autoPanPaddingTopLeft: [20, 20], autoPanPaddingBottomRight: [20, 20] };
}

function renderPicks() {
  picksLayer.clearLayers();
  markers.clear();
  TYPES.forEach((type) => {
    const res = results[type];
    if (!res) return;
    res.picks.forEach((pick, rank) => {
      const cls = `pick-marker ${type.toLowerCase()}${pick.low ? " low" : ""}${state.active === pick.id ? " is-active" : ""}`;
      const marker = rank < RANKED_LIMIT
        ? L.marker([C.lat[pick.i], C.lon[pick.i]], {
          pane: "picks",
          icon: L.divIcon({
            className: "",
            html: `<div class="${cls}"><span class="pick-num">${rank + 1}</span><span class="pick-pts" title="${pick.points} charging points">${pick.points}</span></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          }),
          title: `${type} #${rank + 1}: ${pick.points} points`,
          keyboard: false,
        })
        : L.circleMarker([C.lat[pick.i], C.lon[pick.i]], { pane: "picks", radius: 3 + Math.min(pick.points, 12) / 3, color: "#ffffff", weight: 1, fillColor: cssVar(type === "AC" ? "--ac" : "--dc"), fillOpacity: 0.9 });
      marker.bindPopup(() => popupContent(pick, rank), popupOptions());
      marker.on("click", () => selectPick(pick.id, false));
      marker.addTo(picksLayer);
      markers.set(pick.id, marker);
    });
  });
}

function renderResults() {
  if (!ready) {
    byId("picks").innerHTML = "";
    return;
  }
  byId("summary").innerHTML = TYPES.map((type) => {
    const res = results[type];
    if (!activeTypes().includes(type)) {
      return `<div class="summary-card ${type.toLowerCase()}"><div class="summary-top"><strong>${type}</strong><span class="summary-empty">not selected</span></div></div>`;
    }
    const share = res.budget > 0 ? Math.min(100, (res.used / res.budget) * 100) : 0;
    const points = res.picks.reduce((sum, p) => sum + p.points, 0);
    const demand = [["Today", res.picks.reduce((sum, p) => sum + p.pointHours, 0)],
      ...YEARS.map((year) => [year, res.picks.reduce((sum, p) => sum + scenarioDemand(p, year).pointHours, 0)])];
    return `<div class="summary-card ${type.toLowerCase()}">
      <div class="summary-top"><strong>${type} · ${res.picks.length} site${res.picks.length === 1 ? "" : "s"}, ${points} points</strong><span>${euro(res.used)}</span></div>
      <div class="bar" role="img" aria-label="${num(share, 0)} % of the ${type} budget used"><span style="width:${share}%"></span></div>
      <div class="summary-sub">${euro(res.budget - res.used)} left of ${euro(res.budget)}</div>
      ${res.picks.length ? `<div class="summary-sub">Demand, point-h / day: ${demand.map(([y, v]) => `${y} <b>${num(v, 0)}</b>`).join(" · ")} <span class="tag-synthetic">synthetic</span></div>` : ""}
      ${res.inArea === 0 ? `<div class="summary-sub">No ${type} candidates in the area.</div>` : ""}
      ${state.minUse[type] !== null ? `<div class="summary-sub">Minimum usage ${num(state.minUse[type], 1)} h per point per day: ${num(res.skippedMinUse)} candidates below it skipped.</div>` : ""}
    </div>`;
  }).join("");

  TYPES.forEach((type) => {
    byId(`tab-count-${type}`).textContent = results[type] ? results[type].picks.length : 0;
  });
  const res = results[state.tab];
  const list = byId("picks");
  if (!res || !res.picks.length) {
    const why = !res || !activeTypes().includes(state.tab) ? `${state.tab} is not selected.` :
      res.inArea === 0 ? `No ${state.tab} candidates in the area.` :
        res.skippedMinUse > 0 ? `No ${state.tab} site in the area reaches the minimum usage of ${num(state.minUse[state.tab], 1)} h per point per day.` :
          `The ${state.tab} budget is smaller than the cheapest site (${euro(siteCost(state.tab, 2))}).`;
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
      ${state.active === pick.id ? `<div class="pick-detail">${pickInfoHtml(pick)}</div>` : ""}
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
  if (fly) renderPicks(); // markers are only rebuilt from the list, so a marker click keeps its popup open
  if (pick && state.active === id) {
    if (fly) map.flyTo([C.lat[pick.i], C.lon[pick.i]], Math.max(map.getZoom(), 16), { duration: 0.6 });
    const marker = markers.get(id);
    if (marker && fly) setTimeout(() => marker.openPopup(), 650);
    const row = byId("picks").querySelector(`[data-id="${id}"]`);
    if (row) row.scrollIntoView({ block: "nearest" });
  }
}

map.on("popupopen", () => document.querySelector(".map-wrap").classList.add("popup-open"));
map.on("popupclose", () => document.querySelector(".map-wrap").classList.remove("popup-open"));
map.on("resize", () => {
  if (ready) renderPicks();
});

// ---------------------------------------------------------------------------
// Layers and legend
// ---------------------------------------------------------------------------
function cssVar(name) {
  return getComputedStyle(root).getPropertyValue(name).trim();
}

function drawCandidates() {
  candidatesLayer.clearLayers();
  const inArea = areaFilter();
  const types = (activeTypes().length ? activeTypes() : TYPES).map((t) => (t === "AC" ? 0 : 1));
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
const cellBuckets = new Map();
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
        <p>Fully occupied hour on <b>${num(row[col.full_share] * 100, 0)} %</b> of ${row[col.days]} days with usage data
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
  const blocks = [];
  if (ready) {
    blocks.push(`<div class="legend-block"><p class="legend-title">Recommended sites</p><ul>
      <li><span class="pick-marker ac legend-marker">1</span>AC pick (number = rank)</li>
      <li><span class="pick-marker dc legend-marker">1</span>DC pick (number = rank)</li>
      <li><span class="pick-pts legend-pts">4</span>Charging points at the site</li>
      <li><span class="pick-marker ac low legend-marker">1</span>Low confidence (dashed outline)</li></ul></div>`);
  }
  if (byId("layer-usage").checked) {
    blocks.push(`<div class="legend-block"><p class="legend-title">Expected usage <span class="tag-synthetic">synthetic</span></p>
      <p class="legend-sub">Hours per point per day, typical station, today</p>
      <div class="ramp">${USAGE_COLORS.map((c) => `<span style="background:${c}"></span>`).join("")}</div>
      <div class="ramp-ends"><span>&lt; ${USAGE_BREAKS[0]} h</span><span>≥ ${USAGE_BREAKS[USAGE_BREAKS.length - 1]} h</span></div></div>`);
  }
  if (byId("layer-candidates").checked) {
    const text = !areaComplete() ? "Candidates: set an area first" :
      `Candidates: ${num(candidatesLayer.total || 0)}${candidatesLayer.total > candidatesLayer.drawn ? ` (first ${num(candidatesLayer.drawn)} shown)` : ""}`;
    blocks.push(`<div class="legend-block"><p class="legend-title">${text}</p></div>`);
  }
  if (byId("layer-overused").checked) {
    blocks.push('<div class="legend-block"><ul><li><span class="swatch dot" style="background:#dc2626"></span>Overused station (usage data)</li></ul></div>');
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
    prepareFactors();
    prepareCells();
    preparePlaces();
    initInputs();
    readInputs();
    await loadContext();
    applyLayers();
    run();
  } catch (error) {
    console.error("Mock-up failed to start", error);
    fatal(`The mock-up data could not be read (${escapeHtml(error.message)}). The files may be outdated or incomplete; delete <code>data/processed/mockup/</code> and regenerate them:`);
  }
}
start();
