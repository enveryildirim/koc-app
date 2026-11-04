import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createExam } from "@/modules/exams/server";

export const POST = api(async (req) => {
  const exam = await createExam(await ownerOrThrow(), await req.json());
  return { id: exam.id };
});
