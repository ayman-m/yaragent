import type { Metadata } from "next";
import "./globals.css";
import { AgentProvider } from "@/components/agent-context";

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
    <html lang="en" className="h-full overflow-hidden">
      <body className="h-full overflow-hidden bg-slate-950 font-sans text-slate-100">
        <AgentProvider>{children}</AgentProvider>
      </body>
    </html>
  );
}
