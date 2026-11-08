import Search from "./Search";

/**
 * Kenar çubuğunun üstü: arama (⌘K). Hızlı "+ Ekle" düğmesi kaldırıldı (sınıf / öğretmen / ders
 * nadiren eklenir; Yönetim sayfalarında formları var). Geri gerekirse: commit 2dc619c, QuickAdd.tsx.
 */
export function SidebarTools() {
  return <Search />;
}

/** Telefon üst çubuğu: arama simgesi. */
export function BarTools() {
  return <Search compact />;
}
