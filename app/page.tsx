import { Header } from '@/components/layouts/header';
import { Footer } from '@/components/layouts/footer';

import { HeroSection } from '@/components/website/hero-section';
import { HowWeBuildSection } from '@/components/website/how-we-build-section';
import { Services } from '@/components/website/services-section';
import { Contact } from '@/components/website/contact-section';

import { Toaster } from "react-hot-toast";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <main>
        <Services />
                <HowWeBuildSection />

        <Contact />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}


export default Index;