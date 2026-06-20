import { Metadata } from "next";
import Link from "next/link";
import { NavBar } from "../../components/marketing/NavBar";
import { Footer } from "../../components/marketing/Footer";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Loop.",
};

export default function LoginPage() {
  return (
    <>
      <NavBar />
      <main className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-6 py-20">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="text-eyebrow mb-3">Welcome back</div>
            <h1 className="text-[clamp(2rem,4vw,2.75rem)] font-display font-semibold tracking-[-0.03em]">
              Sign in to Loop
            </h1>
          </div>

          <form className="surface-card p-8 space-y-5">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" placeholder="you@biz.pk" required />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" required />
            </div>
            <button type="submit" className="btn btn-primary w-full">
              Sign in
            </button>
            <div className="text-center text-[0.875rem] text-fg-tertiary">
              New here?{" "}
              <Link href="/signup" className="link">
                Create an account
              </Link>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </>
  );
}