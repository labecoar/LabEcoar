export const heading = { fontFamily: "'Bricolage Grotesque', sans-serif" };
export const body = { fontFamily: "'DM Sans', sans-serif" };

/** Fundo suave a partir de hex (#RRGGBB) ou rgb/rgba — evita `${rgba(...)}18` inválido */
export function colorWithAlpha(color, alpha = 0.1) {
  const value = String(color || "").trim();
  if (!value) return `rgba(0,0,0,${alpha})`;

  if (value.startsWith("#")) {
    const hex = value.slice(1);
    const expand = (h) => h + h;
    const parse = (r, g, b) => `rgba(${r},${g},${b},${alpha})`;

    if (hex.length === 3) {
      return parse(
        parseInt(expand(hex[0]), 16),
        parseInt(expand(hex[1]), 16),
        parseInt(expand(hex[2]), 16),
      );
    }
    if (hex.length >= 6) {
      return parse(
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      );
    }
  }

  const rgbaMatch = value.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+)?\s*\)/,
  );
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]},${rgbaMatch[2]},${rgbaMatch[3]},${alpha})`;
  }

  return value;
}

/** Opacidade do branco de cards/superfícies no tema claro */
export const LIGHT_CARD_ALPHA = 0.6;

/** Branco semitransparente para cards no tema claro */
export const lightCardSurface = `rgba(255, 255, 255, ${LIGHT_CARD_ALPHA})`;

/** Branco sólido para modais no tema claro (fora do card 0.6) */
export const LIGHT_MODAL_BG = "#FFFFFF";

export function getModalBackground(isLight) {
  return isLight ? LIGHT_MODAL_BG : darkPalette.card;
}

/** Modo noturno (atual) */
export const darkPalette = {
  black: "#111110",
  darkGreen: "rgba(7, 38, 23, 1)",
  blue: "rgba(0, 0, 255, 1)",
  blue_back: "rgba(0, 0, 255, 0.1)",
  lime: "rgba(200, 255, 0, 1)",
  lime_back: "rgba(200, 255, 0, 0.08)",
  cream: "#f4f6f5",
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
  border: "rgba(var(--ink), 0.08)",
  borderStrong: "rgba(var(--ink), 0.15)",
  overlay: "rgba(255, 255, 255, 0.05)",
};


/** Modo claro — referência Figma Make (creme quente, cards brancos, accent darkGreen) */
export const lightPalette = {
  black: "#FFFFDE",
  darkGreen: "#072617",
  blue: "#0000FF",
  blue_back: "rgba(0, 0, 255, 0.08)",
  lime: "#C8FF00",
  lime_back: "rgba(200, 255, 0, 0.13)",
  cream: "#1D1D1B",
  onAccent: "#1D1D1B",
  onSurface: "#FFFFDE",
  red: "rgba(190, 20, 20, 1)",
  red_back: "rgba(190, 20, 20, 0.09)",
  orange: "#FF4500",
  orange_back: "rgba(255, 69, 0, 0.13)",
  pink: "rgba(185, 40, 140, 1)",
  purple: "rgba(115, 65, 200, 1)",
  cyan: "rgba(0, 130, 175, 1)",
  black_back: "#F5F5D8",
  black_light: "#EEEECC",
  card: lightCardSurface,
  notification_background: "rgba(130, 175, 0, 0.09)",
  border: "rgba(29, 29, 27, 0.15)",
  borderStrong: "rgba(29, 29, 27, 0.2)",
  overlay: "rgba(0, 0, 0, 0.05)",
};

/** Tokens semânticos — escuro espelha o comportamento atual; claro segue Figma Make */
export function getThemeTokens(isLight) {
  if (!isLight) {
    return {
      bg: darkPalette.black,
      card: darkPalette.card,
      cardDeep: darkPalette.black_back,
      surface: darkPalette.black_light,
      text: darkPalette.cream,
      textSub: `${darkPalette.cream}60`,
      textMuted: `${darkPalette.cream}40`,
      textFaint: `${darkPalette.cream}28`,
      border: "rgba(var(--ink),0.07)",
      borderMid: "rgba(var(--ink),0.05)",
      topbar: `${darkPalette.black}F5`,
      topbarBdr: "rgba(var(--ink),0.05)",
      progressBg: "rgba(var(--ink),0.07)",
      itemBg: "rgba(var(--ink),0.06)",
      accent: darkPalette.lime,
      textOnColor: darkPalette.cream,
    };
  }

  return {
    bg: lightPalette.black,
    card: lightPalette.card,
    cardDeep: lightPalette.black_back,
    surface: lightPalette.black_light,
    text: lightPalette.cream,
    textSub: "#3A3A38",
    textMuted: "#5A5A58",
    textFaint: "#8A8A88",
    border: lightPalette.border,
    borderMid: "rgba(29,29,27,0.08)",
    topbar: lightPalette.black,
    topbarBdr: "rgba(29,29,27,0.14)",
    progressBg: "rgba(29,29,27,0.09)",
    itemBg: "rgba(29,29,27,0.05)",
    accent: lightPalette.darkGreen,
    textOnColor: lightPalette.onSurface,
  };
}

/** Cores fixas da tela de login — não segue o toggle claro/escuro do app */
export const loginColors = darkPalette;

export const THEME_STORAGE_KEY = "labecoar-theme";
export const THEME_USER_CHOICE_KEY = "labecoar-theme-user-choice";

const listeners = new Set();

/** Preferência explícita do usuário (null = nunca escolheu no toggle) */
function readStoredPreference() {
  try {
    const userChose = localStorage.getItem(THEME_USER_CHOICE_KEY) === "1";
    if (!userChose) return null;

    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* ignore */
  }
  return null;
}

/** Tema do SO/navegador — usado só na primeira visita */
export function getSystemThemeMode() {
  if (typeof window === "undefined") return "dark";
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

let activeMode = "dark";
let activePalette = darkPalette;

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

export function applyThemeMode(mode, { persist = true } = {}) {
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

  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, activeMode);
      localStorage.setItem(THEME_USER_CHOICE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  notifyThemeListeners();
  return activePalette;
}

// Aplica imediatamente no load para evitar flash
if (typeof document !== "undefined") {
  const stored = readStoredPreference();
  applyThemeMode(stored ?? getSystemThemeMode(), { persist: Boolean(stored) });
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
