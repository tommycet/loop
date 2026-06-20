import { Metadata } from "next";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";
import { Hero } from "../../components/landing/Hero";
import { Stats } from "../../components/landing/Stats";
import { HowItWorks } from "../../components/landing/HowItWorks";
import { Features } from "../../components/landing/Features";
import { Testimonials } from "../../components/landing/Testimonials";
import { CTA } from "../../components/landing/CTA";

export const metadata: Metadata = {
  title: "Commitment Control Plane",
  description:
    "Every promise made in chat — ranked, assigned, approved, audited. Loop is the commitment control plane for chat-run businesses.",
};

export default function LandingPage() {
  return (
    <>
      {/* Preload the hero video so it begins downloading before the hero
          component mounts. React hoists <link> tags into <head>. */}
      <link
        rel="preload"
        as="video"
        href="/landing/hero-bg.webm"
        type="video/webm"
        // fetchPriority is valid HTML; Next types lag
        {...({ fetchPriority: "high" } as Record<string, string>)}
      />
      <link
        rel="preload"
        as="image"
        href="/landing/hero-bg.webp"
        type="image/webp"
        // fetchPriority is valid HTML; Next types lag
        {...({ fetchPriority: "high" } as Record<string, string>)}
      />
      <NavBar />
      <main>
        <Hero />
        <Stats />
        <HowItWorks />
        <Features />
        <Testimonials />
        <CTA />
      </main>
      <Footer />
    </>
  );
}