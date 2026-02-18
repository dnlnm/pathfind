"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

interface AppLayoutProps {
    children: React.ReactNode;
    bookmarkCounts?: { all: number; readLater: number; archived: number };
    refreshTrigger?: number;
}

export function AppLayout({
    children,
    bookmarkCounts = { all: 0, readLater: 0, archived: 0 },
    refreshTrigger,
}: AppLayoutProps) {
    return (
        <SidebarProvider>
            <AppSidebar bookmarkCounts={bookmarkCounts} refreshTrigger={refreshTrigger} />
            <SidebarInset>
                {children}
            </SidebarInset>
        </SidebarProvider>
    );
}
