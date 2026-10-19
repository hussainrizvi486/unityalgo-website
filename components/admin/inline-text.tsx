'use client';

import * as React from 'react';
import { cn } from '@/utils';

/**
 * Text edited where it is shown: click it and type. Plain text only, so pasting formatting from elsewhere does not bring
 * its fonts and colours along. The parent owns the value, so the same text can also be edited in an ordinary field.
 */
export function InlineText({
    value,
    onChange,
    placeholder,
    multiline,
    label,
    className,
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
    multiline?: boolean;
    label: string;
    className?: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);

    // Shows the value, including a change made in the other editing view. While the caret is in here the element is left alone.
    React.useLayoutEffect(() => {
        const element = ref.current;
        if (element && element.innerText !== value && document.activeElement !== element) element.innerText = value;
    }, [value]);

    return (
        <div
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            role="textbox"
            aria-label={label}
            aria-multiline={multiline || undefined}
            data-placeholder={placeholder}
            spellCheck
            onInput={(event) => {
                const text = event.currentTarget.innerText;
                onChange(multiline ? text : text.replace(/\n+/g, ' '));
            }}
            onKeyDown={(event) => {
                if (!multiline && event.key === 'Enter') event.preventDefault();
            }}
            onPaste={(event) => {
                event.preventDefault();
                const text = event.clipboardData.getData('text/plain');
                document.execCommand('insertText', false, multiline ? text : text.replace(/\s*\n+\s*/g, ' '));
            }}
            className={cn(
                'cursor-text rounded-sm px-2 py-1 -mx-2 outline-none transition-colors hover:bg-muted/60 focus:bg-muted/60 focus-visible:ring-ring/50 focus-visible:ring-3',
                'empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]',
                className,
            )}
        />
    );
}
