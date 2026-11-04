import { prisma } from "@/shared/db";

/** Returns the test if it belongs to the user, otherwise null. */
export async function getOwnedTest(testId: string, userId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId } });
  return test && test.ownerId === userId ? test : null;
}
