// Planner-facing UI: theme, developer panel, layer panel, district search, shortcuts
import { map, badenWuerttemberg } from "./map.js";
import { districtsLoaded } from "./layers.js";
import { byId, storage, setChecked, escapeHtml } from "./util.js";

const root = document.documentElement;

/* ---------- Theme: system setting by default, manual override remembered ---------- */
const themeButton = byId("theme-toggle");
const systemDark = matchMedia("(prefers-color-scheme: dark)");
const effectiveDark = () => root.dataset.theme === "dark" || (root.dataset.theme !== "light" && systemDark.matches);

function themeChanged() {
  const dark = effectiveDark();
  themeButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
  themeButton.setAttribute("aria-pressed", String(dark));
  document.dispatchEvent(new CustomEvent("themechange", { detail: { dark } }));
}
themeButton.addEventListener("click", () => {
  const next = effectiveDark() ? "light" : "dark";
  root.dataset.theme = next;
  storage.set("theme", next);
  themeChanged();
});
systemDark.addEventListener("change", () => {
  if (!root.dataset.theme) themeChanged();
});
themeChanged();

/* ---------- Developer panel ---------- */
const devPanel = byId("devpanel");
const devButton = byId("dev-toggle");

function setDevOpen(open, { focus = false } = {}) {
  document.body.classList.toggle("dev-open", open);
  devButton.setAttribute("aria-expanded", String(open));
  devPanel.inert = !open;
  storage.set("devPanel", open ? "1" : "0");
  if (open && focus) byId("dev-close").focus();
  if (!open && focus) devButton.focus();
}
devButton.addEventListener("click", () => setDevOpen(!document.body.classList.contains("dev-open"), { focus: true }));
byId("dev-close").addEventListener("click", () => setDevOpen(false, { focus: true }));
setDevOpen(storage.get("devPanel") === "1");

/* ---------- Planner switches drive the developer switches (single source of truth) ---------- */
const proxies = [...document.querySelectorAll("[data-proxy]")];
const targetsOf = (proxy) => proxy.dataset.proxy.split(" ").map(byId);

function syncProxies() {
  proxies.forEach((proxy) => {
    proxy.checked = targetsOf(proxy).some((input) => input.checked);
  });
  updateGroupCounts();
}
proxies.forEach((proxy) => {
  proxy.addEventListener("change", (event) => {
    event.stopPropagation(); // the developer switch fires its own change event
    targetsOf(proxy).forEach((input) => setChecked(input, proxy.checked));
    syncProxies();
  });
});
document.addEventListener("change", (event) => {
  if (event.target.closest("#devpanel")) syncProxies();
});

// Charging technology: segmented control in the planner panel, select in the developer panel
const technology = byId("technology");
const techRadios = [...document.querySelectorAll('input[name="tech-planner"]')];
techRadios.forEach((radio) =>
  radio.addEventListener("change", (event) => {
    event.stopPropagation();
    if (!radio.checked) return;
    technology.value = radio.value;
    technology.dispatchEvent(new Event("change", { bubbles: true }));
  })
);
technology.addEventListener("change", () => {
  techRadios.forEach((radio) => (radio.checked = radio.value === technology.value));
});

/* ---------- Collapsible layer groups (state remembered) ---------- */
let groupState = {};
try {
  groupState = JSON.parse(storage.get("groups", "{}")) || {};
} catch (error) {
  groupState = {};
}
document.querySelectorAll(".group").forEach((group) => {
  const toggle = group.querySelector(".group-toggle");
  const groupBody = byId(toggle.getAttribute("aria-controls"));
  const name = group.dataset.group;
  const apply = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    groupBody.hidden = !open;
  };
  if (name in groupState) apply(groupState[name]);
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    apply(open);
    groupState[name] = open;
    storage.set("groups", JSON.stringify(groupState));
  });
});

function updateGroupCounts() {
  document.querySelectorAll(".group").forEach((group) => {
    const count = group.querySelectorAll(".group-body input[data-proxy]:checked").length;
    const badge = group.querySelector(".group-count");
    badge.textContent = count ? String(count) : "";
    group.querySelector(".group-toggle").setAttribute(
      "aria-label",
      `${group.querySelector(".group-toggle span").textContent}${count ? `, ${count} active` : ""}`
    );
  });
}

/* ---------- Sidebar drawer on small screens ---------- */
const sidebar = byId("sidebar");
const scrim = byId("scrim");
const sidebarButton = byId("sidebar-toggle");

function setSidebarOpen(open) {
  document.body.classList.toggle("sidebar-open", open);
  sidebarButton.setAttribute("aria-expanded", String(open));
  scrim.hidden = !open;
  if (open) sidebar.querySelector("input, button").focus();
}
sidebarButton.addEventListener("click", () => setSidebarOpen(!document.body.classList.contains("sidebar-open")));
byId("sidebar-close").addEventListener("click", () => {
  setSidebarOpen(false);
  sidebarButton.focus();
});
scrim.addEventListener("click", () => setSidebarOpen(false));

// Leaflet needs to know when the map area changes size
new ResizeObserver(() => map.invalidateSize()).observe(byId("map"));

/* ---------- District search (combobox) ---------- */
const search = byId("district-search");
const list = byId("district-list");
const clearButton = byId("district-clear");
const region = byId("region");
let options = []; // { ags, name, kind, key }
let matches = [];
let activeIndex = -1;

const normalize = (text) =>
  text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss");

districtsLoaded.then((features) => {
  options = features.map((f) => ({
    ags: f.properties.AGS,
    name: f.properties.GEN,
    kind: f.properties.BEZ,
    key: normalize(`${f.properties.GEN} ${f.properties.BEZ}`),
  }));
  if (!options.length) {
    search.placeholder = "Districts unavailable";
    search.disabled = true;
  }
});

function renderList() {
  const query = normalize(search.value.trim());
  matches = options.filter((o) => !query || o.key.includes(query));
  activeIndex = matches.length ? Math.min(Math.max(activeIndex, 0), matches.length - 1) : -1;
  if (!matches.length) {
    list.innerHTML = `<li class="search-empty" role="option" aria-disabled="true">No district matches “${escapeHtml(search.value)}”</li>`;
  } else {
    list.innerHTML = matches
      .map(
        (o, i) =>
          `<li id="district-opt-${i}" role="option" aria-selected="${i === activeIndex}" data-index="${i}">` +
          `<span>${escapeHtml(o.name)}</span><span class="search-kind">${escapeHtml(o.kind)}</span></li>`
      )
      .join("");
  }
  search.setAttribute("aria-activedescendant", activeIndex >= 0 ? `district-opt-${activeIndex}` : "");
  list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest" });
}

function openList() {
  if (!options.length) return;
  list.hidden = false;
  search.setAttribute("aria-expanded", "true");
  renderList();
}
function closeList() {
  list.hidden = true;
  search.setAttribute("aria-expanded", "false");
  search.removeAttribute("aria-activedescendant");
}

function choose(option) {
  search.value = `${option.name} (${option.kind})`;
  clearButton.hidden = false;
  closeList();
  region.value = option.ags;
  region.dispatchEvent(new Event("change", { bubbles: true }));
  setSidebarOpen(false);
}

function clearDistrict() {
  search.value = "";
  clearButton.hidden = true;
  if (region.value !== "circle") {
    region.value = "circle";
    region.dispatchEvent(new Event("change", { bubbles: true }));
    map.fitBounds(badenWuerttemberg);
  }
}

search.addEventListener("focus", openList);
search.addEventListener("input", () => {
  activeIndex = 0;
  clearButton.hidden = !search.value;
  openList();
});
search.addEventListener("keydown", (event) => {
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    if (list.hidden) openList();
    if (!matches.length) return;
    activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + matches.length) % matches.length;
    renderList();
  } else if (event.key === "Enter") {
    event.preventDefault();
    if (matches[activeIndex]) choose(matches[activeIndex]);
  } else if (event.key === "Escape") {
    event.stopPropagation();
    if (!list.hidden) closeList();
    else search.blur();
  }
});
search.addEventListener("blur", () => setTimeout(closeList, 150));
list.addEventListener("mousedown", (event) => {
  const item = event.target.closest("[data-index]");
  if (!item) return;
  event.preventDefault();
  choose(matches[Number(item.dataset.index)]);
});
clearButton.addEventListener("click", () => {
  clearDistrict();
  search.focus();
});
// A district picked in the developer panel shows up in the search box too
region.addEventListener("change", () => {
  const option = options.find((o) => o.ags === region.value);
  search.value = option ? `${option.name} (${option.kind})` : "";
  clearButton.hidden = !option;
});

/* ---------- Keyboard shortcuts ---------- */
const typing = (target) => target.closest("input, select, textarea, [contenteditable]");
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.key === "D" && event.shiftKey && !typing(event.target)) {
    event.preventDefault();
    setDevOpen(!document.body.classList.contains("dev-open"), { focus: true });
  } else if (event.key === "/" && !typing(event.target)) {
    event.preventDefault();
    search.focus();
  } else if (event.key === "Escape") {
    if (document.body.classList.contains("sidebar-open")) {
      setSidebarOpen(false);
      sidebarButton.focus();
    } else if (document.body.classList.contains("dev-open") && devPanel.contains(document.activeElement)) {
      setDevOpen(false, { focus: true });
    }
  }
});

syncProxies();
