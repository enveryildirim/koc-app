/** Kurum modülleri için test verisi: sınıflar, öğrenciler, denemeler, ödevler, ders programı ve yoklama. */
import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import { EXAM_TYPES, gradeExam, LETTERS, makeBooklet, randomKey, resolveScoring } from "../src/modules/exams/domain";
import { nationalHolidays, schoolYearOf } from "../src/modules/planning/calendar";
import { defaultPlanStart, layoutPlan, mondayOf, parsePlan } from "../src/modules/planning/plan";
import { addDays } from "../src/shared/date";
import { SAMPLE_CURRICULUM } from "../src/modules/curriculum/sample";

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
  await prisma.setting.deleteMany();
  await prisma.parentDispatch.deleteMany();
  await prisma.curriculumTopic.deleteMany();
  await prisma.lessonPlan.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.lessonSession.deleteMany();
  await prisma.scheduleSlot.deleteMany();
  await prisma.course.deleteMany();
  await prisma.classMember.deleteMany();
  await prisma.accessLink.deleteMany();
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
  // Başarı Skoru demosu: her sınıftan iki öğrenci son 3 haftada düşüşe geçer (net, devam, ödev birlikte).
  // Önceden ortanın üstünde oldukları için 4 hafta önceki skorları "iyi" ya da "izlenmeli" çıkar.
  const decliners = new Set(classes.flatMap((c) => [...c.students].sort(() => Math.random() - 0.5).slice(0, 2).map((st) => st.id)));
  for (const id of decliners) baseSkill.set(id, 0.62 + Math.random() * 0.15);
  const DECLINE_DAYS = 18;
  const sk = (studentId: string, section: string) => {
    if (!baseSkill.has(studentId)) baseSkill.set(studentId, 0.3 + Math.random() * 0.6);
    const k = studentId + section;
    if (!skill.has(k)) skill.set(k, Math.min(0.97, Math.max(0.1, baseSkill.get(studentId)! + (Math.random() - 0.5) * 0.3)));
    return skill.get(k)!;
  };

  /* ---------------------------------- Denemeler ---------------------------------- */
  // Bölüm başına konu (kazanım) listesi; sorulara sırayla blok blok dağıtılır.
  const TOPICS: Record<string, string[]> = {
    "Türkçe": ["Sözcükte anlam", "Cümlede anlam", "Paragraf", "Yazım ve noktalama", "Fiilimsiler", "Cümle türleri"],
    "Matematik": ["Çarpanlar ve katlar", "Üslü ifadeler", "Kareköklü ifadeler", "Veri analizi", "Olasılık", "Cebirsel ifadeler", "Doğrusal denklemler"],
    "Fen Bilimleri": ["Mevsimler ve iklim", "DNA ve genetik kod", "Basınç", "Madde ve endüstri", "Basit makineler"],
    "T.C. İnkılap Tarihi": ["Bir kahraman doğuyor", "Milli uyanış", "Ya istiklal ya ölüm"],
    "Din Kültürü": ["Kader inancı", "Zekât ve sadaka", "Din ve hayat"],
    "İngilizce": ["Friendship", "Teen life", "In the kitchen", "On the phone"],
    "Sosyal Bilimler": ["Tarih", "Coğrafya", "Felsefe", "Din kültürü"],
    "Temel Matematik": ["Temel kavramlar", "Sayı basamakları", "Bölme-bölünebilme", "Rasyonel sayılar", "Problemler", "Fonksiyonlar", "Geometri"],
    "Fizik": ["Kuvvet ve hareket", "Elektrik", "Dalgalar", "Optik"],
    "Kimya": ["Mol kavramı", "Kimyasal tepkimeler", "Asit-baz"],
    "Biyoloji": ["Hücre bölünmeleri", "Kalıtım", "Ekoloji"],
    "Genel": ["Genel"],
  };
  const topicsFor = (name: string, count: number) => {
    const list = TOPICS[name] ?? ["Genel"];
    return Array.from({ length: count }, (_, i) => list[Math.floor((i * list.length) / count)]);
  };
  // Konu bazında zorluk: bazı konular kurum genelinde zayıf olsun
  const topicDifficulty = new Map<string, number>();
  const diff = (topic: string) => {
    if (!topicDifficulty.has(topic)) topicDifficulty.set(topic, (Math.random() - 0.5) * 0.4);
    return topicDifficulty.get(topic)!;
  };
  // Bilişsel düzey: soru sırasına göre sabit bir desen; düzey zorluğu etkiler (bilgi kolay, analiz zor).
  const LEVEL_PATTERN = ["Bilgi", "Kavrama", "Bilgi", "Uygulama", "Kavrama", "Uygulama", "Analiz", "Kavrama", "Uygulama", "Analiz"];
  const LEVEL_SHIFT: Record<string, number> = { Bilgi: 0.12, Kavrama: 0.04, Uygulama: -0.06, Analiz: -0.16 };
  const levelsFor = (count: number) => Array.from({ length: count }, (_, i) => LEVEL_PATTERN[i % LEVEL_PATTERN.length]);
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
      const { key: keyB, order: bOrder } = makeBooklet(keyA, 7 + ei * 13 + si);
      return { name: s.name, count: s.count, keyA, keyB, bOrder, topics: topicsFor(s.name, s.count), levels: levelsFor(s.count) };
    });
    // Öğrenciler doğru anahtarla cevaplar; madde analizi demosu için LGS Deneme 3'te Matematik 5. sorunun
    // anahtarı kasıtlı olarak yanlış kaydedilir ("anahtar hatası olabilir" uyarısı).
    const truth = sections.map((s) => ({ keyA: s.keyA, keyB: s.keyB }));
    if (e.name === "LGS Deneme 3") {
      const s = sections[1];
      const wrong = LETTERS[(LETTERS.indexOf(s.keyA[4]) + 1) % t.choices];
      const j = s.bOrder.indexOf(4);
      s.keyA = s.keyA.slice(0, 4) + wrong + s.keyA.slice(5);
      s.keyB = s.keyB.slice(0, j) + wrong + s.keyB.slice(j + 1);
    }
    const scoring = resolveScoring(e.type, sections);
    const exam = await prisma.exam.create({
      data: { ownerId, name: e.name, type: e.type, date: daysAgo(e.ago), sections: JSON.stringify(sections), wrongPer: t.wrongPer },
    });
    const takers = classes.filter((c) => c.level === e.level).flatMap((c) => c.students);
    const rows = [];
    for (const st of takers) {
      if (Math.random() < 0.06) continue; // sınava girmeyen
      const booklet = Math.random() < 0.5 ? "A" : "B";
      let answers = "";
      for (const [si, s] of sections.entries()) {
        const key = booklet === "B" ? truth[si].keyB : truth[si].keyA;
        const drop = decliners.has(st.id) && e.ago <= DECLINE_DAYS ? 0.2 : 0;
        const base = sk(st.id, s.name) + (ei % 3) * 0.03 - drop; // denemeler ilerledikçe hafif gelişim
        for (let i = 0; i < s.count; i++) {
          const aIdx = booklet === "B" ? s.bOrder[i] : i;
          const topic = s.topics[aIdx];
          const p = Math.min(0.97, Math.max(0.05, base + diff(s.name + topic) + LEVEL_SHIFT[s.levels[aIdx]]));
          if (Math.random() < 0.12 * (1 - p)) answers += " ";
          else if (Math.random() < p) answers += key[i];
          else answers += LETTERS[Math.floor(Math.random() * t.choices)];
        }
      }
      const g = gradeExam(sections, answers, booklet, t.wrongPer, scoring);
      rows.push({
        examId: exam.id,
        studentId: st.id,
        booklet,
        answers,
        stats: JSON.stringify(g.stats),
        totalNet: g.totalNet,
        score: g.score,
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
      const assignedAgo = 36 - i * 9;
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
          // Çoğu öğrenci ödevini yapar; başarısı düşük olanlarda yapmama olasılığı artar
          const daysAgoDue = (Date.now() - due.getTime()) / 86400000;
          const done = decliners.has(st.id) && daysAgoDue <= DECLINE_DAYS ? 0.2 : 0.58 + p * 0.38;
          const status = !past ? "PENDING" : r < done ? "DONE" : r < done + 0.1 ? "PARTIAL" : "NOT_DONE";
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


  /* ------------------------------ Ders takip demosu ------------------------------ */
  // Genel ders yapısı: okul, mesleki, dini, hazırlık ve etüt dersleri; etüt mesulleri; başka sınıftan katılanlar.
  // Bütün adlar kurgusaldır.

  // Mevcut sınıfların dersleri programdan çıkarılır (12. sınıflar hazırlık)
  for (const c of classes) {
    const slots = await prisma.scheduleSlot.findMany({ where: { classroomId: c.id }, orderBy: { lessonType: "desc" } });
    const ids = new Map<string, string>();
    for (const sl of slots) {
      if (!ids.has(sl.subject)) {
        const course = await prisma.course.create({
          data: { ownerId, classroomId: c.id, name: sl.subject, kind: c.level === "12" ? "PREP" : "SCHOOL", teacherId: sl.teacherId },
        });
        ids.set(sl.subject, course.id);
      }
      await prisma.scheduleSlot.update({ where: { id: sl.id }, data: { courseId: ids.get(sl.subject) } });
    }
  }

  const mentorNames = ["Kemal Yurt", "Bekir Saran", "Tuncay Ilgaz", "Ercan Sevim", "Nihat Duru", "Hakan Toprak", "Orhan Bilge"];
  const mentor: Record<string, string> = {};
  for (const name of mentorNames) {
    const t = await prisma.teacher.create({ data: { ownerId, name, branch: "Etüt", role: "MENTOR" } });
    mentor[name] = t.id;
  }
  const staff: Record<string, string> = {};
  for (const [name, branch] of [
    ["Gökhan Ural", "Fizik"],
    ["Sevda Gül", "Coğrafya"],
    ["Aylin Tekin", "Biyoloji"],
    ["Selin Akar", "Bilişim"],
    ["Cem Oral", "Bilişim"],
    ["Mahmut Kara", "Din Eğitimi"],
    ["Yasin Er", "Din Eğitimi"],
  ]) {
    const t = await prisma.teacher.create({ data: { ownerId, name, branch } });
    staff[name] = t.id;
  }
  const mentorOf: Record<string, string> = { "8-A": "Kemal Yurt", "8-B": "Kemal Yurt", "12-A": "Bekir Saran", "12-B": "Tuncay Ilgaz" };
  for (const c of classes) await prisma.classroom.update({ where: { id: c.id }, data: { mentorId: mentor[mentorOf[c.name]] } });

  type CourseDef = { name: string; kind: string; teacher: string; weekly: number; external?: boolean };
  const newClassDefs: { name: string; level: string; mentor: string; size: number; courses: CourseDef[] }[] = [
    { name: "9-A", level: "9", mentor: "Ercan Sevim", size: 18, courses: [] },
    { name: "9-B", level: "9", mentor: "Nihat Duru", size: 17, courses: [] },
    { name: "10-A", level: "10", mentor: "Hakan Toprak", size: 16, courses: [] },
    { name: "11-A", level: "11", mentor: "Orhan Bilge", size: 15, courses: [] },
  ];
  const common = (m: string): CourseDef[] => [
    { name: "İslam Tarihi", kind: "RELIGIOUS", teacher: "Mahmut Kara", weekly: 2 },
    { name: "Etüt", kind: "STUDY", teacher: m, weekly: 4 },
    { name: "Matematik", kind: "SCHOOL", teacher: m, weekly: 0, external: true },
  ];
  newClassDefs[0].courses = [
    { name: "Fizik", kind: "SCHOOL", teacher: "Gökhan Ural", weekly: 2 },
    { name: "Coğrafya", kind: "SCHOOL", teacher: "Sevda Gül", weekly: 2 },
    { name: "Biyoloji", kind: "SCHOOL", teacher: "Aylin Tekin", weekly: 2 },
    { name: "Bilişim Teknolojileri", kind: "VOCATIONAL", teacher: "Selin Akar", weekly: 4 },
    ...common("Ercan Sevim"),
    { name: "Türkçe", kind: "SCHOOL", teacher: "Ercan Sevim", weekly: 0, external: true },
  ];
  newClassDefs[1].courses = [
    { name: "Fizik", kind: "SCHOOL", teacher: "Gökhan Ural", weekly: 2 },
    { name: "Coğrafya", kind: "SCHOOL", teacher: "Sevda Gül", weekly: 2 },
    { name: "Biyoloji", kind: "SCHOOL", teacher: "Aylin Tekin", weekly: 2 },
    { name: "Bilişim Teknolojileri", kind: "VOCATIONAL", teacher: "Selin Akar", weekly: 4 },
    ...common("Nihat Duru"),
    { name: "Türkçe", kind: "SCHOOL", teacher: "Nihat Duru", weekly: 0, external: true },
  ];
  newClassDefs[2].courses = [
    { name: "Fizik", kind: "SCHOOL", teacher: "Gökhan Ural", weekly: 2 },
    { name: "Coğrafya", kind: "SCHOOL", teacher: "Sevda Gül", weekly: 2 },
    { name: "Biyoloji", kind: "SCHOOL", teacher: "Aylin Tekin", weekly: 2 },
    { name: "Programlama", kind: "VOCATIONAL", teacher: "Selin Akar", weekly: 4 },
    ...common("Hakan Toprak"),
    { name: "Türkçe", kind: "SCHOOL", teacher: "Hakan Toprak", weekly: 0, external: true },
  ];
  newClassDefs[3].courses = [
    { name: "Web Tasarım", kind: "VOCATIONAL", teacher: "Cem Oral", weekly: 3 },
    { name: "Grafik", kind: "VOCATIONAL", teacher: "Cem Oral", weekly: 3 },
    { name: "Programlama", kind: "VOCATIONAL", teacher: "Selin Akar", weekly: 2 },
    { name: "Biyoloji", kind: "SCHOOL", teacher: "Aylin Tekin", weekly: 2 },
    ...common("Orhan Bilge"),
    { name: "Türk Dili ve Edebiyatı", kind: "SCHOOL", teacher: "Orhan Bilge", weekly: 0, external: true },
  ];
  const teacherId = (name: string) => mentor[name] ?? staff[name];

  // Hafta içi 4 ders saati; sınıf ve öğretmen çakışmadan, aynı ders aynı güne iki kez düşmeden yerleştirilir
  const PERIODS = [["14:40", "15:20"], ["15:30", "16:10"], ["16:40", "17:20"], ["17:30", "18:10"]];
  const teacherBusy = new Set<string>();
  const extraClasses: (typeof classes)[number][] = [];
  let extraNo = 2001;
  for (const [ci, def] of newClassDefs.entries()) {
    const cls = await prisma.classroom.create({ data: { ownerId, name: def.name, level: def.level, mentorId: mentor[def.mentor] } });
    const rows = [];
    for (let i = 0; i < def.size; i++) {
      let fn: string, ln: string;
      do {
        fn = pick(FIRST);
        ln = pick(LAST);
      } while (used.has(fn + ln));
      used.add(fn + ln);
      rows.push({ ownerId, classroomId: cls.id, studentNo: String(extraNo++), firstName: fn, lastName: ln, phone: phone(), parentName: `${pick(FIRST)} ${ln}`, parentPhone: phone() });
    }
    await prisma.student.createMany({ data: rows });
    extraClasses.push({ ...cls, students: await prisma.student.findMany({ where: { classroomId: cls.id } }) });

    const classBusy = new Set<string>();
    const slots = [];
    for (const cd of def.courses) {
      const course = await prisma.course.create({
        data: { ownerId, classroomId: cls.id, name: cd.name, kind: cd.kind, teacherId: teacherId(cd.teacher), external: cd.external ?? false },
      });
      const days = new Set<number>();
      for (let n = 0; n < cd.weekly; n++) {
        let placed = false;
        for (const sameDayOk of [false, true]) {
          for (let k = 0; k < 5 && !placed; k++) {
            const day = ((ci + n * 2 + k) % 5) + 1;
            if (!sameDayOk && days.has(day)) continue;
            for (let p = 0; p < PERIODS.length && !placed; p++) {
              const key = `${day}-${p}`;
              if (classBusy.has(key) || teacherBusy.has(`${cd.teacher}-${key}`)) continue;
              classBusy.add(key);
              teacherBusy.add(`${cd.teacher}-${key}`);
              days.add(day);
              slots.push({
                ownerId, classroomId: cls.id, teacherId: teacherId(cd.teacher), courseId: course.id, subject: cd.name,
                lessonType: cd.kind === "STUDY" ? "ETUT" : "GRUP", dayOfWeek: day, startTime: PERIODS[p][0], endTime: PERIODS[p][1],
              });
              placed = true;
            }
          }
          if (placed) break;
        }
      }
    }
    await prisma.scheduleSlot.createMany({ data: slots });
  }

  // Seviye-2: dini ders grubu. Öğrenciler ana sınıflarında (10-A, 11-A) kalır, buraya ek üye olarak katılır.
  const seviye = await prisma.classroom.create({ data: { ownerId, name: "SEVİYE-2", level: "Seviye-2", mentorId: mentor["Hakan Toprak"] } });
  const joiners = [...extraClasses[2].students.slice(0, 8), ...extraClasses[3].students.slice(0, 8)];
  await prisma.classMember.createMany({ data: joiners.map((st) => ({ ownerId, classroomId: seviye.id, studentId: st.id })) });
  const WEEKEND = [["09:00", "09:40"], ["09:50", "10:30"], ["10:40", "11:20"], ["11:30", "12:10"]];
  const seviyeCourses: [string, string][] = [["Kur'ân-ı Kerîm", "Mahmut Kara"], ["Tecvid", "Mahmut Kara"], ["İlmihal", "Yasin Er"], ["Kitâbet", "Yasin Er"]];
  const seviyeSlots = [];
  for (const [i, [name, t]] of seviyeCourses.entries()) {
    const course = await prisma.course.create({ data: { ownerId, classroomId: seviye.id, name, kind: "RELIGIOUS", teacherId: staff[t] } });
    for (const day of [6, 7]) {
      // Mahmut Kara ve Yasin Er aynı saatte iki derse girmesin diye sıralar kaydırılır
      const p = day === 6 ? i : (i + 2) % 4;
      seviyeSlots.push({ ownerId, classroomId: seviye.id, teacherId: staff[t], courseId: course.id, subject: name, lessonType: "GRUP", dayOfWeek: day, startTime: WEEKEND[p][0], endTime: WEEKEND[p][1] });
    }
  }
  await prisma.scheduleSlot.createMany({ data: seviyeSlots });
  extraClasses.push({ ...seviye, students: joiners });

  // Kişisel giriş linkleri: etüt mesulleri ve yeni öğretmenler (Ders programı → Öğretmenler'den kopyalanır)
  for (const [name, id] of [...Object.entries(mentor), ...Object.entries(staff)]) {
    await prisma.accessLink.create({
      data: { ownerId, teacherId: id, name, role: mentor[name] ? "MENTOR" : "TEACHER", token: randomBytes(18).toString("base64url") },
    });
  }
  // Eksik giriş örneği: bu öğretmenlerin son günlerdeki bazı derslerinin yoklaması alınmamış olsun
  const lateEntry = new Set([staff["Selin Akar"], staff["Mahmut Kara"], mentor["Ercan Sevim"]]);

  /* ------------------------- Son 7 haftanın yoklamaları ------------------------- */
  const allSlots = await prisma.scheduleSlot.findMany();
  const studentsByClass = new Map([...classes, ...extraClasses].map((c) => [c.id, c.students]));
  const absentProne = new Set(
    [...classes, ...extraClasses.slice(0, -1)]
      .flatMap((c) => c.students)
      .filter(() => Math.random() < 0.12)
      .map((s) => s.id),
  );
  for (let ago = 49; ago >= 1; ago--) {
    const d = daysAgo(ago);
    const dow = ((d.getDay() + 6) % 7) + 1;
    for (const slot of allSlots.filter((s) => s.dayOfWeek === dow)) {
      if (ago <= 5 && lateEntry.has(slot.teacherId) && Math.random() < 0.6) continue;
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
          const absentP = decliners.has(st.id) && ago <= DECLINE_DAYS ? 0.3 : absentProne.has(st.id) ? 0.25 : 0.04;
          const status = r < absentP ? "ABSENT" : r < absentP + 0.04 ? "LATE" : r < absentP + 0.06 ? "EXCUSED" : "PRESENT";
          return { sessionId: session.id, studentId: st.id, status };
        }),
      });
    }
  }

  /* ------------------------------ Veli karnesi ------------------------------ */
  // 8-A'nın ilk yarısına bağlantı paylaşılmış, bir kısmı veli tarafından açılmış olsun; birkaç öğrenciye görüş yazılsın.
  const notes = [
    "Derslere düzenli katılıyor, deneme netlerinde istikrarlı bir yükseliş var. Paragraf sorularında süre yönetimine çalışmasını öneriyoruz.",
    "Matematikte belirgin gelişme gösterdi. Ödevlerini zamanında teslim etmesi için evde takip etmenizi rica ederiz.",
    "Son haftalarda devamsızlığı arttı; kendisiyle görüştük. Ev ile iş birliği yaparak devamını sağlayalım.",
  ];
  const first = classes[0].students.slice(0, Math.ceil(classes[0].students.length / 2));
  for (const [i, st] of first.entries()) {
    const shared = new Date(Date.now() - (3 + i) * 3600000);
    await prisma.student.update({
      where: { id: st.id },
      data: {
        parentToken: randomBytes(18).toString("base64url"),
        parentSharedAt: shared,
        parentViewedAt: i % 3 === 0 ? null : new Date(shared.getTime() + 40 * 60000),
        parentNote: notes[i] ?? "",
      },
    });
  }
  // Haftalık veli raporu: 8-A'da geçen haftanın raporu ilk altı veliye WhatsApp ile gönderilmiş.
  const lastWeek = addDays(mondayOf(ymd(daysAgo(0))), -7);
  await prisma.parentDispatch.createMany({
    data: first.slice(0, 6).map((st, i) => ({
      ownerId,
      studentId: st.id,
      weekStart: lastWeek,
      channel: "WHATSAPP",
      // Bu haftanın Pazartesi sabahı gönderilmiş; velilerin bir kısmı bugün açmış (parentViewedAt).
      sentAt: new Date(`${addDays(lastWeek, 7)}T09:${String(10 + i * 3).padStart(2, "0")}:00`),
    })),
  });

  /* ---------------------------------- Takvim ---------------------------------- */
  const year = schoolYearOf(ymd(daysAgo(0)));
  const day = (n: number) => ymd(daysAgo(-n));
  const events = [
      ...nationalHolidays(year).map((h) => ({ ownerId, kind: "HOLIDAY", title: h.title, startDate: h.date, endDate: h.date, parentVisible: true })),
      { ownerId, kind: "MEETING", title: "Veli toplantısı", startDate: day(9), endDate: day(9), note: "18:30, konferans salonu", parentVisible: true },
      { ownerId, kind: "EXAM", title: "LGS kurum denemesi", startDate: day(16), endDate: day(16), classroomId: classes[0].id, parentVisible: true },
      { ownerId, kind: "EXAM", title: "LGS kurum denemesi", startDate: day(16), endDate: day(16), classroomId: classes[1].id, parentVisible: true },
      { ownerId, kind: "EVENT", title: "Üniversite tanıtım gezisi", startDate: day(23), endDate: day(23), classroomId: classes[2].id, parentVisible: true },
      { ownerId, kind: "HOLIDAY", title: "Ara tatil (örnek)", startDate: mondayOf(day(28)), endDate: addDays(mondayOf(day(28)), 4), parentVisible: true },
      { ownerId, kind: "MEETING", title: "Öğretmenler kurulu", startDate: day(2), endDate: day(2) },
  ];
  await prisma.calendarEvent.createMany({ data: events });

  /* ------------------------------ Yıllık ders planları ------------------------------ */
  const holidays = events.filter((e) => e.kind === "HOLIDAY" && !("classroomId" in e)).map((e) => ({ start: e.startDate, end: e.endDate }));
  const thisWeek = mondayOf(day(0));
  const byName = (n: string) => extraClasses.find((c) => c.name === n)!.id;
  const PLANS: { cls: number; classroomId?: string; subject: string; behind: number; source: string }[] = [
    {
      cls: -1,
      classroomId: byName("SEVİYE-2"),
      subject: "Tecvid",
      behind: 1,
      source: "Tecvidin tarifi, mevzuu ve gayesi\nKıraat imamı ve râvîsi\nMedd-i tabiî\nMedd-i muttasıl\nMedd-i munfasıl\nMedd-i lâzım\nMedd-i ârız\nGenel tekrar ve ara kontrol\nTenvin ve nûn-u sâkin: ihfâ\nİzhar\nİklâb\nİdğâm-ı mea'l-ğunne\nİdğâm-ı bilâ ğunne\nİdğâm-ı misleyn ve mütecâniseyn\nİdğâm-ı mütekâribeyn\nİdğâm-ı şemsiyye ve izhar-ı kameriyye\nKalkale\nHükmü'r-râ\nLafzatullah, zamir ve sekte\nGenel tekrar ve şifâhî imtihan | 2",
    },
    {
      cls: -1,
      classroomId: byName("9-A"),
      subject: "Bilişim Teknolojileri",
      behind: 0,
      source: "Bilgisayar sistemleri ve donanım | 2\nİşletim sistemleri | 2\nDosya yönetimi\nBilgi güvenliği ve dijital vatandaşlık | 2\nKelime işlemci | 2\nHesap tablosu | 3\nSunu hazırlama | 2\nAlgoritma ve akış şeması | 3\nBlok tabanlı programlama | 3\nProje haftası | 2",
    },
    {
      cls: -1,
      classroomId: byName("10-A"),
      subject: "Programlama",
      behind: 2,
      source: "Programlama ortamının kurulumu\nDeğişkenler ve veri türleri | 2\nOperatörler\nKoşul yapıları | 2\nDöngüler | 3\nDiziler | 2\nFonksiyonlar | 3\nNesne tabanlı programlamaya giriş | 3\nHata ayıklama\nDönem projesi | 3",
    },
    {
      cls: 0,
      subject: "Matematik",
      behind: 0,
      source: "Çarpanlar ve Katlar | 3\nÜslü İfadeler | 3\nKareköklü İfadeler | 4\n+ Kareköklü ifadelerde problemler\nVeri Analizi | 2\nBasit Olayların Olma Olasılığı | 2\nCebirsel İfadeler ve Özdeşlikler | 3\nDoğrusal Denklemler | 3\nEşitsizlikler | 2\nÜçgenler | 3\nEşlik ve Benzerlik | 2\nDönüşüm Geometrisi | 2\nGeometrik Cisimler | 3\nGenel tekrar ve LGS denemeleri | 4",
    },
    {
      cls: 1,
      subject: "Matematik",
      behind: 2,
      source: "Çarpanlar ve Katlar | 3\nÜslü İfadeler | 3\nKareköklü İfadeler | 4\n+ Kareköklü ifadelerde problemler\nVeri Analizi | 2\nBasit Olayların Olma Olasılığı | 2\nCebirsel İfadeler ve Özdeşlikler | 3\nDoğrusal Denklemler | 3\nEşitsizlikler | 2\nÜçgenler | 3\nEşlik ve Benzerlik | 2\nDönüşüm Geometrisi | 2\nGeometrik Cisimler | 3\nGenel tekrar ve LGS denemeleri | 4",
    },
    {
      cls: 0,
      subject: "Türkçe",
      behind: 0,
      source: "Sözcükte Anlam | 2\nCümlede Anlam | 2\nParagrafta Anlam | 3\nFiilimsiler | 2\nCümlenin Ögeleri | 2\nFiillerde Çatı | 2\nCümle Türleri | 2\nYazım Kuralları | 2\nNoktalama İşaretleri | 2\nSöz Sanatları | 1\nMetin Türleri | 2\nAnlatım Bozuklukları | 2\nSözel Mantık ve Görsel Okuma | 3",
    },
    {
      cls: 2,
      subject: "Fizik",
      behind: 1,
      source: "Çembersel Hareket | 3\nBasit Harmonik Hareket | 2\nDalga Mekaniği | 3\nAtom Fiziğine Giriş ve Radyoaktivite | 3\nModern Fizik | 3\nModern Fiziğin Teknolojideki Uygulamaları | 2\nAYT genel tekrar | 6",
    },
  ];
  for (const pl of PLANS) {
    const startDate = defaultPlanStart(year);
    const slots = layoutPlan(parsePlan(pl.source).lines, startDate, holidays);
    const plan = await prisma.lessonPlan.create({
      data: { ownerId, classroomId: pl.classroomId ?? classes[pl.cls].id, subject: pl.subject, year, startDate, source: pl.source },
    });
    const due = slots.filter((s) => s.endWeek < thisWeek);
    const doneUpTo = due.length - pl.behind;
    await prisma.planItem.createMany({
      data: slots.map((s, i) => ({
        planId: plan.id,
        order: s.order,
        topic: s.topic,
        week: s.week,
        endWeek: s.endWeek,
        doneDate: i < doneUpTo ? ymd(new Date(new Date(s.endWeek + "T12:00:00").getTime() + 3 * 86400000)) : null,
      })),
    });
  }

  // Örnek müfredat (8. sınıf, 12. sınıf fizik, TYT); konu adları yukarıdaki plan ve deneme konularıyla uyumlu
  const orderInSet = new Map<string, number>();
  await prisma.curriculumTopic.createMany({
    data: SAMPLE_CURRICULUM.map((r) => {
      const k = r.subject + "|" + r.grade;
      const order = orderInSet.get(k) ?? 0;
      orderInSet.set(k, order + 1);
      return { ...r, ownerId, order };
    }),
  });
}
