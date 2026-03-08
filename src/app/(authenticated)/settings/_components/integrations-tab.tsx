"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Github, Rss, Send, RefreshCw, ShieldCheck, Check, AlertTriangle, Copy, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface IntegrationsTabProps {
    githubConfigured: boolean;
    githubSyncEnabled: boolean;
    setGithubSyncEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    lastGithubSync: string | null;
    redditConfigured: boolean;
    redditSyncEnabled: boolean;
    setRedditSyncEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    lastRedditSync: string | null;
    telegramStatus: { isLinked: boolean; botUsername: string; botConfigured: boolean; webhookRegistered: boolean; webhookUrl: string | null };
    setTelegramStatus: React.Dispatch<React.SetStateAction<any>>;
}

export function IntegrationsTab({
    githubConfigured, githubSyncEnabled, setGithubSyncEnabled, lastGithubSync,
    redditConfigured, redditSyncEnabled, setRedditSyncEnabled, lastRedditSync,
    telegramStatus, setTelegramStatus,
}: IntegrationsTabProps) {
    const [syncingStars, setSyncingStars] = useState(false);
    const [syncingReddit, setSyncingReddit] = useState(false);
    const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
    const [isGeneratingTelegramToken, setIsGeneratingTelegramToken] = useState(false);
    const [linkingToken, setLinkingToken] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedToken(text);
        toast.success("Token copied to clipboard");
        setTimeout(() => setCopiedToken(null), 2000);
    };

    const handleToggleGithubSync = async (enabled: boolean) => {
        setGithubSyncEnabled(enabled);
        try {
            await fetch("/api/settings/github", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ syncEnabled: enabled }) });
        } catch { /* background fail */ }
    };

    const handleSyncStars = async () => {
        if (!githubConfigured) { toast.error("Set GITHUB_TOKEN in .env first"); return; }
        setSyncingStars(true);
        try {
            const res = await fetch("/api/github/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) toast.success("Sync job started in background");
            else toast.error(data.error || "Sync failed");
        } catch { toast.error("Sync failed"); }
        setSyncingStars(false);
    };

    const handleToggleRedditSync = async (enabled: boolean) => {
        setRedditSyncEnabled(enabled);
        try {
            await fetch("/api/settings/reddit", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ syncEnabled: enabled }) });
        } catch { /* background fail */ }
    };

    const handleSyncReddit = async () => {
        if (!redditConfigured) { toast.error("Set REDDIT_RSS_URL in .env first"); return; }
        setSyncingReddit(true);
        try {
            const res = await fetch("/api/reddit/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) toast.success("Sync job started in background");
            else toast.error(data.error || "Sync failed");
        } catch { toast.error("Sync failed"); }
        setSyncingReddit(false);
    };

    const handleRegisterWebhook = async () => {
        setIsRegisteringWebhook(true);
        try {
            const res = await fetch("/api/settings/telegram", { method: "PUT" });
            const data = await res.json();
            if (res.ok) { toast.success("Webhook registered successfully!"); setTelegramStatus((prev: any) => ({ ...prev, webhookRegistered: true })); }
            else toast.error(data.error || "Failed to register webhook");
        } catch { toast.error("Failed to register webhook"); }
        setIsRegisteringWebhook(false);
    };

    const handleGenerateTelegramToken = async () => {
        setIsGeneratingTelegramToken(true);
        try {
            const res = await fetch("/api/settings/telegram", { method: "POST" });
            const data = await res.json();
            if (res.ok) { setLinkingToken(data.token); toast.success("Telegram token generated"); }
        } catch { toast.error("Failed to generate token"); }
        setIsGeneratingTelegramToken(false);
    };

    const handleUnlinkTelegram = async () => {
        try {
            const res = await fetch("/api/settings/telegram", { method: "DELETE" });
            if (res.ok) { setTelegramStatus({ ...telegramStatus, isLinked: false }); toast.success("Telegram account unlinked"); }
        } catch { toast.error("Failed to unlink Telegram"); }
        setUnlinkDialogOpen(false);
    };

    return (
        <div className="space-y-6">
            {/* Top row: GitHub + Reddit side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* GitHub Card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
                    <div className="absolute top-0 right-0 p-4">
                        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", githubConfigured && githubSyncEnabled ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground")}>
                            {githubConfigured && githubSyncEnabled ? "Active" : "Disabled"}
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
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Personal Access Token</Label>
                                <div className={cn("flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full", githubConfigured ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                                    {githubConfigured ? <><Check className="h-3 w-3" /> Configured in .env</> : <>Set <code className="font-mono">GITHUB_TOKEN</code> in .env</>}
                                </div>
                            </div>
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3" />
                                Requires <code className="bg-muted px-1 rounded">public_repo</code> or <code className="bg-muted px-1 rounded">repo</code> scope.
                            </p>
                            <div className="flex items-center justify-between pt-2">
                                <Label htmlFor="github-sync-toggle" className="text-xs font-normal text-muted-foreground cursor-pointer">
                                    Enable automatic background sync (every hour)
                                </Label>
                                <Switch id="github-sync-toggle" checked={githubSyncEnabled} disabled={!githubConfigured} onCheckedChange={handleToggleGithubSync} />
                            </div>
                        </div>
                        <Button variant="secondary" className="w-full h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium" onClick={handleSyncStars} disabled={syncingStars || !githubConfigured}>
                            {syncingStars ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            Sync Starred Repositories
                        </Button>
                        <div className="flex justify-between items-center px-1">
                            <p className="text-[10px] text-muted-foreground italic">Syncs automatically every hour</p>
                            {lastGithubSync && (
                                <p className="text-[10px] text-muted-foreground">
                                    Last synced: {new Date(lastGithubSync + "Z").toLocaleString(undefined, { timeZone: process.env.TIMEZONE || undefined })}
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Reddit Card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
                    <div className="absolute top-0 right-0 p-4">
                        <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", redditConfigured && redditSyncEnabled ? "bg-orange-500/10 text-orange-500" : "bg-muted text-muted-foreground")}>
                            {redditConfigured && redditSyncEnabled ? "Active" : "Disabled"}
                        </div>
                    </div>
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <div className="w-12 h-12 rounded-2xl bg-[#ff4500] flex items-center justify-center shadow-lg">
                            <Rss className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle>Reddit</CardTitle>
                            <CardDescription>Sync your saved posts via private RSS feed.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-sm">Private RSS Feed URL</Label>
                                <div className={cn("flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full", redditConfigured ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
                                    {redditConfigured ? <><Check className="h-3 w-3" /> Configured in .env</> : <>Set <code className="font-mono">REDDIT_RSS_URL</code> in .env</>}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/10 space-y-2">
                                <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Find your private RSS key in <a href="https://www.reddit.com/prefs/feeds/" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline font-medium">Reddit Preferences &gt; Feeds</a>. Look for the "RSS" button next to "your saved links".
                                </p>
                            </div>
                            <div className="flex items-center justify-between py-1">
                                <Label htmlFor="reddit-sync-toggle" className="text-xs font-normal text-muted-foreground cursor-pointer">
                                    Enable automatic background sync (every hour)
                                </Label>
                                <Switch id="reddit-sync-toggle" checked={redditSyncEnabled} disabled={!redditConfigured} onCheckedChange={handleToggleRedditSync} />
                            </div>
                            <Button variant="secondary" className="w-full h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium" onClick={handleSyncReddit} disabled={syncingReddit || !redditConfigured}>
                                {syncingReddit ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                Sync Saved Posts
                            </Button>
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] text-muted-foreground italic">Syncs automatically every hour</p>
                                {lastRedditSync && (
                                    <p className="text-[10px] text-muted-foreground">
                                        Last synced: {new Date(lastRedditSync + "Z").toLocaleString(undefined, { timeZone: process.env.TIMEZONE || undefined })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>{/* end top grid row */}

            {/* Telegram Card — full width */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                    <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", telegramStatus.isLinked ? "bg-emerald-500/10 text-emerald-500" : "bg-muted text-muted-foreground")}>
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
                    {telegramStatus.botConfigured && (
                        <div className={`flex items-center justify-between p-3 rounded-xl border ${telegramStatus.webhookRegistered ? "bg-emerald-500/5 border-emerald-500/10" : "bg-amber-500/5 border-amber-500/10"}`}>
                            <div className="flex items-center gap-2.5">
                                {telegramStatus.webhookRegistered ? <Check className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />}
                                <div>
                                    <p className={`text-xs font-medium ${telegramStatus.webhookRegistered ? "text-emerald-500" : "text-amber-500"}`}>
                                        {telegramStatus.webhookRegistered ? "Webhook active" : "Webhook not registered"}
                                    </p>
                                    <p className="text-[10px] text-muted-foreground">
                                        {telegramStatus.webhookRegistered ? "Bot is receiving updates via your app URL" : "Register the webhook so the bot can receive messages"}
                                    </p>
                                </div>
                            </div>
                            <Button size="sm" variant={telegramStatus.webhookRegistered ? "ghost" : "outline"} onClick={handleRegisterWebhook} disabled={isRegisteringWebhook}
                                className={cn("shrink-0 h-8 text-[11px] gap-1.5 cursor-pointer", !telegramStatus.webhookRegistered && "border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500")}>
                                {isRegisteringWebhook ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                {telegramStatus.webhookRegistered ? "Re-register" : "Register Webhook"}
                            </Button>
                        </div>
                    )}
                    {!telegramStatus.botConfigured && (
                        <div className="p-3 rounded-xl bg-muted/30 border border-border/20">
                            <p className="text-[11px] text-muted-foreground">
                                Set <code className="bg-muted px-1 rounded">TELEGRAM_BOT_TOKEN</code> in your <code className="bg-muted px-1 rounded">.env</code> to enable webhook management.
                            </p>
                        </div>
                    )}
                    {telegramStatus.isLinked ? (
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-sm font-medium">Your Telegram account is connected</span>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => setUnlinkDialogOpen(true)} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">Unlink</Button>
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                                Open <a href={`https://t.me/${telegramStatus.botUsername}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">@{telegramStatus.botUsername}</a> and send any link to save it.
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">To link your account, click the button below to generate a linking token and then send it to the bot.</p>
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
                                <Button onClick={handleGenerateTelegramToken} disabled={isGeneratingTelegramToken} className="w-full gap-2">
                                    {isGeneratingTelegramToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                                    Generate Linking Token
                                </Button>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Dialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Unlink Telegram</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to unlink your Telegram account? You will no longer be able to save bookmarks via the bot until you re-link.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:justify-end">
                        <Button variant="outline" onClick={() => setUnlinkDialogOpen(false)} className="cursor-pointer">Cancel</Button>
                        <Button variant="destructive" onClick={handleUnlinkTelegram} className="cursor-pointer">Unlink</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Placeholder integrations */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                    { name: "Browser Extension", desc: "Sync directly from your browser" },
                    { name: "Readwise", desc: "Import your highlights and notes" },
                ].map((item) => (
                    <Card key={item.name} className="border-border/40 bg-card/20 opacity-60 grayscale cursor-not-allowed">
                        <CardContent className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <RefreshCw className="h-5 w-5 text-muted-foreground" />
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
    );
}
