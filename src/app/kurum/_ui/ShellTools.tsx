import QuickAdd from "./QuickAdd";
import Search from "./Search";

/** Kenar çubuğunun üstü: "+ Ekle" ve arama (⌘K). */
export function SidebarTools() {
  return (
    <div className="space-y-2">
      <QuickAdd />
      <Search />
    </div>
  );
}

/** Telefon üst çubuğu: arama ve "+" simgeleri. */
export function BarTools() {
  return (
    <span className="flex items-center">
      <Search compact />
      <QuickAdd compact />
    </span>
  );
}
