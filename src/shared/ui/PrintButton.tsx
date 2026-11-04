"use client";
export default function PrintButton({ label = "Yazdır" }: { label?: string }) {
  return <button className="btn-secondary" onClick={() => window.print()}>{label}</button>;
}
