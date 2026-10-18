import 'dotenv/config';
import { like } from 'drizzle-orm';
import { closeDb, db, schema } from '../lib/db';

const PREFIX = 'demo-list-';

async function clean() {
    await db.delete(schema.contactSubmission).where(like(schema.contactSubmission.email, `${PREFIX}%`));
    await db.delete(schema.post).where(like(schema.post.slug, `${PREFIX}%`));
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
    await db.insert(schema.contactSubmission).values(contacts);

    const posts = Array.from({ length: 8 }, (_, i) => ({
        title: `Demo post ${i + 1}: scaling storefronts`,
        slug: `${PREFIX}post-${i + 1}`,
        excerpt: 'A short summary of the article used to exercise the admin list view.',
        content: '<p>Body</p>',
        coverImage: 'https://placehold.co/1200x630/png',
        published: i % 3 !== 0,
        publishedAt: i % 3 !== 0 ? new Date(Date.now() - i * 86_400_000) : null,
    }));
    await db.insert(schema.post).values(posts);

    console.log(`seeded ${contacts.length} contacts, ${posts.length} posts`);
}

const run = process.argv.includes('--clean') ? clean : seed;
run()
    .then(() => closeDb())
    .catch(async (error) => {
        console.error(error);
        await closeDb();
        process.exit(1);
    });

