import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "SınavKur – Online sınav ve test oluşturma",
  description: "Dakikalar içinde online sınav hazırlayın, paylaşın, otomatik puanlayın ve optik formları tarayın.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="antialiased min-h-screen flex flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <footer className="no-print border-t border-slate-200 py-6 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} SınavKur · Demo uygulama
        </footer>
      </body>
    </html>
  );
}
