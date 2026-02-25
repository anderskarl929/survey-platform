import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.argv[2] || "admin@example.com";
  const password = process.argv[3] || "admin123";
  const name = process.argv[4] || "Admin";

  const passwordHash = await bcrypt.hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, name, passwordHash },
  });

  console.log(`Admin-konto skapat/uppdaterat:`);
  console.log(`  Email: ${admin.email}`);
  console.log(`  Namn: ${admin.name}`);
  console.log(`  Lösenord: ${password}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
