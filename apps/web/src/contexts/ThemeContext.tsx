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

type ThemeContextValue = {
  branding: Required<TenantBranding>;
  isPending: boolean;
  applyBranding: (nextBranding: TenantBranding) => void;
};

const defaultBranding: Required<TenantBranding> = {
  brandPrimary: "#00F2EA",
  brandLogo: "",
  borderRadiusCustom: "1rem",
};

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

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] =
    useState<Required<TenantBranding>>(defaultBranding);
  const [isPending, startTransition] = useTransition();

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
    () => ({ branding, isPending, applyBranding }),
    [applyBranding, branding, isPending],
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
