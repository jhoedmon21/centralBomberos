// Conteo directo de hidrantes en la base (sin pasar por la web)
// Uso: node scripts/count-hydrants.mjs
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const total = await prisma.hydrant.count();
const byCode = await prisma.hydrant.findMany({
  select: { code: true, lat: true, lng: true, situation: true },
  orderBy: { code: "asc" },
  take: 15,
});
console.log(`Total hidrantes en la base: ${total}`);
for (const h of byCode) console.log(`  ${h.code}  ${h.lat}, ${h.lng}  ${h.situation}`);
await prisma.$disconnect();
