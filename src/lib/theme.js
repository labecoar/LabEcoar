export const heading = { fontFamily: "'Bricolage Grotesque', sans-serif" };
export const body = { fontFamily: "'DM Sans', sans-serif" };

/** Modo noturno (atual) */
export const darkPalette = {
  black: "#111110",
  darkGreen: "rgba(7, 38, 23, 1)",
  blue: "rgba(0, 0, 255, 1)",
  blue_back: "rgba(0, 0, 255, 0.1)",
  lime: "rgba(200, 255, 0, 1)",
  lime_back: "rgba(200, 255, 0, 0.08)",
  cream: "#f4f6f5",
  /** Texto sobre lime/laranja — sempre escuro nos dois modos */
  onAccent: "#111110",
  red: "rgba(255, 0, 0, 1)",
  red_back: "rgba(255, 0, 0, 0.1)",
  orange: "rgba(255, 69, 0, 1)",
  orange_back: "rgba(255, 69, 0, 0.15)",
  pink: "rgba(232, 51, 174, 1)",
  purple: "rgba(170, 102, 255, 1)",
  cyan: "rgba(68, 204, 255, 1)",
  black_back: "rgba(37, 37, 35, 1)",
  black_light: "rgba(46, 46, 44, 1)",
  card: "#252523",
  notification_background: "rgba(200, 255, 0, 0.04)",
  border: "rgba(255, 255, 222, 0.08)",
  borderStrong: "rgba(255, 255, 222, 0.15)",
  overlay: "rgba(255, 255, 255, 0.05)",
};

/**
 * Modo dia — inverte fundo/texto e suaviza superfícies.
 * Mantém accents (lime, blue, orange) com contraste legível.
 */
export const lightPalette = {
  black: "#f4f6f5",
  darkGreen: "rgba(220, 242, 230, 1)",
  blue: "rgba(0, 70, 220, 1)",
  blue_back: "rgba(0, 70, 220, 0.08)",
  lime: "rgba(180, 220, 0, 1)",
  lime_back: "rgba(140, 190, 0, 0.12)",
  cream: "#161616",
  onAccent: "#111110",
  red: "rgba(200, 20, 20, 1)",
  red_back: "rgba(200, 20, 20, 0.08)",
  orange: "rgba(220, 70, 0, 1)",
  orange_back: "rgba(220, 70, 0, 0.12)",
  pink: "rgba(200, 40, 150, 1)",
  purple: "rgba(120, 70, 210, 1)",
  cyan: "rgba(0, 140, 190, 1)",
  black_back: "rgba(255, 255, 255, 1)",
  black_light: "rgba(232, 234, 233, 1)",
  card: "#ffffff",
  notification_background: "rgba(140, 190, 0, 0.08)",
  border: "rgba(22, 22, 22, 0.1)",
  borderStrong: "rgba(22, 22, 22, 0.18)",
  overlay: "rgba(0, 0, 0, 0.04)",
};

export const THEME_STORAGE_KEY = "labecoar-theme";

const listeners = new Set();

function readStoredMode() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return "dark";
}

let activeMode = typeof window !== "undefined" ? readStoredMode() : "dark";
let activePalette = activeMode === "light" ? lightPalette : darkPalette;

export function getThemeMode() {
  return activeMode;
}

export function getThemePalette() {
  return activePalette;
}

/** Para useSyncExternalStore — notifica React quando o tema muda */
export function subscribeTheme(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notifyThemeListeners() {
  listeners.forEach((listener) => listener());
}

export function applyThemeMode(mode) {
  activeMode = mode === "light" ? "light" : "dark";
  activePalette = activeMode === "light" ? lightPalette : darkPalette;

  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", activeMode);
    root.style.colorScheme = activeMode;

    // Espelha a paleta em CSS vars para updates imediatos no DOM
    Object.entries(activePalette).forEach(([key, value]) => {
      root.style.setProperty(`--c-${key}`, String(value));
    });
  }

  try {
    localStorage.setItem(THEME_STORAGE_KEY, activeMode);
  } catch {
    /* ignore */
  }

  notifyThemeListeners();
  return activePalette;
}

// Aplica imediatamente no load para evitar flash
if (typeof document !== "undefined") {
  applyThemeMode(activeMode);
}

/**
 * Proxy estável: imports existentes de `C` leem a paleta ativa.
 * Componentes precisam re-renderizar (via ThemeProvider / key) para refletir no DOM.
 */
export const C = new Proxy(
  {},
  {
    get(_, prop) {
      if (prop === Symbol.toStringTag) return "ThemeColors";
      return activePalette[prop];
    },
    ownKeys() {
      return Reflect.ownKeys(activePalette);
    },
    getOwnPropertyDescriptor(_, prop) {
      return {
        configurable: true,
        enumerable: true,
        value: activePalette[prop],
      };
    },
    has(_, prop) {
      return prop in activePalette;
    },
  }
);
