import { and, asc, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

export const CommentEntityType = {
    SUPPORT_TICKET: 'SUPPORT_TICKET',
} as const;

export type CommentEntityType = (typeof CommentEntityType)[keyof typeof CommentEntityType];

export async function listComments(entityType: CommentEntityType, entityId: string) {
    return db.query.comment.findMany({
        where: and(eq(schema.comment.entityType, entityType), eq(schema.comment.entityId, entityId)),
        with: { author: { columns: { id: true, name: true, firstName: true, lastName: true, role: true } } },
        orderBy: asc(schema.comment.createdAt),
    });
}

export async function createComment(entityType: CommentEntityType, entityId: string, authorId: string, body: string) {
    const [comment] = await db
        .insert(schema.comment)
        .values({ entityType, entityId, authorId, body })
        .returning();
    return comment;
}
