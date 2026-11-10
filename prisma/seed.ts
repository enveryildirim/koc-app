import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedKurum } from "./seed-kurum";

const prisma = new PrismaClient();

async function main() {
  // Demo hesabı silinmez, güncellenir: kimliği sabit kalır. Soru havuzu (QuestionSource / QuestionItem ve
  // storage/<ownerId>/ dosyaları) seed'e dahil değildir; hesap yeniden oluşturulsaydı sahipsiz kalırdı.
  const demo = { name: "Örnek Eğitim Kurumu", email: "demo@sinavkur.com", passwordHash: await bcrypt.hash("demo1234", 10) };
  const user = await prisma.user.upsert({ where: { email: demo.email }, update: demo, create: demo });

  await seedKurum(prisma, user.id);

  console.log("Seed tamamlandı → giriş: demo@sinavkur.com / demo1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
