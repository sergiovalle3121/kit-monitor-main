"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

type TenantBranding = {
  brandPrimary?: string;
  brandLogo?: string;
  borderRadiusCustom?: string;
};

/** Preferencia de apariencia elegida por el usuario. */
export type ColorScheme = "light" | "dark" | "system";
/** Esquema efectivamente aplicado (tras resolver "system"). */
export type ResolvedScheme = "light" | "dark";

type ThemeContextValue = {
  branding: Required<TenantBranding>;
  isPending: boolean;
  applyBranding: (nextBranding: TenantBranding) => void;
  /** Preferencia cruda: light | dark | system. */
  colorScheme: ColorScheme;
  /** Esquema aplicado (system ya resuelto a light/dark). */
  resolvedScheme: ResolvedScheme;
  /** Fija la preferencia (persiste en localStorage). */
  setColorScheme: (next: ColorScheme) => void;
  /** Alterna claro ↔ oscuro de forma explícita (ignora "system"). */
  toggleTheme: () => void;
};

const defaultBranding: Required<TenantBranding> = {
  // Default = acento índigo de la app (NO el cyan neón previo). El tenant lo
  // sobrescribe vía /tenant/branding para el white-label.
  brandPrimary: "#6366f1",
  brandLogo: "",
  borderRadiusCustom: "1rem",
};

/** Clave de persistencia (mismo patrón que WorkspaceContext → `axos_*`). */
const THEME_STORAGE_KEY = "axos_theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function writeBrandingVariables(branding: Required<TenantBranding>) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.brandPrimary);
  root.style.setProperty(
    "--brand-logo",
    branding.brandLogo ? `url("${branding.brandLogo}")` : "none",
  );
  root.style.setProperty("--border-radius-custom", branding.borderRadiusCustom);
}

function systemPrefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Lee la preferencia guardada (con guard SSR + try/catch, igual que el resto
 *  de preferencias de la app). Por defecto "system". */
function readStoredScheme(): ColorScheme {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {
    /* almacenamiento no disponible */
  }
  return "system";
}

function resolveScheme(scheme: ColorScheme): ResolvedScheme {
  if (scheme === "system") return systemPrefersDark() ? "dark" : "light";
  return scheme;
}

/** Aplica/retira la clase `.dark` en <html> — única fuente de verdad para todas
 *  las utilidades `dark:` y los estilos `.dark .glass` / `.dark .aurora-bg`. */
function applyResolvedScheme(resolved: ResolvedScheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  // Pista para los controles nativos (scrollbars, inputs) del navegador.
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] =
    useState<Required<TenantBranding>>(defaultBranding);
  const [isPending, startTransition] = useTransition();

  // Inicializa desde localStorage en el primer render del cliente (lazy).
  const [colorScheme, setColorSchemeState] =
    useState<ColorScheme>(readStoredScheme);
  const [resolvedScheme, setResolvedScheme] = useState<ResolvedScheme>(() =>
    resolveScheme(readStoredScheme()),
  );

  const applyBranding = useCallback((nextBranding: TenantBranding) => {
    startTransition(() => {
      setBranding({
        brandPrimary: nextBranding.brandPrimary ?? defaultBranding.brandPrimary,
        brandLogo: nextBranding.brandLogo ?? defaultBranding.brandLogo,
        borderRadiusCustom:
          nextBranding.borderRadiusCustom ??
          defaultBranding.borderRadiusCustom,
      });
    });
  }, []);

  const setColorScheme = useCallback((next: ColorScheme) => {
    setColorSchemeState(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* persistencia best-effort */
    }
    const resolved = resolveScheme(next);
    setResolvedScheme(resolved);
    applyResolvedScheme(resolved);
  }, []);

  const toggleTheme = useCallback(() => {
    // Alterna de forma explícita respecto a lo que se ve ahora.
    setColorScheme(resolvedScheme === "dark" ? "light" : "dark");
  }, [resolvedScheme, setColorScheme]);

  // Aplica la clase `.dark` al montar y cuando cambia la preferencia. No toca
  // estado aquí: `resolvedScheme` ya lo mantienen `setColorScheme` y el
  // listener del sistema; este efecto sólo sincroniza el DOM (idempotente).
  useEffect(() => {
    applyResolvedScheme(resolveScheme(colorScheme));
  }, [colorScheme]);

  // En modo "system", reacciona a los cambios de preferencia del SO en vivo.
  useEffect(() => {
    if (colorScheme !== "system") return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved: ResolvedScheme = mq.matches ? "dark" : "light";
      setResolvedScheme(resolved);
      applyResolvedScheme(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [colorScheme]);

  useEffect(() => {
    writeBrandingVariables(branding);
  }, [branding]);

  useEffect(() => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL;
    const endpoint = apiBase
      ? `${apiBase.replace(/\/$/, "")}/tenant/branding`
      : "/api/tenant/branding";

    let cancelled = false;

    fetch(endpoint, { credentials: "include" })
      .then((response) => (response.ok ? response.json() : null))
      .then((tenant: { branding?: TenantBranding } | null) => {
        if (!cancelled && tenant?.branding) applyBranding(tenant.branding);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [applyBranding]);

  useEffect(() => {
    const updateGlassOpacity = () => {
      const scrollFactor = Math.min(window.scrollY / 720, 1);
      const opacity = 0.34 + scrollFactor * 0.22;
      document.documentElement.style.setProperty(
        "--glass-opacity",
        opacity.toFixed(3),
      );
    };

    updateGlassOpacity();
    window.addEventListener("scroll", updateGlassOpacity, { passive: true });
    return () => window.removeEventListener("scroll", updateGlassOpacity);
  }, []);

  const value = useMemo(
    () => ({
      branding,
      isPending,
      applyBranding,
      colorScheme,
      resolvedScheme,
      setColorScheme,
      toggleTheme,
    }),
    [
      applyBranding,
      branding,
      isPending,
      colorScheme,
      resolvedScheme,
      setColorScheme,
      toggleTheme,
    ],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
