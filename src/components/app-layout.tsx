"use client";

import { SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

interface AppLayoutProps {
    children: React.ReactNode;
    bookmarkCounts?: { all: number; readLater: number; archived: number };
    refreshTrigger?: number;
}

export function AppLayout({
    children,
    bookmarkCounts,
    refreshTrigger,
}: AppLayoutProps) {
    return (
        <>
            <AppSidebar bookmarkCounts={bookmarkCounts} refreshTrigger={refreshTrigger} />
            <SidebarInset>
                {children}
            </SidebarInset>
        </>
    );
}
