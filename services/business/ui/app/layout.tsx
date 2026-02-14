import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AgentProvider } from "@/components/agent-context";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "YARA Agent Control",
  description: "Manage YARA scanning agents and push rules",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${jakarta.variable} h-full bg-slate-950 font-sans text-slate-100 antialiased`}>
        <AgentProvider>{children}</AgentProvider>
      </body>
    </html>
  );
}
