"use client";

import { useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Download, Upload, Loader2, Github, RefreshCw } from "lucide-react";
import { useEffect } from "react";

function SettingsContent() {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [importing, setImporting] = useState(false);
    const [githubToken, setGithubToken] = useState("");
    const [savingToken, setSavingToken] = useState(false);
    const [syncingStars, setSyncingStars] = useState(false);

    useEffect(() => {
        // Fetch GitHub token on load
        fetch("/api/settings/github")
            .then(res => res.json())
            .then(data => setGithubToken(data.token || ""));
    }, []);

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        if (newPassword.length < 4) {
            toast.error("Password must be at least 4 characters");
            return;
        }

        setChangingPassword(true);
        try {
            const res = await fetch("/api/settings/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });

            if (res.ok) {
                toast.success("Password updated");
                setCurrentPassword("");
                setNewPassword("");
                setConfirmPassword("");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to change password");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setChangingPassword(false);
    };

    const handleExport = async () => {
        try {
            const res = await fetch("/api/import-export");
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pathfind-bookmarks-${new Date().toISOString().split("T")[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success("Bookmarks exported");
            }
        } catch {
            toast.error("Export failed");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setImporting(true);
        try {
            const text = await file.text();
            const res = await fetch("/api/import-export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ html: text }),
            });

            if (res.ok) {
                const data = await res.json();
                toast.success(`Imported ${data.count} bookmarks`);
                router.refresh();
            } else {
                toast.error("Import failed");
            }
        } catch {
            toast.error("Import failed");
        }
        setImporting(false);
        e.target.value = "";
    };

    const handleSaveGithubToken = async () => {
        setSavingToken(true);
        try {
            const res = await fetch("/api/settings/github", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token: githubToken }),
            });
            if (res.ok) {
                toast.success("GitHub token saved");
            } else {
                toast.error("Failed to save token");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSavingToken(false);
    };

    const handleSyncStars = async () => {
        if (!githubToken) {
            toast.error("Please save your GitHub token first");
            return;
        }

        setSyncingStars(true);
        try {
            const res = await fetch("/api/github/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Synced ${data.count} new repositories`);
            } else {
                toast.error(data.error || "Sync failed");
            }
        } catch {
            toast.error("Sync failed");
        }
        setSyncingStars(false);
    };

    return (
        <SidebarProvider>
            <AppSidebar bookmarkCounts={{ all: 0, readLater: 0, archived: 0 }} />
            <SidebarInset>
                <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
                    <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
                    <h1 className="text-lg font-semibold">Settings</h1>
                </header>

                <main className="flex-1 p-4 md:p-6 max-w-2xl mx-auto w-full space-y-6">
                    {/* Password Change */}
                    <Card className="border-border/40 bg-card/50">
                        <CardHeader>
                            <CardTitle>Change Password</CardTitle>
                            <CardDescription>Update your account password</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={handlePasswordChange} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="current-password">Current Password</Label>
                                    <Input
                                        id="current-password"
                                        type="password"
                                        value={currentPassword}
                                        onChange={(e) => setCurrentPassword(e.target.value)}
                                        required
                                        className="bg-background/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-password">New Password</Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        className="bg-background/50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                                    <Input
                                        id="confirm-password"
                                        type="password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        className="bg-background/50"
                                    />
                                </div>
                                <Button type="submit" disabled={changingPassword} className="cursor-pointer">
                                    {changingPassword ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Updating…
                                        </span>
                                    ) : (
                                        "Update Password"
                                    )}
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Separator className="bg-border/30" />

                    {/* GitHub Integration */}
                    <Card className="border-border/40 bg-card/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Github className="h-5 w-5" />
                                GitHub Integration
                            </CardTitle>
                            <CardDescription>
                                Automatically sync your starred repositories as bookmarks
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="github-token">Personal Access Token</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="github-token"
                                        type="password"
                                        placeholder="ghp_xxxxxxxxxxxx"
                                        value={githubToken}
                                        onChange={(e) => setGithubToken(e.target.value)}
                                        className="bg-background/50"
                                    />
                                    <Button
                                        onClick={handleSaveGithubToken}
                                        disabled={savingToken}
                                        className="cursor-pointer shrink-0"
                                    >
                                        {savingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                    </Button>
                                </div>
                                <p className="text-[10px] text-muted-foreground mt-1">
                                    Requires a token with <code className="bg-muted px-1 rounded">public_repo</code> or <code className="bg-muted px-1 rounded">repo</code> scope.
                                </p>
                            </div>

                            <Button
                                variant="secondary"
                                className="w-full gap-2 cursor-pointer"
                                onClick={handleSyncStars}
                                disabled={syncingStars || !githubToken}
                            >
                                {syncingStars ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <RefreshCw className="h-4 w-4" />
                                )}
                                Sync My Starred Repos
                            </Button>
                        </CardContent>
                    </Card>

                    <Separator className="bg-border/30" />

                    {/* Import / Export */}
                    <Card className="border-border/40 bg-card/50">
                        <CardHeader>
                            <CardTitle>Import & Export</CardTitle>
                            <CardDescription>
                                Import bookmarks from Netscape HTML format or export your bookmarks
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-col sm:flex-row gap-3">
                                <Button variant="outline" onClick={handleExport} className="gap-2 cursor-pointer">
                                    <Download className="h-4 w-4" />
                                    Export Bookmarks
                                </Button>

                                <div className="relative">
                                    <input
                                        type="file"
                                        accept=".html,.htm"
                                        onChange={handleImport}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        id="import-file"
                                    />
                                    <Button variant="outline" asChild className="gap-2 cursor-pointer">
                                        <label htmlFor="import-file">
                                            {importing ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Upload className="h-4 w-4" />
                                            )}
                                            Import Bookmarks
                                        </label>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </SidebarInset>
        </SidebarProvider>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-screen">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
        }>
            <SettingsContent />
        </Suspense>
    );
}
