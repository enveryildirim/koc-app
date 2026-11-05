import type { Metadata } from "next";
import { Instrument_Sans, Lexend } from "next/font/google";
import "./globals.css";
import { headers } from "next/headers";
import SiteHeader from "@/shared/ui/SiteHeader";

const body = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-body", display: "swap" });
const head = Instrument_Sans({ subsets: ["latin", "latin-ext"], axes: ["wdth"], variable: "--font-head", display: "swap" });

export const metadata: Metadata = {
  title: "SınavKur – Online sınav ve test oluşturma",
  description: "Dakikalar içinde online sınav hazırlayın, paylaşın, otomatik puanlayın ve optik formları tarayın.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const path = (await headers()).get("x-pathname") ?? "";
  // Veli sayfası kurum markasıyla, site menüsü olmadan; kurum paneli (online testler dahil) kendi kenar çubuğuyla gösterilir.
  const bare = path.startsWith("/veli/") || path === "/kurum" || path.startsWith("/kurum/") || path === "/panel" || path.startsWith("/sinav/");
  return (
    <html lang="tr" className={`${body.variable} ${head.variable}`}>
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
