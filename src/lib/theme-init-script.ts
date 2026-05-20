import { THEME_STORAGE_KEY } from "@/lib/theme";

/** Inline script for root layout <head> — avoids React 19 client <script> warning. */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var key = ${JSON.stringify(THEME_STORAGE_KEY)};
    var mode = localStorage.getItem(key);
    var dark =
      mode === "dark" ||
      (mode !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    if (dark) root.classList.add("dark");
    else root.classList.remove("dark");
    root.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`.trim();
