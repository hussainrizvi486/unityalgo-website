import { ListSkeleton } from '@/components/ui/page-skeletons';

export default function Loading() {
    return <ListSkeleton rows={4} withAction={false} />;
}
