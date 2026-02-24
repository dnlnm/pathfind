import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Pathfind",
    description: "Your personal bookmark manager",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
        capable: true,
        statusBarStyle: "default",
        title: "Pathfind",
    },
    formatDetection: {
        telephone: false,
    },
};

import { SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "sonner";

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <body>
                <SidebarProvider>
                    {children}
                </SidebarProvider>
                <Toaster richColors closeButton position="top-right" />
            </body>
        </html>
    );
}
