import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const username = "admin";
  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.user.upsert({
    where: { username },
    create: {
      name: "Warehouse Manager",
      username,
      passwordHash,
    },
    update: {
      name: "Warehouse Manager",
    },
  });
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
