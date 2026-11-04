import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { importStudents } from "@/modules/enrollment/server";

/** Toplu öğrenci yükleme (Excel/CSV). Ayrıntılar: enrollment > importStudents. */
export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const { rows } = await req.json();
  return importStudents(ownerId, rows);
});
