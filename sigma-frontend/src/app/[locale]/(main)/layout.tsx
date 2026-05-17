import type { ReactNode } from "react";

import { MarketTickerStrip } from "@/components/MarketTickerStrip";
import { Navbar } from "@/components/Navbar";
import { PageTransition } from "@/components/PageTransition";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-sigma-bg pb-20 md:pb-0">
        <MarketTickerStrip />
        <Navbar />
        <PageTransition>
          <main className="mx-auto w-full max-w-[1600px] px-3 py-8 sm:px-4 lg:px-6">{children}</main>
        </PageTransition>
      </div>
    </ProtectedRoute>
  );
}
