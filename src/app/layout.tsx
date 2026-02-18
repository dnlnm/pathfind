import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "@/components/service-worker-registration";

export const metadata: Metadata = {
    title: "Pathfind",
    description: "Your personal bookmark manager",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark" suppressHydrationWarning>
            <head>
                <meta name="theme-color" content="#09090b" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="Pathfind" />
                <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
            </head>
            <body>
                <ServiceWorkerRegistration />
                {children}
            </body>
        </html>
    );
}
