'use client';

import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

interface PasswordInputProps extends Omit<React.ComponentProps<typeof Input>, 'type'> {
  icon?: boolean;
}

function PasswordInput({ className, icon = false, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      {icon ? <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /> : null}
      <Input
        type={visible ? 'text' : 'password'}
        className={cn(icon && 'pl-10', 'pr-10', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-700"
      >
        {visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
      </button>
    </div>
  );
}

export { PasswordInput };
