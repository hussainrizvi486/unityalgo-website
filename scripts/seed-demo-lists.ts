/**
 * Seeds throwaway rows so the admin list views can be exercised with data.
 *
 *   npx tsx scripts/seed-demo-lists.ts          # create
 *   npx tsx scripts/seed-demo-lists.ts --clean  # remove
 *
 * Everything it writes is prefixed so `--clean` can find it again; it never
 * touches rows it did not create.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const PREFIX = 'demo-list-';

async function clean() {
    await prisma.contactSubmission.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await prisma.post.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    console.log('demo rows removed');
}

async function seed() {
    await clean();

    const contacts = Array.from({ length: 12 }, (_, i) => ({
        firstName: ['Ada', 'Grace', 'Alan', 'Katherine', 'Linus', 'Barbara'][i % 6],
        lastName: ['Lovelace', 'Hopper', 'Turing', 'Johnson', 'Torvalds', 'Liskov'][i % 6],
        email: `${PREFIX}${i}@example.com`,
        phone: `+1 555 010${i.toString().padStart(2, '0')}`,
        message:
            'We are evaluating Unity Commerce for a multi-region rollout and would like to discuss ' +
            'pricing, migration support and the timeline for onboarding our existing catalogue.',
    }));
    await prisma.contactSubmission.createMany({ data: contacts });

    const posts = Array.from({ length: 8 }, (_, i) => ({
        title: `Demo post ${i + 1}: scaling storefronts`,
        slug: `${PREFIX}post-${i + 1}`,
        excerpt: 'A short summary of the article used to exercise the admin list view.',
        content: '<p>Body</p>',
        coverImage: 'https://placehold.co/1200x630/png',
        published: i % 3 !== 0,
        publishedAt: i % 3 !== 0 ? new Date(Date.now() - i * 86_400_000) : null,
    }));
    for (const post of posts) await prisma.post.create({ data: post });

    console.log(`seeded ${contacts.length} contacts, ${posts.length} posts`);
}

const run = process.argv.includes('--clean') ? clean : seed;
run()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
        console.error(error);
        await prisma.$disconnect();
        process.exit(1);
    });


