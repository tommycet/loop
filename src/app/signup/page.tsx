import { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";

export const metadata: Metadata = {
  title: "Get started",
  description: "Start your free Loop trial.",
};

export default function SignupPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-eyebrow mb-3 text-[color:var(--brand-cyan)]">14-day free trial · no card</div>
            <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-display font-semibold tracking-[-0.03em]">
              Start with Loop
            </h1>
          </div>

          <form className="surface-card p-8 space-y-5">
            <div>
              <label htmlFor="su-name">Your name</label>
              <input id="su-name" type="text" placeholder="Sarah Khan" required />
            </div>
            <div>
              <label htmlFor="su-email">Work email</label>
              <input id="su-email" type="email" placeholder="sarah@biz.pk" required />
            </div>
            <div>
              <label htmlFor="su-company">Company</label>
              <input id="su-company" type="text" placeholder="Ali Traders" required />
            </div>
            <div>
              <label htmlFor="su-password">Password</label>
              <input id="su-password" type="password" required minLength={8} />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Create account
            </button>
            <p className="text-center text-[0.8125rem] text-fg-tertiary leading-relaxed">
              By signing up, you agree to our{" "}
              <Link href="/docs/terms" className="link">Terms</Link> and{" "}
              <Link href="/docs/privacy" className="link">Privacy Policy</Link>.
            </p>
          </form>

          <div className="mt-6 text-center text-[0.875rem] text-fg-tertiary">
            Already have an account?{" "}
            <Link href="/login" className="link">Sign in</Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}