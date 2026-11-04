import { api } from "@/shared/http";
import { ownerOrThrow } from "@/modules/identity/server";
import { createTest } from "@/modules/online-test/server";

export const POST = api(async () => createTest(await ownerOrThrow()));
