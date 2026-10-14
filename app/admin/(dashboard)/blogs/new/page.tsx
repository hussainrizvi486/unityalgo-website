import { createPostAction } from '@/app/admin/actions';
import { PostForm } from '../post-form';

export default function NewPostPage() {
    return (
        <div>
            <h1 className="portal-page-title mb-8">New Post</h1>
            <PostForm action={createPostAction} submitLabel="Create Post" />
        </div>
    );
}
