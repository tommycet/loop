import type { Metadata } from "next";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";
import { DocSidebar } from "../../components/docs/DocSidebar";

export const metadata: Metadata = {
  title: "Documentation",
  description: "The Loop developer documentation.",
};

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NavBar />
      <div className="container-page py-12">
        <div className="flex gap-12">
          <DocSidebar />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
      <Footer />
    </>
  );
}