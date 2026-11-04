/** Risk bayrakları ve eşikleri — istemci + sunucu güvenli. */

export const RISK_FLAGS = {
  NET_DROP: { label: "Net düşüşü", weight: 2, cls: "bg-red-50 text-red-700" },
  MISSED_EXAM: { label: "Son denemeye girmedi", weight: 1, cls: "bg-violet-50 text-violet-700" },
  ATTENDANCE: { label: "Devam düşük", weight: 2, cls: "bg-orange-50 text-orange-700" },
  HOMEWORK: { label: "Ödev yapmıyor", weight: 1, cls: "bg-amber-50 text-amber-800" },
} as const;
export type RiskFlag = keyof typeof RISK_FLAGS;

export const RISK_RULES = {
  netDropAbs: 5,
  netDropRel: 0.1,
  attendanceMin: 85,
  homeworkMin: 60,
  days: 30,
};
