import { prisma } from '@/lib/db';

// Registry of the entity types allowed to carry a comment thread, so
// callers can't pass an arbitrary string as entityType by mistake. Add a
// new entry here whenever another table wants comments — no schema change
// needed since Comment itself stays generic.
export const CommentEntityType = {
    SUPPORT_TICKET: 'SUPPORT_TICKET',
} as const;

export type CommentEntityType = (typeof CommentEntityType)[keyof typeof CommentEntityType];

export async function listComments(entityType: CommentEntityType, entityId: string) {
    return prisma.comment.findMany({
        where: { entityType, entityId },
        include: { author: { select: { id: true, name: true, firstName: true, lastName: true, role: true } } },
        orderBy: { createdAt: 'asc' },
    });
}

export async function createComment(entityType: CommentEntityType, entityId: string, authorId: string, body: string) {
    return prisma.comment.create({
        data: { entityType, entityId, authorId, body },
    });
}
