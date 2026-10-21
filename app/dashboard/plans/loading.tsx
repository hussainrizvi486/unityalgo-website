import { CardGridSkeleton } from '@/components/ui/page-skeletons';

export default function Loading() {
    return <CardGridSkeleton count={3} withToolbar={false} />;
}
