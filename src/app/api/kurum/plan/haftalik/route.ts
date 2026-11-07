import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { importWeeklyPlans } from "@/modules/planning/server";

/** Haftalık plan tablosunu seçilen sınıflara yıllık plan olarak kaydeder (bkz. planning > importWeeklyPlans). */
export const POST = api(async (req) => importWeeklyPlans(await ownerOrThrow(), await req.json()));
