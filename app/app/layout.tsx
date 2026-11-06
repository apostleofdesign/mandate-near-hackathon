import "./globals.css";
import { Geist_Mono, Instrument_Sans } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import SiteHeader from "@/components/SiteHeader";

const instrumentSansHeading = Instrument_Sans({subsets:['latin'],variable:'--font-heading'});

const geistMono = Geist_Mono({subsets:['latin'],variable:'--font-mono'});

export const metadata = {
  title: "Mandate — NEAR HACKATHON",
  description: "Policy-governed agent marketplace on NEAR.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-mono", geistMono.variable, instrumentSansHeading.variable)}>
      <body>
        <SiteHeader />
        {children}
        <Toaster />
      </body>
    </html>
  );
}
