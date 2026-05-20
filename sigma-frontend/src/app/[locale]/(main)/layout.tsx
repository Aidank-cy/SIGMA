import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Sidebar } from "@/components/dashboard/sidebar";

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="min-h-screen pb-20 transition-all duration-300 md:pl-20 md:pb-0">
          {children}
        </main>
      </div>
    </ProtectedRoute>
  );
}
