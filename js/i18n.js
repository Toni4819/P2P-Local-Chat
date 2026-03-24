export const DEFAULT_LANG = "en";

export const translations = {};

export async function loadLangFile(lang) {
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

export async function loadLanguage(lang) {
  const main = await loadLangFile(lang);
  const fallback =
    lang !== DEFAULT_LANG ? await loadLangFile(DEFAULT_LANG) : {};
  translations.current = { ...fallback, ...main };

  applyTranslations();
}

export function applyTranslations() {
  const dict = translations.current;
  if (!dict) return;

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (dict[key]) el.placeholder = dict[key];
  });
}

function detectBrowserLang() {
  return navigator.language?.split("-")[0] || DEFAULT_LANG;
}

export const i18nReady = loadLanguage(detectBrowserLang());
