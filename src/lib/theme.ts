"use client";

// El script de `layout.tsx` fija `data-theme` en <html> antes del primer
// pintado. Ese atributo es la única fuente de verdad del tema: aquí se expone
// a React con useSyncExternalStore (sin setState dentro de efectos).

export type Theme = "dark" | "light";

export function getTheme(): Theme {
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}

export function getServerTheme(): Theme {
  return "dark";
}

export function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("fw-theme", theme);
  } catch {
    /* sin almacenamiento */
  }
}
