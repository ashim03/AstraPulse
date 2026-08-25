const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const roles = await prisma.role.findMany({ select: { id: true, name: true, permissions: true } });
  roles.forEach(r => console.log(r.name + ':', r.permissions));
  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
