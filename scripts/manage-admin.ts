import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { and, asc, eq } from 'drizzle-orm';
import { closeDb, db, one, schema } from '../lib/db';

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
      const [user] = await db
        .insert(schema.user)
        .values({ email: email.toLowerCase(), passwordHash, name, role: 'ADMIN' })
        .onConflictDoUpdate({ target: schema.user.email, set: { passwordHash, name, role: 'ADMIN' } })
        .returning();
      console.log(`Admin user ready: ${user.email}`);
      break;
    }
    case 'set-password': {
      const [email, password] = args;
      if (!email || !password) usage();
      const passwordHash = await bcrypt.hash(password, 10);
      const user = one(
        await db.update(schema.user).set({ passwordHash }).where(eq(schema.user.email, email.toLowerCase())).returning(),
        `No user with email ${email}`,
      );
      console.log(`Password updated for: ${user.email}`);
      break;
    }
    case 'list': {
      const users = await db.query.user.findMany({ where: eq(schema.user.role, 'ADMIN'), orderBy: asc(schema.user.createdAt) });
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
      one(
        await db.delete(schema.user).where(and(eq(schema.user.email, email.toLowerCase()), eq(schema.user.role, 'ADMIN'))).returning({ id: schema.user.id }),
        `No admin with email ${email}`,
      );
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
  .finally(() => closeDb());
