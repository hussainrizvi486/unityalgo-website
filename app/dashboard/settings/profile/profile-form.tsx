'use client';

import { PortalPanel } from '@/components/customer/portal-panel';
import { Notice } from '@/components/ui/notice';
import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Building2, Camera, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveAvatarUrl } from '@/lib/customer-mock';
import { useAvatarUrl } from '@/lib/use-avatar';
import {
    updateProfileAction,
    type AccountFormState,
} from '@/app/customer/actions';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save changes'}
        </Button>
    );
}

interface ProfileFormProps {
    embedded?: boolean;
    firstName: string;
    lastName: string;
    username: string;
    phone: string;
    company: string;
    companyEmail: string;
}

export function ProfileForm({
    firstName,
    lastName,
    username,
    phone,
    company,
    companyEmail,
    embedded = false,
}: ProfileFormProps) {
    const [state, formAction] = useActionState<
        AccountFormState | undefined,
        FormData
    >(updateProfileAction, undefined);
    const [imageError, setImageError] = useState('');
    // Reads through to localStorage and re-renders on save, so the preview here
    // and the avatar in the sidebar stay in step without a reload.
    const avatar = useAvatarUrl();

    function changeAvatar(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;
        setImageError('');
        if (!file.type.startsWith('image/'))
            return setImageError('Choose a PNG, JPG or WebP image.');
        if (file.size > 5 * 1024 * 1024)
            return setImageError('Choose an image smaller than 5 MB.');
        const reader = new FileReader();
        reader.onload = () => {
            const source = new window.Image();
            source.onload = () => {
                const canvas = document.createElement('canvas');
                const size = 256;
                canvas.width = size;
                canvas.height = size;
                const context = canvas.getContext('2d');
                if (!context)
                    return setImageError('Unable to process this image.');
                const crop = Math.min(source.width, source.height);
                context.drawImage(
                    source,
                    (source.width - crop) / 2,
                    (source.height - crop) / 2,
                    crop,
                    crop,
                    0,
                    0,
                    size,
                    size,
                );
                // saveAvatarUrl dispatches the change event that useAvatarUrl
                // subscribes to, so the preview and the sidebar both update from here.
                saveAvatarUrl(canvas.toDataURL('image/jpeg', 0.82));
            };
            source.onerror = () => setImageError('Unable to read this image.');
            source.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    }

    return (
        <div className="mx-auto portal-page">
            {!embedded && (
                <>
                    <Link
                        href="/dashboard/settings"
                        className="mb-6 inline-flex items-center gap-2 portal-text-body font-semibold text-muted-foreground hover:text-foreground/80"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to settings
                    </Link>
                    <p className="portal-text-caption font-bold uppercase tracking-eyebrow text-primary">
                        Settings
                    </p>
                    <h1 className="portal-page-title mt-2">
                        Edit profile
                    </h1>
                    <p className="mt-2 portal-text-body text-muted-foreground">
                        Update your name and profile picture.
                    </p>
                </>
            )}

            <PortalPanel className="mt-8">
                <div className="mb-6 flex items-center gap-3">
                    <UserRound className="h-5 w-5 text-primary" />
                    <h2 className=" text-foreground">Profile details</h2>
                </div>

                <div className="mb-7 flex flex-col gap-gap sm:flex-row sm:items-center">
                    <div className="relative w-fit">
                        {avatar ? (
                            <Image
                                src={avatar}
                                alt="Profile preview"
                                width={80}
                                height={80}
                                unoptimized
                                className="h-20 w-20 rounded-xl object-cover"
                            />
                        ) : (
                            <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
                                {firstName.charAt(0)}
                                {lastName.charAt(0)}
                            </span>
                        )}
                        <label
                            htmlFor="avatar"
                            aria-label="Change profile photo"
                            className="absolute -bottom-2 -right-2 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground"
                        >
                            <Camera className="h-3.5 w-3.5" />
                        </label>
                        <input
                            id="avatar"
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={changeAvatar}
                            className="sr-only"
                        />
                    </div>
                    <div>
                        <p className="portal-text-body font-semibold text-foreground">
                            Profile picture
                        </p>
                        <p className="mt-1 portal-text-caption text-muted-foreground">
                            PNG, JPG or WebP, up to 5 MB
                        </p>
                        <label
                            htmlFor="avatar"
                            className="mt-2 inline-block cursor-pointer portal-text-caption font-semibold text-primary"
                        >
                            Upload new photo
                        </label>
                        {imageError ? (
                            <p
                                role="alert"
                                className="mt-2 portal-text-caption text-destructive"
                            >
                                {imageError}
                            </p>
                        ) : null}
                    </div>
                </div>

                <form action={formAction} className="space-y-gap">
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="firstName" className="text-foreground/80">
                                First name
                            </Label>
                            <Input
                                id="firstName"
                                name="firstName"
                                required
                                defaultValue={firstName}
                            />
                        </div>
                        <div>
                            <Label htmlFor="lastName" className="text-foreground/80">
                                Last name
                            </Label>
                            <Input
                                id="lastName"
                                name="lastName"
                                required
                                defaultValue={lastName}
                            />
                        </div>
                    </div>
                    <div>
                        <Label htmlFor="username" className="text-foreground/80">
                            Username{' '}
                            <span className="text-muted-foreground font-normal">
                                (optional)
                            </span>
                        </Label>
                        <Input
                            id="username"
                            name="username"
                            defaultValue={username}
                            placeholder="janedoe"
                        />
                    </div>
                    <div>
                        <Label htmlFor="phone" className="text-foreground/80">
                            Mobile number
                        </Label>
                        <Input
                            id="phone"
                            name="phone"
                            type="tel"
                            defaultValue={phone}
                            placeholder="+1 555 000 0000"
                        />
                    </div>

                    <div className="border-t border-border/60 pt-5">
                        <div className="mb-4 flex items-center gap-2 portal-text-body font-semibold text-foreground">
                            <Building2 className="h-4 w-4 text-primary" />
                            Company
                        </div>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <Label
                                    htmlFor="company"
                                    className="text-foreground/80"
                                >
                                    Company name{' '}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Input
                                    id="company"
                                    name="company"
                                    defaultValue={company}
                                />
                            </div>
                            <div>
                                <Label
                                    htmlFor="companyEmail"
                                    className="text-foreground/80"
                                >
                                    Company email{' '}
                                    <span className="text-muted-foreground font-normal">
                                        (optional)
                                    </span>
                                </Label>
                                <Input
                                    id="companyEmail"
                                    name="companyEmail"
                                    type="email"
                                    defaultValue={companyEmail}
                                />
                            </div>
                        </div>
                    </div>

                    {state?.error ? (
                        <Notice tone="error">{state.error}</Notice>
                    ) : null}
                    <SubmitButton />
                </form>
            </PortalPanel>
        </div>
    );
}
