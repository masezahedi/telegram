import Link from "next/link";
import Header from "@/components/home/header";
import Footer from "@/components/home/footer";
import HeroSection from "@/components/home/hero-section";
import FeaturesSection from "@/components/home/features-section";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <Footer />
    </main>
  );
}
