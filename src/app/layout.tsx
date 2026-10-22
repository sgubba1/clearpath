import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SetupNotice } from "@/components/setup-notice";
import { SiteHeader } from "@/components/site-header";
import { TeamRuleRegistry } from "@/components/team-rule-registry";
import { TourBar } from "@/components/tour-bar";
import { getTeamRules } from "@/lib/team-rules";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ClearPath Compliance Review", template: "%s · ClearPath" },
  description: "Pre-check, risk-sorted review and audit trail for consumer-finance marketing.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Without a database the setup notice explains what to do; the layout itself still renders.
  const teamRules = process.env.DATABASE_URL ? await getTeamRules().catch(() => []) : [];

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted/30">
        <SetupNotice />
        <SiteHeader />
        <TourBar />
        <TeamRuleRegistry rules={teamRules} />
        {children}
      </body>
    </html>
  );
}
