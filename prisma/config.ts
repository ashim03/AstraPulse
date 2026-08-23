import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasource: {
    url: process.env.DATABASE_URL,
  },
});

export default prisma;