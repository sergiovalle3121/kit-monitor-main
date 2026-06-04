import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ChatWidget } from "@/components/ChatWidget";
import { TCodePalette } from "@/components/TCodePalette";

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
            {children}
            <ChatWidget />
            <TCodePalette />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
