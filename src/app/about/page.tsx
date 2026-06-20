import { Metadata } from "next";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";
import { AboutStory, AboutTeam } from "../../components/about/About";
import { CTA } from "../../components/landing/CTA";

export const metadata: Metadata = {
  description:
    "Loop is a commitment control plane for chat-run businesses. Built in Karachi.",
};

export default function AboutPage() {
  return (
    <>
      <NavBar />
      <main>
        <AboutStory />
        <AboutTeam />
        <CTA />
      </main>
      <Footer />
    </>
  );
}