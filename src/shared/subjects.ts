/** Ders adı eşleştirme: deneme bölüm adı ↔ programdaki / plandaki ders adı (istemci + sunucu güvenli). */

const ALIASES: Record<string, string> = {
  "temel matematik": "matematik",
  "t.c. inkılap tarihi": "inkılap tarihi",
  "tc inkılap tarihi": "inkılap tarihi",
  "t.c. inkılap tarihi ve atatürkçülük": "inkılap tarihi",
  "inkılap tarihi ve atatürkçülük": "inkılap tarihi",
  "din kültürü ve ahlak bilgisi": "din kültürü",
  "ingilizce": "ingilizce",
  "yabancı dil": "ingilizce",
};

export function normSubject(s: string) {
  const n = s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
  return ALIASES[n] ?? n.replace(/\./g, "").trim();
}

export function subjectMatches(section: string, subject: string) {
  const a = normSubject(section);
  const b = normSubject(subject);
  return a === b || a.includes(b) || b.includes(a);
}
