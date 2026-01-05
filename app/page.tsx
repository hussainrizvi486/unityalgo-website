import { Header } from '../components/layouts/header';
import { HeroSection } from '@/components/website/hero-section';
import { Services } from '../components/website/services-section';
import { Contact } from '../components/website/contact-section';
import { Footer } from '../components/layouts/footer';
import { Toaster } from "react-hot-toast";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <Header />
      <HeroSection />
      <main>
        <Services />
        {/* <About /> */}
        <Contact />
      </main>
      <Footer />
      <Toaster />
    </div>
  );
}
