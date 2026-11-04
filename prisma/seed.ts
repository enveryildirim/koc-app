import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { gradeAll } from "../src/modules/online-test/grading";
import { seedKurum } from "./seed-kurum";

const prisma = new PrismaClient();

type Q = {
  type: "SINGLE" | "MULTI" | "TRUE_FALSE" | "SHORT";
  text: string;
  options?: [string, boolean][];
  correctText?: string;
  points?: number;
  explanation?: string;
};

const TF = (correct: boolean): [string, boolean][] => [
  ["Doğru", correct],
  ["Yanlış", !correct],
];

const TESTS: {
  title: string;
  description: string;
  shareCode: string;
  timeLimitMin?: number;
  questions: Q[];
}[] = [
  {
    title: "8. Sınıf Matematik – Üslü İfadeler",
    description: "Üslü ifadeler ve kareköklü sayılar konusunu kapsayan 12 soruluk deneme.",
    shareCode: "MAT801",
    timeLimitMin: 20,
    questions: [
      { type: "SINGLE", text: "2³ · 2⁴ işleminin sonucu kaçtır?", options: [["2⁷", true], ["2¹²", false], ["4⁷", false], ["2¹", false]], explanation: "Tabanlar aynıyken üsler toplanır." },
      { type: "SINGLE", text: "(−3)² ifadesinin değeri kaçtır?", options: [["−9", false], ["9", true], ["−6", false], ["6", false]] },
      { type: "SINGLE", text: "√144 kaçtır?", options: [["11", false], ["12", true], ["13", false], ["14", false], ["72", false]] },
      { type: "SINGLE", text: "10⁻² sayısının ondalık gösterimi hangisidir?", options: [["0,1", false], ["0,01", true], ["0,001", false], ["100", false]] },
      { type: "TRUE_FALSE", text: "Sıfırdan farklı her sayının sıfırıncı kuvveti 1'dir.", options: TF(true) },
      { type: "SINGLE", text: "5⁰ + 5¹ toplamı kaçtır?", options: [["5", false], ["6", true], ["10", false], ["1", false]] },
      { type: "SINGLE", text: "√50 hangi iki ardışık tam sayı arasındadır?", options: [["5 ile 6", false], ["6 ile 7", false], ["7 ile 8", true], ["8 ile 9", false]] },
      { type: "TRUE_FALSE", text: "√2 bir rasyonel sayıdır.", options: TF(false) },
      { type: "SINGLE", text: "3,2 × 10⁵ sayısı hangisine eşittir?", options: [["32 000", false], ["320 000", true], ["3 200 000", false], ["3 200", false]] },
      { type: "SINGLE", text: "(2²)³ ifadesi hangisine eşittir?", options: [["2⁵", false], ["2⁶", true], ["2⁸", false], ["4⁵", false]] },
      { type: "SINGLE", text: "√18 ifadesinin en sade hâli hangisidir?", options: [["2√3", false], ["3√2", true], ["9√2", false], ["6√3", false]] },
      { type: "SINGLE", text: "Aşağıdakilerden hangisi tam kare sayıdır?", options: [["48", false], ["63", false], ["81", true], ["99", false]] },
    ],
  },
  {
    title: "Genel Kültür Bilgi Yarışması",
    description: "Tarih, coğrafya ve bilimden karışık sorular. Farklı soru tiplerini denemek için ideal.",
    shareCode: "GENEL1",
    questions: [
      { type: "SINGLE", text: "Türkiye'nin en uzun nehri hangisidir?", options: [["Fırat", false], ["Kızılırmak", true], ["Sakarya", false], ["Dicle", false]] },
      { type: "SINGLE", text: "İstanbul hangi yılda fethedilmiştir?", options: [["1071", false], ["1299", false], ["1453", true], ["1517", false]] },
      { type: "MULTI", text: "Aşağıdakilerden hangileri gezegendir? (Birden fazla seçin)", options: [["Mars", true], ["Ay", false], ["Venüs", true], ["Güneş", false], ["Satürn", true]], points: 2 },
      { type: "TRUE_FALSE", text: "Su deniz seviyesinde 100 °C'de kaynar.", options: TF(true) },
      { type: "SHORT", text: "Türkiye'nin başkenti neresidir?", correctText: "Ankara" },
      { type: "SINGLE", text: "Periyodik tabloda 'Fe' sembolü hangi elementi gösterir?", options: [["Flor", false], ["Fosfor", false], ["Demir", true], ["Fermiyum", false]] },
      { type: "SHORT", text: "Dünya'nın tek doğal uydusunun adı nedir?", correctText: "Ay|Ay'dır" },
      { type: "TRUE_FALSE", text: "Everest Dağı Afrika kıtasındadır.", options: TF(false) },
    ],
  },
  {
    title: "İngilizce Kelime Testi (A2)",
    description: "Temel seviye İngilizce kelime bilgisi.",
    shareCode: "ENGA20",
    timeLimitMin: 10,
    questions: [
      { type: "SINGLE", text: "'Library' kelimesinin Türkçesi nedir?", options: [["Kitapçı", false], ["Kütüphane", true], ["Laboratuvar", false], ["Okul", false]] },
      { type: "SINGLE", text: "'Hızlı' kelimesinin İngilizcesi nedir?", options: [["Slow", false], ["Fast", true], ["Far", false], ["Fat", false]] },
      { type: "SINGLE", text: "Choose the opposite of 'cheap'.", options: [["Expensive", true], ["Free", false], ["Small", false], ["Easy", false]] },
      { type: "TRUE_FALSE", text: "'Tuesday' is the day after Monday.", options: TF(true) },
      { type: "SHORT", text: "'Elma' kelimesinin İngilizcesini yazın.", correctText: "apple|an apple" },
      { type: "SINGLE", text: "'I ___ a student.' boşluğa ne gelir?", options: [["is", false], ["are", false], ["am", true], ["be", false]] },
    ],
  },
  {
    title: "Fen Bilimleri – Optik Form Denemesi",
    description: "Optik form ile kâğıt üzerinde uygulanmak üzere hazırlanmış 20 soruluk deneme. 'Optik Form' sekmesinden formu yazdırabilir veya örnek taranmış form üretebilirsiniz.",
    shareCode: "FEN020",
    questions: Array.from({ length: 20 }, (_, i): Q => {
      const correct = (i * 7 + 3) % 4;
      return {
        type: "SINGLE",
        text: `Fen sorusu ${i + 1}: Doğru seçeneği işaretleyiniz.`,
        options: ["A", "B", "C", "D"].map((l, k) => [`Seçenek ${l}`, k === correct] as [string, boolean]),
      };
    }),
  },
];

const NAMES = [
  "Ayşe Yılmaz", "Mehmet Kaya", "Zeynep Demir", "Emre Çelik", "Elif Şahin", "Burak Yıldız",
  "Selin Aydın", "Can Öztürk", "Deniz Arslan", "Ece Doğan", "Kerem Koç", "Nil Kurt",
  "Arda Özdemir", "Defne Aslan", "Mert Polat", "İrem Erdoğan", "Ozan Güneş", "Sude Çakır",
];

function rand<T>(a: T[]) {
  return a[Math.floor(Math.random() * a.length)];
}

async function main() {
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: {
      name: "Örnek Eğitim Kurumu",
      email: "demo@sinavkur.com",
      passwordHash: await bcrypt.hash("demo1234", 10),
    },
  });

  for (const t of TESTS) {
    const test = await prisma.test.create({
      data: {
        ownerId: user.id,
        title: t.title,
        description: t.description,
        shareCode: t.shareCode,
        timeLimitMin: t.timeLimitMin ?? null,
        questions: {
          create: t.questions.map((q, i) => ({
            order: i,
            type: q.type,
            text: q.text,
            points: q.points ?? 1,
            correctText: q.correctText ?? "",
            explanation: q.explanation ?? "",
            options: { create: (q.options ?? []).map(([text, isCorrect], k) => ({ order: k, text, isCorrect })) },
          })),
        },
      },
      include: { questions: { include: { options: true }, orderBy: { order: "asc" } } },
    });

    // Rastgele katılımlar: her katılımcının bir "bilgi düzeyi" var
    const count = 8 + Math.floor(Math.random() * 10);
    for (let n = 0; n < count; n++) {
      const skill = 0.35 + Math.random() * 0.6;
      const answers: Record<string, { optionIds?: string[]; text?: string }> = {};
      for (const q of test.questions) {
        if (Math.random() < 0.05) continue; // boş bırakılan
        const knows = Math.random() < skill;
        if (q.type === "SHORT") {
          answers[q.id] = { text: knows ? q.correctText.split("|")[0] : rand(["bilmiyorum", "İstanbul", "Güneş", "orange"]) };
        } else if (q.type === "MULTI") {
          answers[q.id] = {
            optionIds: knows
              ? q.options.filter((o) => o.isCorrect).map((o) => o.id)
              : q.options.filter(() => Math.random() < 0.5).map((o) => o.id),
          };
        } else {
          const pick = knows ? q.options.find((o) => o.isCorrect)! : rand(q.options);
          answers[q.id] = { optionIds: [pick.id] };
        }
      }
      const { score, maxScore, rows } = gradeAll(test.questions, answers);
      const startedAt = new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 3600 * 1000));
      const omr = t.shareCode === "FEN020" && Math.random() < 0.6;
      await prisma.attempt.create({
        data: {
          testId: test.id,
          participantName: NAMES[(n + t.questions.length) % NAMES.length],
          studentNo: String(100000 + Math.floor(Math.random() * 899999)),
          source: omr ? "OMR" : "ONLINE",
          startedAt,
          finishedAt: new Date(startedAt.getTime() + (3 + Math.random() * 15) * 60000),
          score,
          maxScore,
          answers: { create: rows },
        },
      });
    }
  }

  await seedKurum(prisma, user.id);

  console.log("Seed tamamlandı → giriş: demo@sinavkur.com / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
