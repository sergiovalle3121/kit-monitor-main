import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getLocale, getMessages } from "next-intl/server";
import { I18nProvider } from "@/components/I18nProvider";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ConfirmProvider } from "@/components/ui/ConfirmDialog";
import { ChatWidget } from "@/components/ChatWidget";
import { Cide } from "@/components/Cide";
import { SearchPalette } from "@/components/SearchPalette";

export const metadata: Metadata = {
  title: {
    default: "AXOS OS",
    template: "%s · AXOS OS",
  },
  description: "Industrial operating system for multi-tenant ERP, MES and Control Tower",
  applicationName: "AXOS OS",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "AXOS OS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
};

/**
 * Anti-flash: fija la clase `.dark` en <html> ANTES del primer paint, leyendo
 * la preferencia guardada (`axos_theme`) o, en su defecto, la del sistema. Así
 * el modo correcto se aplica sin parpadeo y el ThemeContext sólo re-sincroniza.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem('axos_theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Idioma resuelto por next-intl desde la cookie (SSR-safe). Default = inglés.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale} messages={messages}>
          <ThemeProvider>
            <AuthProvider>
              <WorkspaceProvider>
                <ToastProvider>
                  <ConfirmProvider>
                    {children}
                    <ChatWidget />
                    <Cide />
                    <SearchPalette />
                  </ConfirmProvider>
                </ToastProvider>
              </WorkspaceProvider>
            </AuthProvider>
          </ThemeProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
