"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
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
import {
    Download,
    Upload,
    Loader2,
    Github,
    RefreshCw,
    Settings2,
    ShieldCheck,
    Database,
    Share2,
    Trash2,
    Plus,
    Lock,
    Mail,
    Key,
    Copy,
    Check,
    Send
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabType = "general" | "integrations" | "security" | "data";

function SettingsContent() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>("general");
    const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0 });

    // Form/Settings states
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [importing, setImporting] = useState(false);
    const [githubToken, setGithubToken] = useState("");
    const [savingToken, setSavingToken] = useState(false);
    const [syncingStars, setSyncingStars] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState({ isLinked: false, botUsername: "" });
    const [linkingToken, setLinkingToken] = useState<string | null>(null);
    const [isGeneratingTelegramToken, setIsGeneratingTelegramToken] = useState(false);
    const [paginationLimit, setPaginationLimit] = useState(30);
    const [savingLimit, setSavingLimit] = useState(false);
    const [domainColors, setDomainColors] = useState<{ domain: string; color: string }[]>([]);
    const [newDomain, setNewDomain] = useState("");
    const [newColor, setNewColor] = useState("#6366f1");
    const [addingColor, setAddingColor] = useState(false);
    const [email, setEmail] = useState("");
    const [savingEmail, setSavingEmail] = useState(false);
    const [apiTokens, setApiTokens] = useState<any[]>([]);
    const [newTokenName, setNewTokenName] = useState("");
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [allRes, readLaterRes, archivedRes] = await Promise.all([
                    fetch("/api/bookmarks?limit=0"),
                    fetch("/api/bookmarks?filter=readlater&limit=0"),
                    fetch("/api/bookmarks?filter=archived&limit=0"),
                ]);

                const [allData, readLaterData, archivedData] = await Promise.all([
                    allRes.json(),
                    readLaterRes.json(),
                    archivedRes.json(),
                ]);

                setCounts({
                    all: allData.total || 0,
                    readLater: readLaterData.total || 0,
                    archived: archivedData.total || 0,
                });
            } catch {
                // Silent fail
            }
        };

        fetchCounts();

        fetch("/api/settings/github")
            .then(res => res.json())
            .then(data => setGithubToken(data.token || ""));

        fetch("/api/settings/pagination")
            .then(res => res.json())
            .then(data => setPaginationLimit(data.limit || 30));

        fetch("/api/settings/domain-colors")
            .then(res => res.json())
            .then(data => setDomainColors(data));

        fetch("/api/settings/email")
            .then(res => res.json())
            .then(data => setEmail(data.email || ""));

        fetch("/api/tokens")
            .then(res => res.json())
            .then(data => setApiTokens(Array.isArray(data) ? data : []));

        fetch("/api/settings/telegram")
            .then(res => res.json())
            .then(data => setTelegramStatus(data));
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

    const handleSavePaginationLimit = async () => {
        setSavingLimit(true);
        try {
            const res = await fetch("/api/settings/pagination", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ limit: paginationLimit }),
            });
            if (res.ok) {
                toast.success("Pagination limit updated");
                router.refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update limit");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSavingLimit(false);
    };

    const handleAddDomainColor = async () => {
        if (!newDomain) return;
        setAddingColor(true);
        try {
            const res = await fetch("/api/settings/domain-colors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: newDomain, color: newColor }),
            });
            if (res.ok) {
                toast.success(`Color set for ${newDomain}`);
                const updated = await fetch("/api/settings/domain-colors").then(r => r.json());
                setDomainColors(updated);
                setNewDomain("");
            }
        } catch {
            toast.error("Failed to add domain color");
        }
        setAddingColor(false);
    };

    const handleDeleteDomainColor = async (domain: string) => {
        try {
            const res = await fetch("/api/settings/domain-colors", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain }),
            });
            if (res.ok) {
                setDomainColors(prev => prev.filter(dc => dc.domain !== domain));
                toast.success(`Removed color for ${domain}`);
            }
        } catch {
            toast.error("Failed to delete domain color");
        }
    };

    const handleSaveEmail = async () => {
        if (!email.includes("@")) {
            toast.error("Invalid email address");
            return;
        }

        setSavingEmail(true);
        try {
            const res = await fetch("/api/settings/email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                toast.success("Email updated");
                router.refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update email");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSavingEmail(false);
    };

    const handleCreateToken = async () => {
        if (!newTokenName) return;
        setIsCreatingToken(true);
        try {
            const res = await fetch("/api/tokens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTokenName }),
            });
            if (res.ok) {
                const data = await res.json();
                setNewlyCreatedToken(data.token);
                setApiTokens([data, ...apiTokens]);
                setNewTokenName("");
                toast.success("API token created");
            }
        } catch {
            toast.error("Failed to create token");
        }
        setIsCreatingToken(false);
    };

    const handleDeleteToken = async (id: string) => {
        try {
            const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
            if (res.ok) {
                setApiTokens(apiTokens.filter(t => t.id !== id));
                toast.success("Token revoked");
            }
        } catch {
            toast.error("Failed to revoke token");
        }
    };

    const handleGenerateTelegramToken = async () => {
        setIsGeneratingTelegramToken(true);
        try {
            const res = await fetch("/api/settings/telegram", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                setLinkingToken(data.token);
                toast.success("Telegram token generated");
            }
        } catch {
            toast.error("Failed to generate token");
        }
        setIsGeneratingTelegramToken(false);
    };

    const handleUnlinkTelegram = async () => {
        if (!confirm("Are you sure you want to unlink your Telegram account?")) return;
        try {
            const res = await fetch("/api/settings/telegram", { method: "DELETE" });
            if (res.ok) {
                setTelegramStatus({ ...telegramStatus, isLinked: false });
                toast.success("Telegram account unlinked");
            }
        } catch {
            toast.error("Failed to unlink Telegram");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedToken(text);
        toast.success("Token copied to clipboard");
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const tabs = [
        { id: "general" as TabType, label: "General", icon: Settings2, description: "Display and behavior settings" },
        { id: "integrations" as TabType, label: "Integrations", icon: Share2, description: "Connect external services" },
        { id: "security" as TabType, label: "Security", icon: ShieldCheck, description: "Manage your credentials" },
        { id: "data" as TabType, label: "Data Management", icon: Database, description: "Import and export your data" },
    ];

    return (
        <AppLayout bookmarkCounts={counts}>
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    Settings
                </h1>
            </header>

            <div className="flex flex-col md:flex-row h-[calc(100vh-57px)]">
                {/* Settings Navigation */}
                <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-border/40 p-4 md:p-6 space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 cursor-pointer text-left",
                                activeTab === tab.id
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                                    : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className={cn("h-4.5 w-4.5", activeTab === tab.id ? "text-primary-foreground" : "text-muted-foreground/70")} />
                            <div className="flex flex-col">
                                <span className="text-sm font-medium">{tab.label}</span>
                            </div>
                        </button>
                    ))}
                </aside>

                {/* Settings Content Area */}
                <main className="flex-1 overflow-y-auto p-4 md:p-10">
                    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">

                        {/* Page Header within Content */}
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </h2>
                            <p className="text-muted-foreground">
                                {tabs.find(t => t.id === activeTab)?.description}
                            </p>
                        </div>

                        <Separator className="bg-border/40" />

                        {activeTab === "general" && (
                            <div className="space-y-6">
                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Appearance</CardTitle>
                                        <CardDescription>Customize how PathFind looks and behaves for you.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="pagination-limit">Bookmarks per page</Label>
                                            <div className="flex gap-3">
                                                <Input
                                                    id="pagination-limit"
                                                    type="number"
                                                    min="1"
                                                    max="100"
                                                    value={paginationLimit}
                                                    onChange={(e) => setPaginationLimit(parseInt(e.target.value) || 0)}
                                                    className="bg-background/50 h-10"
                                                />
                                                <Button
                                                    onClick={handleSavePaginationLimit}
                                                    disabled={savingLimit}
                                                    className="cursor-pointer px-6"
                                                >
                                                    {savingLimit ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                                                </Button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground">
                                                Determines the number of items fetched during pagination (range: 1-100).
                                            </p>
                                        </div>

                                        <Separator className="bg-border/20" />

                                        <div className="space-y-4">
                                            <div className="flex flex-col gap-1">
                                                <Label>Custom Domain Colors</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Assign specific accent colors to domains for visual grouping.
                                                </p>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex gap-2">
                                                    <Input
                                                        placeholder="example.com"
                                                        value={newDomain}
                                                        onChange={(e) => setNewDomain(e.target.value)}
                                                        className="bg-background/50"
                                                    />
                                                    <div className="flex items-center gap-2 px-3 bg-background/50 border border-border/50 rounded-md h-10">
                                                        <input
                                                            type="color"
                                                            value={newColor}
                                                            onChange={(e) => setNewColor(e.target.value)}
                                                            className="w-6 h-6 border-0 bg-transparent cursor-pointer"
                                                        />
                                                        <code className="text-[10px] font-mono uppercase truncate w-14">{newColor}</code>
                                                    </div>
                                                    <Button
                                                        onClick={handleAddDomainColor}
                                                        disabled={addingColor || !newDomain}
                                                        className="cursor-pointer shrink-0"
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add
                                                    </Button>
                                                </div>

                                                {domainColors.length > 0 && (
                                                    <div className="grid grid-cols-1 gap-2 border border-border/20 rounded-xl p-2 bg-muted/20">
                                                        {domainColors.map((dc) => (
                                                            <div key={dc.domain} className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/30 hover:border-border transition-colors">
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className="w-3.5 h-3.5 rounded-full border border-white/10 shadow-sm"
                                                                        style={{ backgroundColor: dc.color }}
                                                                    />
                                                                    <span className="text-sm font-medium tracking-tight">{dc.domain}</span>
                                                                </div>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteDomainColor(dc.domain)}
                                                                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "integrations" && (
                            <div className="space-y-6">
                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className="bg-blue-500/10 text-blue-500 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                            Active
                                        </div>
                                    </div>
                                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                        <div className="w-12 h-12 rounded-2xl bg-[#24292f] flex items-center justify-center shadow-lg">
                                            <Github className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle>GitHub</CardTitle>
                                            <CardDescription>Sync your starred repositories automatically.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="github-token">Personal Access Token</Label>
                                            <div className="flex gap-3">
                                                <Input
                                                    id="github-token"
                                                    type="password"
                                                    placeholder="ghp_xxxxxxxxxxxx"
                                                    value={githubToken}
                                                    onChange={(e) => setGithubToken(e.target.value)}
                                                    className="bg-background/50 h-10"
                                                />
                                                <Button
                                                    onClick={handleSaveGithubToken}
                                                    disabled={savingToken}
                                                    className="cursor-pointer px-6"
                                                >
                                                    {savingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                                </Button>
                                            </div>
                                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                                <ShieldCheck className="h-3 w-3" />
                                                Requires <code className="bg-muted px-1 rounded">public_repo</code> or <code className="bg-muted px-1 rounded">repo</code> scope.
                                            </p>
                                        </div>

                                        <Button
                                            variant="secondary"
                                            className="w-full h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium"
                                            onClick={handleSyncStars}
                                            disabled={syncingStars || !githubToken}
                                        >
                                            {syncingStars ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                            Sync Starred Repositories
                                        </Button>
                                    </CardContent>
                                </Card>

                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4">
                                        <div className={cn(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                            telegramStatus.isLinked ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground"
                                        )}>
                                            {telegramStatus.isLinked ? "Linked" : "Not Linked"}
                                        </div>
                                    </div>
                                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                                        <div className="w-12 h-12 rounded-2xl bg-[#0088cc] flex items-center justify-center shadow-lg">
                                            <Send className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle>Telegram Bot</CardTitle>
                                            <CardDescription>Save bookmarks by sending links to our bot.</CardDescription>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        {telegramStatus.isLinked ? (
                                            <div className="space-y-4">
                                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                                        <span className="text-sm font-medium">Your Telegram account is connected</span>
                                                    </div>
                                                    <Button variant="ghost" size="sm" onClick={handleUnlinkTelegram} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                                                        Unlink
                                                    </Button>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    Open <a href={`https://t.me/${telegramStatus.botUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@{telegramStatus.botUsername}</a> and send any link to save it.
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <p className="text-sm text-muted-foreground">
                                                    To link your account, click the button below to generate a linking token and then send it to the bot.
                                                </p>

                                                {linkingToken ? (
                                                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
                                                        <div className="text-xs font-bold text-primary uppercase tracking-wider">How to link:</div>
                                                        <ol className="text-xs space-y-2 list-decimal list-inside text-muted-foreground">
                                                            <li>Open <a href={`https://t.me/${telegramStatus.botUsername}?start=${linkingToken}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@{telegramStatus.botUsername}</a></li>
                                                            <li>Click "Start" or send the message <code>/start {linkingToken}</code></li>
                                                        </ol>
                                                        <div className="flex gap-2 pt-2">
                                                            <Input readOnly value={`/start ${linkingToken}`} className="font-mono text-xs bg-background/50" />
                                                            <Button size="icon" variant="outline" className="shrink-0" onClick={() => copyToClipboard(`/start ${linkingToken}`)}>
                                                                {copiedToken === `/start ${linkingToken}` ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        onClick={handleGenerateTelegramToken}
                                                        disabled={isGeneratingTelegramToken}
                                                        className="w-full gap-2"
                                                    >
                                                        {isGeneratingTelegramToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                                        Generate Linking Token
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>

                                {/* Placeholder for future integrations */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        { name: "Browser Extension", icon: Share2, desc: "Sync directly from your browser" },
                                        { name: "Readwise", icon: Share2, desc: "Import your highlights and notes" },
                                    ].map((item) => (
                                        <Card key={item.name} className="border-border/40 bg-card/20 opacity-60 grayscale cursor-not-allowed">
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                                    <item.icon className="h-5 w-5 text-muted-foreground" />
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-semibold">{item.name}</h4>
                                                    <p className="text-[11px] text-muted-foreground">Coming Soon</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === "security" && (
                            <div className="space-y-6">
                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                    <CardHeader>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                                <Mail className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <CardTitle className="text-lg">Email Address</CardTitle>
                                        </div>
                                        <CardDescription>Update the email associated with your account.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="email">Email address</Label>
                                            <div className="flex gap-3">
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    placeholder="you@example.com"
                                                    value={email}
                                                    onChange={(e) => setEmail(e.target.value)}
                                                    className="bg-background/50 h-10"
                                                />
                                                <Button
                                                    onClick={handleSaveEmail}
                                                    disabled={savingEmail}
                                                    className="cursor-pointer px-6"
                                                >
                                                    {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Separator className="bg-border/20" />

                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                    <CardHeader>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                                <Lock className="h-4 w-4 text-orange-500" />
                                            </div>
                                            <CardTitle className="text-lg">Change Password</CardTitle>
                                        </div>
                                        <CardDescription>Ensure your account is using a strong, unique password.</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <form onSubmit={handlePasswordChange} className="space-y-5">
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
                                            <Button type="submit" disabled={changingPassword} className="w-full sm:w-auto px-10 cursor-pointer">
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

                                <Separator className="bg-border/20" />

                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                    <CardHeader>
                                        <div className="flex items-center gap-3 mb-1">
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                                                <Key className="h-4 w-4 text-emerald-500" />
                                            </div>
                                            <CardTitle className="text-lg">API Tokens</CardTitle>
                                        </div>
                                        <CardDescription>Generate tokens for programmatic access to your bookmarks.</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="space-y-3">
                                            <Label htmlFor="token-name">New Token Name</Label>
                                            <div className="flex gap-3">
                                                <Input
                                                    id="token-name"
                                                    placeholder="e.g. Mobile App, GitHub Action"
                                                    value={newTokenName}
                                                    onChange={(e) => setNewTokenName(e.target.value)}
                                                    className="bg-background/50 h-10"
                                                />
                                                <Button
                                                    onClick={handleCreateToken}
                                                    disabled={isCreatingToken || !newTokenName}
                                                    className="cursor-pointer px-6"
                                                >
                                                    {isCreatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                                                </Button>
                                            </div>
                                        </div>

                                        {newlyCreatedToken && (
                                            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3 animate-in zoom-in-95 duration-300">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Token Created</span>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 text-[10px] hover:bg-emerald-500/20"
                                                        onClick={() => setNewlyCreatedToken(null)}
                                                    >
                                                        Dismiss
                                                    </Button>
                                                </div>
                                                <p className="text-[11px] text-emerald-400/80">
                                                    Make sure to copy your personal access token now. You won't be able to see it again!
                                                </p>
                                                <div className="flex gap-2">
                                                    <Input
                                                        readOnly
                                                        value={newlyCreatedToken}
                                                        className="font-mono text-xs bg-black/20 border-emerald-500/30"
                                                    />
                                                    <Button
                                                        size="icon"
                                                        variant="outline"
                                                        className="shrink-0 border-emerald-500/30 hover:bg-emerald-500/20"
                                                        onClick={() => copyToClipboard(newlyCreatedToken)}
                                                    >
                                                        {copiedToken === newlyCreatedToken ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}

                                        <Separator className="bg-border/20" />

                                        <div className="space-y-3">
                                            <h4 className="text-sm font-medium">Active Tokens</h4>
                                            {apiTokens.length === 0 ? (
                                                <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border/40 rounded-xl">
                                                    No active tokens found.
                                                </p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {apiTokens.map((token) => (
                                                        <div key={token.id} className="flex items-center justify-between p-3 rounded-xl bg-card/60 border border-border/30">
                                                            <div className="space-y-1">
                                                                <div className="text-sm font-medium">{token.name}</div>
                                                                <div className="flex items-center gap-2">
                                                                    <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{token.masked_token || 'pf_****...****'}</code>
                                                                    <span className="text-[10px] text-muted-foreground">
                                                                        Last used: {token.last_used_at ? new Date(token.last_used_at).toLocaleDateString() : 'Never'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDeleteToken(token.id)}
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {activeTab === "data" && (
                            <div className="space-y-6">
                                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                    <CardHeader>
                                        <CardTitle className="text-lg">Portability</CardTitle>
                                        <CardDescription>
                                            Move your data in and out of PathFind using standard formats.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div className="space-y-3 p-4 rounded-2xl border border-border/30 bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Upload className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-sm">Import</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Upload a Netscape HTML bookmark file (from Chrome, Safari, etc).
                                                </p>
                                                <div className="relative">
                                                    <input
                                                        type="file"
                                                        accept=".html,.htm"
                                                        onChange={handleImport}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        id="import-file"
                                                    />
                                                    <Button variant="outline" asChild className="w-full gap-2 cursor-pointer bg-background/50">
                                                        <label htmlFor="import-file">
                                                            {importing ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                <Upload className="h-4 w-4" />
                                                            )}
                                                            Choose File
                                                        </label>
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="space-y-3 p-4 rounded-2xl border border-border/30 bg-muted/30">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                                        <Download className="h-4 w-4" />
                                                    </div>
                                                    <span className="font-semibold text-sm">Export</span>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Download all your PathFind bookmarks as a standard HTML file.
                                                </p>
                                                <Button variant="outline" onClick={handleExport} className="w-full gap-2 cursor-pointer bg-background/50">
                                                    <Download className="h-4 w-4" />
                                                    Export All
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </AppLayout>
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
