// Small helpers shared by all modules

export const byId = (id) => document.getElementById(id);

export function escapeHtml(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Popup with every non-empty column of a record
export function popupHtml(record) {
  const rows = Object.entries(record)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`);
  return `<table class="attr-table">${rows.join("")}</table>`;
}

// Colour class of a value: breaks [b0, b1, ...] give classes < b0, b0 – b1, ..., ≥ last
export function classIndex(value, breaks) {
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

export function classColor(value, breaks, colors) {
  return colors[classIndex(value, breaks)];
}

export function classLabels(breaks, format = (b) => b) {
  return [
    `&lt; ${format(breaks[0])}`,
    ...breaks.slice(0, -1).map((b, i) => `${format(b)} – ${format(breaks[i + 1])}`),
    `≥ ${format(breaks[breaks.length - 1])}`,
  ];
}

export const euro = (value) => `${Math.round(value).toLocaleString("de-DE")} €`;
export const num = (value, digits = 0) =>
  value == null || Number.isNaN(value)
    ? "–"
    : Number(value).toLocaleString("en-GB", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

// localStorage can throw (private mode, blocked site data); the app must work without it
export const storage = {
  get(key, fallback = null) {
    try {
      const value = localStorage.getItem(`evp.${key}`);
      return value === null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`evp.${key}`, value);
    } catch (error) {
      /* ignore */
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(`evp.${key}`);
    } catch (error) {
      /* ignore */
    }
  },
};

// Turns a switch on or off and lets every listener (layers, legend, planner panel) react
export function setChecked(input, checked) {
  if (!input || input.checked === checked) return;
  input.checked = checked;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
