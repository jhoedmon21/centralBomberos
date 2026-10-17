// Cliente Prisma único (evita múltiples clientes con HMR de Next.js).
// Conexión por HTTPS con el driver serverless de Neon (@prisma/adapter-neon):
// funciona igual en la central local y en Vercel, sin depender del motor Rust
// ni del puerto 5432 (que algunas redes/firewalls bloquean al motor nativo).

import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

function crearCliente(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta DATABASE_URL (Neon)");
  // PrismaNeon = pool WebSocket: soporta transacciones (las usa el despacho
  // multi-unidad). El driver HTTP puro (PrismaNeonHttp) no las soporta.
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString: url }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? crearCliente();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
