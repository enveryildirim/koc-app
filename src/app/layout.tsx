import type { Metadata } from "next";
import { Instrument_Sans, Lexend } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import SiteHeader from "@/shared/ui/SiteHeader";
import { THEME_SCRIPT } from "@/shared/ui/ThemeToggle";

const body = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const head = Instrument_Sans({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-head", display: "swap" });

export const metadata: Metadata = {
  title: "SınavKur – Kurum için deneme, takip ve soru havuzu",
  description: "Deneme sınavları, optik okuma, karneler, soru havuzu, ödev ve yoklama takibi tek yerde.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  // Veli ve çözüm sayfaları kurum markasıyla, site menüsü olmadan; kurum paneli kendi kenar çubuğuyla gösterilir.
  const bare = path.startsWith("/veli/") || path.startsWith("/cozum/") || path === "/kurum" || path.startsWith("/kurum/") || path === "/ogretmen" || path.startsWith("/ogretmen/");
  return (
    <html lang="tr" className={`${body.variable} ${head.variable}`} suppressHydrationWarning>
      <head>
        {/* Tema ilk boyamadan önce kurulur (yanıp sönmesin); data-theme bu yüzden sunucu HTML'inden farklıdır. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-screen flex-col antialiased">
        {!bare && <SiteHeader />}
        <main className="flex-1">{children}</main>
        {!bare && (
          <footer className="no-print border-t border-rule py-6 text-center text-sm text-lead">
            SınavKur, {new Date().getFullYear()}
          </footer>
        )}
      </body>
    </html>
  );
}
