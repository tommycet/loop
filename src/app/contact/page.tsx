import { Metadata } from "next";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";
import { ContactForm, ContactChannels } from "../../components/contact/Contact";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with Loop. Sales, support, press.",
};

export default function ContactPage() {
  return (
    <>
      <NavBar />
      <main className="section">
        <div className="container-page">
          <div className="max-w-2xl mb-16">
            <div className="text-eyebrow mb-4">Contact</div>
            <h1 className="text-display-balance">Tell us what you're running.</h1>
            <p className="mt-5 text-[1.0625rem] text-fg-secondary leading-relaxed">
              The fastest path is the form. If you're debugging an outage or have a
              security concern, email <a href="mailto:support@loop.demo" className="link">support@loop.demo</a> directly.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
            <ContactForm />
            <div>
              <div className="text-eyebrow mb-4">Other channels</div>
              <ContactChannels />

              <div className="mt-8 surface-card p-6">
                <div className="font-mono text-[0.6875rem] tracking-[0.12em] uppercase text-fg-tertiary mb-3">
                  Office
                </div>
                <p className="text-[0.9375rem] text-fg-secondary leading-relaxed">
                  Block 5, Clifton<br />
                  Karachi 75600, Pakistan
                </p>
                <p className="text-[0.8125rem] text-fg-tertiary mt-3">
                  By appointment only. We're usually in the field.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}