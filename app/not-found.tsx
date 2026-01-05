import React from 'react';
import { Metadata } from 'next';
import { Header } from '@/components/layouts/header';
import { Footer } from '@/components/layouts/footer';
import { NotFoundClient } from '@/components/not-found';


export const metadata: Metadata = {
    title: 'Page Not Found | UnityAlgo',
    description: 'The page you are looking for does not exist.',
};

export default function NotFound() {
    return (
        <main className="bg-background text-foreground min-h-screen flex flex-col overflow-hidden">
            <Header />
            <div className='py-16'>
                <NotFoundClient />
            </div>
            <Footer />
        </main>
    );
}   