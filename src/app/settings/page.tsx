"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Rule } from "@/types";
import { GeneralTab } from "./_components/general-tab";
import { IntegrationsTab } from "./_components/integrations-tab";
import { SecurityTab } from "./_components/security-tab";
import { DataTab } from "./_components/data-tab";
import { TasksTab } from "./_components/tasks-tab";
import { RulesTab } from "./_components/rules-tab";
import { LinkHealthTab } from "./_components/link-health-tab";
import { DuplicatesTab } from "./_components/duplicates-tab";
import { toast } from "sonner";

type TabType = "general" | "integrations" | "security" | "data" | "tasks" | "rules" | "link-health" | "duplicates";

const TABS: { id: TabType; label: string; description: string }[] = [
    { id: "general", label: "General", description: "Display and behavior settings" },
    { id: "rules", label: "Rules", description: "Automate actions when bookmarks are saved" },
    { id: "integrations", label: "Integrations", description: "Connect external services" },
    { id: "security", label: "Security", description: "Manage your credentials" },
    { id: "data", label: "Data Management", description: "Import and export your data" },
    { id: "tasks", label: "Background Tasks", description: "Monitor active and pending jobs" },
    { id: "link-health", label: "Link Health", description: "Find and clean up broken bookmarks" },
    { id: "duplicates", label: "Duplicates", description: "Find and merge duplicate bookmarks" },
];

function SettingsContent() {
    const searchParams = useSearchParams();
    const [activeTab, setActiveTab] = useState<TabType>("general");
    const { setOpenMobile } = useSidebar();

    // Force close the mobile sidebar sheet on mount to prevent the
    // Radix overlay from getting stuck and blocking all touch events.
    useEffect(() => {
        setOpenMobile(false);
    }, [setOpenMobile]);

    useEffect(() => {
        const tab = searchParams.get("tab") as TabType;
        if (tab && TABS.map(t => t.id).includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    // Shared state across tabs
    const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0, nsfw: 0 });
    const [domainColors, setDomainColors] = useState<{ domain: string; color: string }[]>([]);
    const [nsfwDisplay, setNsfwDisplay] = useState<"blur" | "hide" | "show">("blur");
    const [bookmarkClickAction, setBookmarkClickAction] = useState<"current" | "new">("new");
    const [email, setEmail] = useState("");
    const [apiTokens, setApiTokens] = useState<any[]>([]);
    const [githubConfigured, setGithubConfigured] = useState(false);
    const [githubSyncEnabled, setGithubSyncEnabled] = useState(false);
    const [lastGithubSync, setLastGithubSync] = useState<string | null>(null);
    const [redditConfigured, setRedditConfigured] = useState(false);
    const [redditSyncEnabled, setRedditSyncEnabled] = useState(false);
    const [lastRedditSync, setLastRedditSync] = useState<string | null>(null);
    const [telegramStatus, setTelegramStatus] = useState({ isLinked: false, botUsername: "", botConfigured: false, webhookRegistered: false, webhookUrl: null as string | null });
    const [taskStats, setTaskStats] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [linkCheckEnabled, setLinkCheckEnabled] = useState(false);
    const [linkCheckInterval, setLinkCheckInterval] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
    const [linkCheckIntervalDays, setLinkCheckIntervalDays] = useState(7);
    const [lastLinkCheckAt, setLastLinkCheckAt] = useState<string | null>(null);
    const [brokenBookmarks, setBrokenBookmarks] = useState<any[]>([]);
    const [rules, setRules] = useState<Rule[]>([]);
    const [existingTags, setExistingTags] = useState<{ id: string; name: string }[]>([]);
    const [existingCollections, setExistingCollections] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        // Bookmark counts
        Promise.all([
            fetch("/api/bookmarks?limit=0"), fetch("/api/bookmarks?filter=readlater&limit=0"),
            fetch("/api/bookmarks?filter=archived&limit=0"), fetch("/api/bookmarks?nsfw=only&limit=0"),
        ]).then(async ([allRes, rlRes, arcRes, nsfwRes]) => {
            const [allData, rlData, arcData, nsfwData] = await Promise.all([allRes.json(), rlRes.json(), arcRes.json(), nsfwRes.json()]);
            setCounts({ all: allData.total || 0, readLater: rlData.total || 0, archived: arcData.total || 0, nsfw: nsfwData.total || 0 });
        }).catch(() => { });

        // Integration settings
        fetch("/api/settings/github").then(r => r.json()).then(d => { setGithubConfigured(d.configured || false); setGithubSyncEnabled(d.syncEnabled || false); setLastGithubSync(d.lastSync || null); });
        fetch("/api/settings/reddit").then(r => r.json()).then(d => { setRedditConfigured(d.configured || false); setLastRedditSync(d.lastSync || null); setRedditSyncEnabled(d.syncEnabled || false); });
        fetch("/api/settings/telegram").then(r => r.json()).then(d => setTelegramStatus(d));
        fetch("/api/settings/domain-colors").then(r => r.json()).then(d => setDomainColors(d));
        fetch("/api/settings/email").then(r => r.json()).then(d => setEmail(d.email || ""));
        fetch("/api/tokens").then(r => r.json()).then(d => setApiTokens(Array.isArray(d) ? d : []));

        // NSFW display mode from localStorage (client-side preference)
        const savedNsfw = localStorage.getItem("nsfw-display-mode") as "blur" | "hide" | "show" | null;
        if (savedNsfw && ["blur", "hide", "show"].includes(savedNsfw)) setNsfwDisplay(savedNsfw);

        // Bookmark click action from localStorage
        const savedClickAction = localStorage.getItem("bookmark-click-action") as "current" | "new" | null;
        if (savedClickAction && ["current", "new"].includes(savedClickAction)) setBookmarkClickAction(savedClickAction);

        // Rules & autocomplete data
        fetch("/api/rules").then(r => r.json()).then(d => setRules(d.rules || [])).catch(() => { });
        fetch("/api/collections").then(r => r.json()).then(d => setExistingCollections(Array.isArray(d) ? d : []));
        fetch("/api/tags").then(r => r.json()).then(d => setExistingTags(Array.isArray(d) ? d : []));

        // Task polling
        const fetchTasks = () => fetch("/api/tasks").then(r => r.json()).then(d => setTaskStats(d)).catch(() => { });
        fetchTasks();
        const taskInterval = setInterval(fetchTasks, 3000);

        // Link health polling
        const fetchLinkHealth = () => {
            fetch("/api/settings/link-check").then(r => r.json()).then(d => {
                setLinkCheckEnabled(d.enabled ?? false); setLinkCheckInterval(d.interval ?? 'weekly');
                setLinkCheckIntervalDays(d.intervalDays ?? 7); setLastLinkCheckAt(d.lastCheckedAt ?? null);
            }).catch(() => { });
            fetch("/api/bookmarks/broken").then(r => r.json()).then(d => setBrokenBookmarks(Array.isArray(d) ? d : [])).catch(() => { });
        };
        fetchLinkHealth();
        const linkHealthInterval = setInterval(fetchLinkHealth, 10000);

        return () => { clearInterval(taskInterval); clearInterval(linkHealthInterval); };
    }, []);

    // Shared task action handlers lifted here so they can be passed to TasksTab and LinkHealthTab
    const handleRetryFailed = async () => {
        setIsRetrying(true);
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "retry_failed" }) });
            if (res.ok) toast.success("Retrying failed tasks");
        } catch { toast.error("Failed to retry tasks"); }
        setIsRetrying(false);
    };

    const handleClearTasks = async (action: 'clear_completed' | 'clear_all') => {
        setIsClearing(true);
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
            if (res.ok) toast.success("Tasks cleared");
        } catch { toast.error("Failed to clear tasks"); }
        setIsClearing(false);
    };

    const handleStartBulkJob = async (jobType: 'backfill_thumbnails' | 'backfill_embeddings', overwrite?: boolean) => {
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: jobType, overwrite: overwrite ?? false }) });
            if (res.ok) toast.success("Job started");
            else { const d = await res.json(); toast.error(d.error || "Failed to start job"); }
        } catch { toast.error("Failed to start job"); }
    };

    const handleCancelJob = async (jobId: string) => {
        try {
            const res = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel_job", jobId }) });
            if (res.ok) toast.success("Job cancelled");
        } catch { toast.error("Failed to cancel job"); }
    };

    const activeTabMeta = TABS.find(t => t.id === activeTab);

    return (
        <AppLayout bookmarkCounts={counts}>
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
                <h1 className="text-lg font-semibold flex items-center gap-2">Settings</h1>
            </header>

            <main className="flex-1 p-4 md:p-10">
                <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-400">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{activeTabMeta?.label}</h2>
                        <p className="text-muted-foreground">{activeTabMeta?.description}</p>
                    </div>

                    <Separator className="bg-border/40" />

                    {/* Tab Content */}
                    {activeTab === "general" && (
                        <GeneralTab
                            nsfwDisplay={nsfwDisplay}
                            setNsfwDisplay={setNsfwDisplay}
                            bookmarkClickAction={bookmarkClickAction}
                            setBookmarkClickAction={setBookmarkClickAction}
                        />
                    )}

                    {activeTab === "integrations" && (
                        <IntegrationsTab
                            githubConfigured={githubConfigured}
                            githubSyncEnabled={githubSyncEnabled}
                            setGithubSyncEnabled={setGithubSyncEnabled}
                            lastGithubSync={lastGithubSync}
                            redditConfigured={redditConfigured}
                            redditSyncEnabled={redditSyncEnabled}
                            setRedditSyncEnabled={setRedditSyncEnabled}
                            lastRedditSync={lastRedditSync}
                            telegramStatus={telegramStatus}
                            setTelegramStatus={setTelegramStatus}
                        />
                    )}

                    {activeTab === "security" && (
                        <SecurityTab
                            email={email}
                            setEmail={setEmail}
                            apiTokens={apiTokens}
                            setApiTokens={setApiTokens}
                        />
                    )}

                    {activeTab === "data" && <DataTab />}

                    {activeTab === "tasks" && (
                        <TasksTab
                            taskStats={taskStats}
                            onRetryFailed={handleRetryFailed}
                            onClearTasks={handleClearTasks}
                            onStartBulkJob={handleStartBulkJob}
                            onCancelJob={handleCancelJob}
                            isRetrying={isRetrying}
                            isClearing={isClearing}
                        />
                    )}

                    {activeTab === "rules" && (
                        <RulesTab
                            rules={rules}
                            setRules={setRules}
                            existingTags={existingTags}
                            existingCollections={existingCollections}
                            domainColors={domainColors}
                            setDomainColors={setDomainColors}
                        />
                    )}

                    {activeTab === "link-health" && (
                        <LinkHealthTab
                            linkCheckEnabled={linkCheckEnabled}
                            setLinkCheckEnabled={setLinkCheckEnabled}
                            linkCheckInterval={linkCheckInterval}
                            setLinkCheckInterval={setLinkCheckInterval}
                            linkCheckIntervalDays={linkCheckIntervalDays}
                            setLinkCheckIntervalDays={setLinkCheckIntervalDays}
                            lastLinkCheckAt={lastLinkCheckAt}
                            brokenBookmarks={brokenBookmarks}
                            setBrokenBookmarks={setBrokenBookmarks}
                            taskStats={taskStats}
                            onCancelJob={handleCancelJob}
                        />
                    )}

                    {activeTab === "duplicates" && (
                        <DuplicatesTab />
                    )}
                </div>
            </main>
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
