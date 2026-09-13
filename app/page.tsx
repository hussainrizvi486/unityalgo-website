import { Header } from '@/components/layouts/header';
import { Footer } from '@/components/layouts/footer';

import { HeroSection } from '@/components/website/hero-section';
import { PlansSection } from '@/components/website/plans-section';
import { HowWeBuildSection } from '@/components/website/how-we-build-section';
import { Services } from '@/components/website/services-section';
import { Contact } from '@/components/website/contact-section';

import { Toaster } from 'react-hot-toast';

// Plans are read per request, so an edit in /admin/plans shows here without a
// rebuild rather than being baked into a static page.
export const dynamic = 'force-dynamic';

export default function Index() {
    return (
        <div className="min-h-screen">
            <Header />
            {/* The hero is the page's primary content, so it belongs inside
                <main> — it used to sit outside the landmark. */}
            <main>
                <HeroSection />
                <Services />
                <PlansSection />
                <HowWeBuildSection />
                <Contact />
            </main>
            <Footer />
            <Toaster />
        </div>
    );
}
