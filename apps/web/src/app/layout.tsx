import type { Metadata, Viewport } from "next";
import "./globals.css";
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
  description: "Sistema operativo industrial para ERP, MES y Control Tower multi-tenant",
  applicationName: "AXOS OS",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "AXOS OS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
};

/**
 * Anti-flash: fija la clase `.dark` en <html> ANTES del primer paint, leyendo
 * la preferencia guardada (`axos_theme`) o, en su defecto, la del sistema. Así
 * el modo correcto se aplica sin parpadeo y el ThemeContext sólo re-sincroniza.
 */
const themeInitScript = `(function(){try{var s=localStorage.getItem('axos_theme');var d=s==='dark'||((!s||s==='system')&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es-MX" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full flex flex-col">
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
      </body>
    </html>
  );
}
