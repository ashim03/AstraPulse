const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();
const WORKSPACE_ID = 'cmt5sjd04000062bm41d445cb';

(async () => {
  const hash = await bcrypt.hash('Change@123', 10);

  const updates = [
    { oldEmail: 'aishwarya.kc@astrapulse.local', newEmail: 'kc.aisho@gmail.com', name: 'Aishwarya Kc' },
    { oldEmail: 'ashim.acharya@astrapulse.local', newEmail: 'nfornischal33@gmail.com', name: 'Ashim Acharya' },
    { oldEmail: 'anil.kafle@astrapulse.local', newEmail: 'kafleanil18@gmail.com', name: 'Anil Kafle' },
  ];

  for (const u of updates) {
    // Check if email already exists
    const existing = await prisma.user.findFirst({ where: { email: u.newEmail, workspaceId: WORKSPACE_ID } });
    if (existing && existing.email !== u.oldEmail) {
      console.log(`SKIP: ${u.newEmail} already taken`);
      continue;
    }

    const user = await prisma.user.findFirst({ where: { email: u.oldEmail, workspaceId: WORKSPACE_ID } });
    if (!user) { console.log(`NOT FOUND: ${u.oldEmail}`); continue; }

    await prisma.user.update({ where: { id: user.id }, data: { email: u.newEmail } });
    await prisma.employee.updateMany({ where: { workspaceId: WORKSPACE_ID, email: u.oldEmail }, data: { email: u.newEmail } });
    console.log(`UPDATED: ${u.name}: ${u.oldEmail} → ${u.newEmail}`);
  }

  // Verify all users
  const users = await prisma.user.findMany({
    where: { workspaceId: WORKSPACE_ID, status: 'active' },
    select: { name: true, email: true },
    orderBy: { name: 'asc' },
  });
  console.log('\nAll users:');
  users.forEach(u => console.log(`  ${u.name} | ${u.email} | Password: Change@123`));

  await prisma.$disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
