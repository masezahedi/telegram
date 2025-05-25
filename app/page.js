import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Header from '@/components/home/header';
import Footer from '@/components/home/footer';
import HeroSection from '@/components/home/hero-section';
import FeaturesSection from '@/components/home/features-section';
import TestimonialsSection from '@/components/home/testimonials-section';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <Footer />
    </main>
  );
}