'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** Switch the branch a GitHub app is installed from. Saving re-reads the repository on that branch. */
export function BranchPicker({
    appId,
    current,
    branches,
    action,
}: {
    appId: string;
    current: string;
    branches: string[];
    action: (formData: FormData) => void | Promise<void>;
}) {
    const [branch, setBranch] = React.useState(current);
    const options = branches.includes(current) ? branches : [current, ...branches];
    return (
        <form action={action} className="flex items-center justify-end gap-2 font-normal">
            <input type="hidden" name="id" value={appId} />
            <input type="hidden" name="branch" value={branch} />
            <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                    {options.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button type="submit" size="sm" variant="outline" disabled={branch === current}>Switch</Button>
        </form>
    );
}
