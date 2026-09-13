import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function usage(): never {
  console.log(`Usage:
  npm run admin:create -- <email> <password> [name]
  npm run admin:set-password -- <email> <new-password>
  npm run admin:list
  npm run admin:delete -- <email>`);
  process.exit(1);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'create': {
      const [email, password, name] = args;
      if (!email || !password) usage();
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.upsert({
        where: { email: email.toLowerCase() },
        update: { passwordHash, name, role: 'ADMIN' },
        create: { email: email.toLowerCase(), passwordHash, name, role: 'ADMIN' },
      });
      console.log(`Admin user ready: ${user.email}`);
      break;
    }
    case 'set-password': {
      const [email, password] = args;
      if (!email || !password) usage();
      const passwordHash = await bcrypt.hash(password, 10);
      const user = await prisma.user.update({
        where: { email: email.toLowerCase() },
        data: { passwordHash },
      });
      console.log(`Password updated for: ${user.email}`);
      break;
    }
    case 'list': {
      const users = await prisma.user.findMany({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
      if (users.length === 0) {
        console.log('No admin users yet.');
        break;
      }
      for (const user of users) {
        console.log(`${user.email}${user.name ? ` (${user.name})` : ''} — created ${user.createdAt.toISOString()}`);
      }
      break;
    }
    case 'delete': {
      const [email] = args;
      if (!email) usage();
      await prisma.user.delete({ where: { email: email.toLowerCase(), role: 'ADMIN' } });
      console.log(`Deleted admin user: ${email}`);
      break;
    }
    default:
      usage();
  }
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
