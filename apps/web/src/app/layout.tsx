import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { ChatWidget } from "@/components/ChatWidget";
import { AiCopilot } from "@/components/AiCopilot";
import { SearchPalette } from "@/components/SearchPalette";

export const metadata: Metadata = {
  title: "AXOS OS",
  description: "White-label manufacturing operations platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <WorkspaceProvider>
              <ToastProvider>
                {children}
                <ChatWidget />
                <AiCopilot />
                <SearchPalette />
              </ToastProvider>
            </WorkspaceProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
