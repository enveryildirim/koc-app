/** Kurum modülleri için test verisi: sınıflar, öğrenciler, denemeler, ödevler, ders programı ve yoklama. */
import { PrismaClient } from "@prisma/client";
import { EXAM_TYPES, gradeExam, LETTERS, randomKey, shuffleKey } from "../src/lib/exam";

const FIRST = [
  "Ahmet", "Ayşe", "Mehmet", "Zeynep", "Mustafa", "Elif", "Emre", "Esra", "Burak", "Merve", "Can", "Selin", "Kerem", "Nil",
  "Arda", "Defne", "Mert", "İrem", "Ozan", "Sude", "Yusuf", "Ecrin", "Ömer", "Azra", "Efe", "Duru", "Kaan", "Ela", "Alp", "Ceren",
];
const LAST = [
  "Yılmaz", "Kaya", "Demir", "Çelik", "Şahin", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç",
  "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Erdoğan", "Güneş", "Çakır",
];

const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setHours(10, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
};
const phone = () =>
  `05${30 + Math.floor(Math.random() * 30)} ${100 + Math.floor(Math.random() * 900)} ${10 + Math.floor(Math.random() * 90)} ${10 + Math.floor(Math.random() * 90)}`;

export async function seedKurum(prisma: PrismaClient, ownerId: string) {
  // Kurum tabloları kullanıcıya ilişkili olmadığından elle temizlenir
  await prisma.attendance.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.scheduleSlot.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.homeworkStatus.deleteMany();
  await prisma.homework.deleteMany();
  await prisma.examResult.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.student.deleteMany();
  await prisma.classroom.deleteMany();

  /* ----------------------------- Sınıflar & öğrenciler ----------------------------- */
  const classDefs = [
    { name: "8-A", level: "8" },
    { name: "8-B", level: "8" },
    { name: "12-A", level: "12" },
    { name: "12-B", level: "12" },
  ];
  const classes = [];
  let no = 1001;
  const used = new Set<string>();
  for (const c of classDefs) {
    const cls = await prisma.classroom.create({ data: { ownerId, ...c } });
    const count = 18 + Math.floor(Math.random() * 5);
    const rows = [];
    for (let i = 0; i < count; i++) {
      let fn: string, ln: string;
      do {
        fn = pick(FIRST);
        ln = pick(LAST);
      } while (used.has(fn + ln));
      used.add(fn + ln);
      rows.push({
        ownerId,
        classroomId: cls.id,
        studentNo: String(no++),
        firstName: fn,
        lastName: ln,
        phone: phone(),
        parentName: `${pick(FIRST)} ${ln}`,
        parentPhone: phone(),
      });
    }
    await prisma.student.createMany({ data: rows });
    classes.push({ ...cls, students: await prisma.student.findMany({ where: { classroomId: cls.id } }) });
  }
  // STS: kurum dışından sınava giren birkaç öğrenci
  await prisma.student.createMany({
    data: Array.from({ length: 4 }, (_, i) => ({
      ownerId,
      studentNo: String(9001 + i),
      firstName: pick(FIRST),
      lastName: pick(LAST),
      external: true,
    })),
  });

  // Her öğrencinin ders bazında "yeteneği" (sınav sonuçlarını tutarlı kılmak için)
  const skill = new Map<string, number>();
  const baseSkill = new Map<string, number>();
  const sk = (studentId: string, section: string) => {
    if (!baseSkill.has(studentId)) baseSkill.set(studentId, 0.3 + Math.random() * 0.6);
    const k = studentId + section;
    if (!skill.has(k)) skill.set(k, Math.min(0.97, Math.max(0.1, baseSkill.get(studentId)! + (Math.random() - 0.5) * 0.3)));
    return skill.get(k)!;
  };

  /* ---------------------------------- Denemeler ---------------------------------- */
  const examDefs = [
    { name: "LGS Deneme 1", type: "LGS", level: "8", ago: 42 },
    { name: "LGS Deneme 2", type: "LGS", level: "8", ago: 28 },
    { name: "LGS Deneme 3", type: "LGS", level: "8", ago: 10 },
    { name: "TYT Deneme 1", type: "TYT", level: "12", ago: 35 },
    { name: "TYT Deneme 2", type: "TYT", level: "12", ago: 14 },
    { name: "AYT Sayısal Deneme 1", type: "AYT", level: "12", ago: 7 },
  ];
  for (const [ei, e] of examDefs.entries()) {
    const t = EXAM_TYPES[e.type];
    const sections = t.sections.map((s, si) => {
      const keyA = randomKey(s.count, t.choices);
      return { name: s.name, count: s.count, keyA, keyB: shuffleKey(keyA, 7 + ei * 13 + si) };
    });
    const exam = await prisma.exam.create({
      data: { ownerId, name: e.name, type: e.type, date: daysAgo(e.ago), sections: JSON.stringify(sections), wrongPer: t.wrongPer },
    });
    const takers = classes.filter((c) => c.level === e.level).flatMap((c) => c.students);
    const rows = [];
    for (const st of takers) {
      if (Math.random() < 0.06) continue; // sınava girmeyen
      const booklet = Math.random() < 0.5 ? "A" : "B";
      let answers = "";
      for (const s of sections) {
        const key = booklet === "B" ? s.keyB : s.keyA;
        const p = sk(st.id, s.name) + (ei % 3) * 0.03; // denemeler ilerledikçe hafif gelişim
        for (let i = 0; i < s.count; i++) {
          if (Math.random() < 0.12 * (1 - p)) answers += " ";
          else if (Math.random() < p) answers += key[i];
          else answers += LETTERS[Math.floor(Math.random() * t.choices)];
        }
      }
      const g = gradeExam(sections, answers, booklet, t.wrongPer);
      rows.push({
        examId: exam.id,
        studentId: st.id,
        booklet,
        answers,
        stats: JSON.stringify(g.stats),
        totalNet: g.totalNet,
        source: pick(["OMR", "OMR", "TXT"]),
      });
    }
    await prisma.examResult.createMany({ data: rows });
  }

  /* ----------------------------------- Ödevler ----------------------------------- */
  const hwDefs: Record<string, [string, string][]> = {
    "8": [
      ["Matematik", "Üslü ifadeler – 40 soru"],
      ["Türkçe", "Paragraf testi 1-3"],
      ["Fen Bilimleri", "DNA ve genetik kod – konu özeti"],
      ["İngilizce", "Unit 4 kelime çalışması"],
      ["Matematik", "Kareköklü ifadeler – 30 soru"],
    ],
    "12": [
      ["Temel Matematik", "Problemler fasikülü 1"],
      ["Türkçe", "Dil bilgisi – 50 soru"],
      ["Fizik", "Kuvvet ve hareket – test 4"],
      ["Kimya", "Mol kavramı tekrar"],
      ["Biyoloji", "Hücre bölünmeleri özet çıkarma"],
    ],
  };
  for (const c of classes) {
    for (const [i, [subject, title]] of hwDefs[c.level].entries()) {
      const assignedAgo = 24 - i * 6;
      const due = daysAgo(assignedAgo - 5);
      const hw = await prisma.homework.create({
        data: {
          ownerId,
          classroomId: c.id,
          subject,
          title,
          description: "Kitaptaki ilgili bölümleri çözüp bir sonraki derse getiriniz.",
          assignedAt: daysAgo(assignedAgo),
          dueDate: due,
        },
      });
      const past = due < new Date();
      await prisma.homeworkStatus.createMany({
        data: c.students.map((st) => {
          const p = baseSkill.get(st.id) ?? 0.6;
          const r = Math.random();
          const status = !past ? "PENDING" : r < p * 0.9 ? "DONE" : r < p * 0.9 + 0.12 ? "PARTIAL" : "NOT_DONE";
          return { homeworkId: hw.id, studentId: st.id, status };
        }),
      });
    }
  }

  /* ---------------------------- Öğretmenler & program ---------------------------- */
  const teacherDefs = [
    ["Hülya Aksoy", "Türkçe"],
    ["Serkan Yalçın", "Matematik"],
    ["Derya Kurt", "Fen Bilimleri"],
    ["Okan Er", "Sosyal Bilgiler"],
    ["Jale Tunç", "İngilizce"],
    ["Murat Sezer", "Fizik"],
    ["Pınar Ateş", "Kimya"],
    ["Levent Çınar", "Biyoloji"],
  ];
  const teachers: Record<string, string> = {};
  for (const [name, branch] of teacherDefs) {
    const t = await prisma.teacher.create({ data: { ownerId, name, branch } });
    teachers[branch] = t.id;
  }
  const plan: Record<string, [string, string][]> = {
    "8": [["Türkçe", "Türkçe"], ["Matematik", "Matematik"], ["Fen Bilimleri", "Fen Bilimleri"], ["İnkılap Tarihi", "Sosyal Bilgiler"], ["İngilizce", "İngilizce"]],
    "12": [["Türkçe", "Türkçe"], ["Matematik", "Matematik"], ["Fizik", "Fizik"], ["Kimya", "Kimya"], ["Biyoloji", "Biyoloji"]],
  };
  const times = [["16:00", "16:40"], ["16:50", "17:30"], ["17:40", "18:20"]];
  for (const [ci, c] of classes.entries()) {
    const lessons = plan[c.level];
    const slots = [];
    for (let day = 1; day <= 5; day++) {
      for (let ti = 0; ti < 2; ti++) {
        const [subject, branch] = lessons[(day + ti + ci) % lessons.length];
        const [startTime, endTime] = times[(ti + ci) % 3];
        slots.push({ ownerId, classroomId: c.id, teacherId: teachers[branch], subject, lessonType: "GRUP", dayOfWeek: day, startTime, endTime });
      }
    }
    const [subject, branch] = lessons[ci % lessons.length];
    slots.push({ ownerId, classroomId: c.id, teacherId: teachers[branch], subject, lessonType: "ETUT", dayOfWeek: 6, startTime: "10:00", endTime: "11:30" });
    await prisma.scheduleSlot.createMany({ data: slots });
  }

  /* ------------------------- Son 3 haftanın yoklamaları ------------------------- */
  const allSlots = await prisma.scheduleSlot.findMany();
  const studentsByClass = new Map(classes.map((c) => [c.id, c.students]));
  const absentProne = new Set(
    classes
      .flatMap((c) => c.students)
      .filter(() => Math.random() < 0.12)
      .map((s) => s.id),
  );
  for (let ago = 21; ago >= 1; ago--) {
    const d = daysAgo(ago);
    const dow = ((d.getDay() + 6) % 7) + 1;
    for (const slot of allSlots.filter((s) => s.dayOfWeek === dow)) {
      const session = await prisma.lessonSession.create({
        data: {
          ownerId,
          slotId: slot.id,
          classroomId: slot.classroomId,
          teacherId: slot.teacherId,
          subject: slot.subject,
          lessonType: slot.lessonType,
          date: ymd(d),
          startTime: slot.startTime,
          endTime: slot.endTime,
        },
      });
      await prisma.attendance.createMany({
        data: studentsByClass.get(slot.classroomId)!.map((st) => {
          const r = Math.random();
          const absentP = absentProne.has(st.id) ? 0.25 : 0.04;
          const status = r < absentP ? "ABSENT" : r < absentP + 0.04 ? "LATE" : r < absentP + 0.06 ? "EXCUSED" : "PRESENT";
          return { sessionId: session.id, studentId: st.id, status };
        }),
      });
    }
  }
}
