/** Türkiye cep numarasını WhatsApp biçimine çevirir (905xxxxxxxxx). Geçersizse null. */
export function waPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (/^05\d{9}$/.test(d)) return "9" + d;
  if (/^5\d{9}$/.test(d)) return "90" + d;
  if (/^905\d{9}$/.test(d)) return d;
  return null;
}
