const DEFAULT_LANG = "en";

// Trad Cache
const translations = {};

// Load .lang + convert to dictionnary
async function loadLangFile(lang) {
  const res = await fetch(`./locales/${lang}.lang`);
  if (!res.ok) return null;

  const text = await res.text();
  const dict = {};

  text.split("\n").forEach((line) => {
    line = line.trim();
    if (!line || line.startsWith("#")) return;

    const [key, ...rest] = line.split("=");
    dict[key.trim()] = rest.join("=").trim();
  });

  return dict;
}

// Default load + fallback
async function loadLanguage(lang) {
  const main = await loadLangFile(lang);
  // Fallback
  const fallback =
    lang !== DEFAULT_LANG ? await loadLangFile(DEFAULT_LANG) : {};
  // Fusion
  translations.current = { ...fallback, ...main };

  applyTranslations();
}
// DOM trads
export function applyTranslations() {
  const dict = translations.current;

  // Texts
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  // Placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });
}

// Lang etect
function detectBrowserLang() {
  return navigator.language?.split("-")[0] || DEFAULT_LANG;
}

// Initialise
export const i18nReady = loadLanguage(detectBrowserLang());
