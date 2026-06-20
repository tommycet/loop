import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Commitment Control Plane",
    template: "%s · Loop",
  },
  description:
    "Every promise made in chat — ranked, assigned, approved, audited. Loop is the Commitment Control Plane for chat-run businesses.",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}