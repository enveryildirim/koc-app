import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { addNationalHolidays } from "@/modules/planning/server";

export const POST = api(async (req) => {
  const ownerId = await ownerOrThrow();
  const { year } = await req.json();
  return addNationalHolidays(ownerId, Number(year));
});
