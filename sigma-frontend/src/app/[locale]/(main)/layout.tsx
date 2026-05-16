import type { ReactNode } from "react";

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
        <Navbar />
        <PageTransition>
          <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        </PageTransition>
      </div>
    </ProtectedRoute>
  );
}
