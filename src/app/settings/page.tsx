"use client";

import { useState, Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    Send,
    Rss,
    Zap,
    X,
    ChevronDown,
    ChevronUp,
    Pencil,
    Image,
    Brain,
    Square,
    Link as LinkIcon,
    AlertTriangle,
    ShieldX,
    Play,
    CheckSquare,
} from "lucide-react";
import { Rule, RuleCondition, RuleAction, RuleEvent } from "@/types";
import { cn } from "@/lib/utils";

type TabType = "general" | "integrations" | "security" | "data" | "tasks" | "rules" | "link-health";

function SettingsContent() {
    const router = useRouter();
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
        if (tab && ["general", "integrations", "security", "data", "tasks", "rules", "link-health"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);
    const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0, nsfw: 0 });

    // Form/Settings states
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [importing, setImporting] = useState(false);
    const [githubConfigured, setGithubConfigured] = useState(false);
    const [lastGithubSync, setLastGithubSync] = useState<string | null>(null);
    const [savingToken, setSavingToken] = useState(false);
    const [redditConfigured, setRedditConfigured] = useState(false);
    const [lastRedditSync, setLastRedditSync] = useState<string | null>(null);
    const [savingReddit, setSavingReddit] = useState(false);
    const [syncingReddit, setSyncingReddit] = useState(false);
    const [syncingStars, setSyncingStars] = useState(false);
    const [githubSyncEnabled, setGithubSyncEnabled] = useState(false);
    const [redditSyncEnabled, setRedditSyncEnabled] = useState(false);
    const [telegramStatus, setTelegramStatus] = useState({ isLinked: false, botUsername: "", botConfigured: false, webhookRegistered: false, webhookUrl: null as string | null });
    const [linkingToken, setLinkingToken] = useState<string | null>(null);
    const [isGeneratingTelegramToken, setIsGeneratingTelegramToken] = useState(false);
    const [isRegisteringWebhook, setIsRegisteringWebhook] = useState(false);
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
    const [nsfwDisplay, setNsfwDisplay] = useState<"blur" | "hide" | "show">("blur");
    const [savingNsfw, setSavingNsfw] = useState(false);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [taskStats, setTaskStats] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState(false);
    const [isClearing, setIsClearing] = useState(false);

    // Link Health state
    const [linkCheckEnabled, setLinkCheckEnabled] = useState(false);
    const [linkCheckInterval, setLinkCheckInterval] = useState<'weekly' | 'monthly' | 'custom'>('weekly');
    const [linkCheckIntervalDays, setLinkCheckIntervalDays] = useState(7);
    const [lastLinkCheckAt, setLastLinkCheckAt] = useState<string | null>(null);
    const [savingLinkSchedule, setSavingLinkSchedule] = useState(false);
    const [isRunningLinkCheck, setIsRunningLinkCheck] = useState(false);
    const [brokenBookmarks, setBrokenBookmarks] = useState<{ id: string; url: string; title: string | null; favicon: string | null; link_status: string; link_status_code: number | null; link_checked_at: string | null }[]>([]);
    const [selectedBrokenIds, setSelectedBrokenIds] = useState<Set<string>>(new Set());
    const [isDeletingBroken, setIsDeletingBroken] = useState(false);

    // Rules state
    const [rules, setRules] = useState<Rule[]>([]);
    const [loadingRules, setLoadingRules] = useState(false);
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [ruleName, setRuleName] = useState("");
    const [ruleEvent, setRuleEvent] = useState<RuleEvent>("bookmark.created");
    const [ruleConditionLogic, setRuleConditionLogic] = useState<"AND" | "OR">("AND");
    const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([{ field: "url", operator: "contains", value: "" }]);
    const [ruleActions, setRuleActions] = useState<RuleAction[]>([{ type: "add_tags", params: { tags: [""] } }]);
    const [savingRule, setSavingRule] = useState(false);
    const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);
    const [existingTags, setExistingTags] = useState<{ id: string; name: string }[]>([]);
    const [existingCollections, setExistingCollections] = useState<{ id: string; name: string }[]>([]);

    useEffect(() => {
        const fetchCounts = async () => {
            try {
                const [allRes, readLaterRes, archivedRes, nsfwRes] = await Promise.all([
                    fetch("/api/bookmarks?limit=0"),
                    fetch("/api/bookmarks?filter=readlater&limit=0"),
                    fetch("/api/bookmarks?filter=archived&limit=0"),
                    fetch("/api/bookmarks?nsfw=only&limit=0"),
                ]);

                const [allData, readLaterData, archivedData, nsfwData] = await Promise.all([
                    allRes.json(),
                    readLaterRes.json(),
                    archivedRes.json(),
                    nsfwRes.json(),
                ]);

                setCounts({
                    all: allData.total || 0,
                    readLater: readLaterData.total || 0,
                    archived: archivedData.total || 0,
                    nsfw: nsfwData.total || 0,
                });
            } catch {
                // Silent fail
            }
        };

        fetchCounts();

        fetch("/api/settings/github")
            .then(res => res.json())
            .then(data => {
                setGithubConfigured(data.configured || false);
                setGithubSyncEnabled(data.syncEnabled || false);
                setLastGithubSync(data.lastSync || null);
            });

        fetch("/api/settings/reddit")
            .then(res => res.json())
            .then(data => {
                setRedditConfigured(data.configured || false);
                setLastRedditSync(data.lastSync || null);
                setRedditSyncEnabled(data.syncEnabled || false);
            });

        fetch("/api/settings/domain-colors")
            .then(res => res.json())
            .then(data => setDomainColors(data));

        fetch("/api/settings/email")
            .then(res => res.json())
            .then(data => setEmail(data.email || ""));

        fetch("/api/tokens")
            .then(res => res.json())
            .then(data => setApiTokens(Array.isArray(data) ? data : []));

        // Load NSFW display mode from localStorage (client-side preference)
        const savedNsfw = localStorage.getItem("nsfw-display-mode") as "blur" | "hide" | "show" | null;
        if (savedNsfw && ["blur", "hide", "show"].includes(savedNsfw)) {
            setNsfwDisplay(savedNsfw);
        }

        fetch("/api/settings/telegram")
            .then(res => res.json())
            .then(data => setTelegramStatus(data));

        // Fetch rules
        fetch("/api/rules")
            .then(res => res.json())
            .then(data => setRules(data.rules || []))
            .catch(() => { });

        const fetchTasks = () => {
            fetch("/api/tasks")
                .then(res => res.json())
                .then(data => setTaskStats(data))
                .catch(() => { });
        };
        fetchTasks();
        fetch("/api/collections")
            .then(res => res.json())
            .then(data => setExistingCollections(Array.isArray(data) ? data : []));

        fetch("/api/tags")
            .then(res => res.json())
            .then(data => setExistingTags(Array.isArray(data) ? data : []));

        const interval = setInterval(fetchTasks, 3000);

        // Fetch link health settings + broken bookmarks
        const fetchLinkHealth = () => {
            fetch("/api/settings/link-check")
                .then(res => res.json())
                .then(data => {
                    setLinkCheckEnabled(data.enabled ?? false);
                    setLinkCheckInterval(data.interval ?? 'weekly');
                    setLinkCheckIntervalDays(data.intervalDays ?? 7);
                    setLastLinkCheckAt(data.lastCheckedAt ?? null);
                })
                .catch(() => { });

            fetch("/api/bookmarks/broken")
                .then(res => res.json())
                .then(data => setBrokenBookmarks(Array.isArray(data) ? data : []))
                .catch(() => { });
        };
        fetchLinkHealth();
        const linkHealthInterval = setInterval(fetchLinkHealth, 10000);

        return () => {
            clearInterval(interval);
            clearInterval(linkHealthInterval);
        };
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

    const handleToggleGithubSync = async (enabled: boolean) => {
        setGithubSyncEnabled(enabled);
        try {
            await fetch("/api/settings/github", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncEnabled: enabled }),
            });
        } catch {
            // Background fail
        }
    };

    const handleSyncStars = async () => {
        if (!githubConfigured) {
            toast.error("Set GITHUB_TOKEN in .env first");
            return;
        }

        setSyncingStars(true);
        try {
            const res = await fetch("/api/github/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                toast.success("Sync job started in background");
            } else {
                toast.error(data.error || "Sync failed");
            }
        } catch {
            toast.error("Sync failed");
        }
        setSyncingStars(false);
    };

    const handleToggleRedditSync = async (enabled: boolean) => {
        setRedditSyncEnabled(enabled);
        try {
            await fetch("/api/settings/reddit", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ syncEnabled: enabled }),
            });
        } catch {
            // Background fail
        }
    };

    const handleSyncReddit = async () => {
        if (!redditConfigured) {
            toast.error("Set REDDIT_RSS_URL in .env first");
            return;
        }

        setSyncingReddit(true);
        try {
            const res = await fetch("/api/reddit/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                toast.success("Sync job started in background");
            } else {
                toast.error(data.error || "Sync failed");
            }
        } catch {
            toast.error("Sync failed");
        }
        setSyncingReddit(false);
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

    const handleSaveNsfwDisplay = (value: string) => {
        setNsfwDisplay(value as any);
        setSavingNsfw(true);
        try {
            localStorage.setItem("nsfw-display-mode", value);
            toast.success("NSFW setting updated");
        } catch {
            toast.error("Failed to update NSFW setting");
        }
        setSavingNsfw(false);
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

    const handleRegisterWebhook = async () => {
        setIsRegisteringWebhook(true);
        try {
            const res = await fetch("/api/settings/telegram", { method: "PUT" });
            const data = await res.json();
            if (res.ok) {
                toast.success("Webhook registered successfully!");
                setTelegramStatus(prev => ({ ...prev, webhookRegistered: true }));
            } else {
                toast.error(data.error || "Failed to register webhook");
            }
        } catch {
            toast.error("Failed to register webhook");
        }
        setIsRegisteringWebhook(false);
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

    const handleRetryFailed = async () => {
        setIsRetrying(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "retry_failed" }),
            });
            if (res.ok) {
                toast.success("Retrying failed tasks");
            }
        } catch {
            toast.error("Failed to retry tasks");
        }
        setIsRetrying(false);
    };

    const handleClearTasks = async (action: 'clear_completed' | 'clear_all') => {
        setIsClearing(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            if (res.ok) {
                toast.success("Tasks cleared");
            }
        } catch {
            toast.error("Failed to clear tasks");
        }
        setIsClearing(false);
    };

    const handleStartBulkJob = async (jobType: 'backfill_thumbnails' | 'backfill_embeddings', overwrite?: boolean) => {
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: jobType, overwrite: overwrite ?? false }),
            });
            if (res.ok) {
                toast.success("Job started");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to start job");
            }
        } catch {
            toast.error("Failed to start job");
        }
    };

    const handleCancelJob = async (jobId: string) => {
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "cancel_job", jobId }),
            });
            if (res.ok) {
                toast.success("Job cancelled");
            }
        } catch {
            toast.error("Failed to cancel job");
        }
    };

    // --- Rule Engine handlers ---
    const handleSaveRule = async () => {
        if (!ruleName.trim()) { toast.error("Rule name is required"); return; }
        if (ruleConditions.some(c => !c.value.trim())) { toast.error("All condition values are required"); return; }
        if (ruleActions.some(a => a.type === "add_tags" && (!a.params?.tags?.length || a.params.tags.some((t: string) => !t.trim())))) {
            toast.error("All tag values are required"); return;
        }
        if (ruleActions.some(a => a.type === "add_to_collection" && !a.params?.collectionName?.trim())) {
            toast.error("Collection name is required"); return;
        }

        setSavingRule(true);
        try {
            const url = editingRuleId ? `/api/rules/${editingRuleId}` : "/api/rules";
            const method = editingRuleId ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: ruleName.trim(),
                    event: ruleEvent,
                    conditionLogic: ruleConditionLogic,
                    conditions: ruleConditions,
                    actions: ruleActions,
                }),
            });
            if (res.ok) {
                const rule = await res.json();
                if (editingRuleId) {
                    setRules(prev => prev.map(r => r.id === editingRuleId ? rule : r));
                    toast.success("Rule updated");
                } else {
                    setRules(prev => [...prev, rule]);
                    toast.success("Rule created");
                }
                setShowRuleForm(false);
                setEditingRuleId(null);
                setRuleName("");
                setRuleConditions([{ field: "url", operator: "contains", value: "" }]);
                setRuleActions([{ type: "add_tags", params: { tags: [""] } }]);
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save rule");
            }
        } catch { toast.error("Failed to save rule"); }
        setSavingRule(false);
    };

    const handleOpenEditRule = (rule: Rule) => {
        setRuleName(rule.name);
        setRuleEvent(rule.event);
        setRuleConditionLogic(rule.conditionLogic);
        setRuleConditions([...rule.conditions]);
        setRuleActions([...rule.actions]);
        setEditingRuleId(rule.id);
        setShowRuleForm(true);
    };

    const handleToggleRule = async (ruleId: string, enabled: boolean) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        try {
            await fetch(`/api/rules/${ruleId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled }),
            });
        } catch { toast.error("Failed to toggle rule"); }
    };

    const handleDeleteRule = async () => {
        if (!ruleToDelete) return;
        try {
            const res = await fetch(`/api/rules/${ruleToDelete.id}`, { method: "DELETE" });
            if (res.ok) {
                setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
                toast.success("Rule deleted");
                setRuleToDelete(null);
            }
        } catch { toast.error("Failed to delete rule"); }
    };

    const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
        setRuleConditions(prev => prev.map((c, i) => i === idx ? { ...c, ...patch } : c));
    };

    const updateAction = (idx: number, patch: Partial<RuleAction>) => {
        setRuleActions(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
    };

    const getActionSummary = (action: RuleAction) => {
        switch (action.type) {
            case "add_tags": return `Add tags: ${(action.params?.tags || []).join(", ")}`;
            case "add_to_collection": return `Add to collection: ${action.params?.collectionName || ""}`;
            case "mark_read_later": return "Mark as Read Later";
            case "mark_archived": return "Mark as Archived";
            default: return action.type;
        }
    };

    const tabs = [
        { id: "general" as TabType, label: "General", icon: Settings2, description: "Display and behavior settings" },
        { id: "rules" as TabType, label: "Rules", icon: Zap, description: "Automate actions when bookmarks are saved" },
        { id: "integrations" as TabType, label: "Integrations", icon: Share2, description: "Connect external services" },
        { id: "security" as TabType, label: "Security", icon: ShieldCheck, description: "Manage your credentials" },
        { id: "data" as TabType, label: "Data Management", icon: Database, description: "Import and export your data" },
        { id: "tasks" as TabType, label: "Background Tasks", icon: RefreshCw, description: "Monitor active and pending jobs" },
        { id: "link-health" as TabType, label: "Link Health", icon: LinkIcon, description: "Find and clean up broken bookmarks" },
    ];

    return (
        <AppLayout bookmarkCounts={counts}>
            <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
                <h1 className="text-lg font-semibold flex items-center gap-2">
                    Settings
                </h1>
            </header>

            {/* Settings Content Area */}
            <main className="flex-1 p-4 md:p-10">
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

                                        <Separator className="bg-border/40" />

                                        <div className="space-y-4 pt-2">
                                            <div className="flex flex-col gap-1">
                                                <Label>Sensitive Content (NSFW)</Label>
                                                <p className="text-xs text-muted-foreground">
                                                    Control how bookmarks marked as sensitive are displayed.
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <Select value={nsfwDisplay} onValueChange={handleSaveNsfwDisplay}>
                                                    <SelectTrigger className="w-[240px] bg-background/50 h-10">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="blur" className="cursor-pointer">
                                                            <div className="flex flex-col">
                                                                <span>Blur Thumbnails</span>
                                                                <span className="text-[10px] text-muted-foreground">Click to reveal (Default)</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="hide" className="cursor-pointer">
                                                            <div className="flex flex-col">
                                                                <span>Hide Completely</span>
                                                                <span className="text-[10px] text-muted-foreground">Do not show in any view</span>
                                                            </div>
                                                        </SelectItem>
                                                        <SelectItem value="show" className="cursor-pointer">
                                                            <div className="flex flex-col">
                                                                <span>Show Normally</span>
                                                                <span className="text-[10px] text-muted-foreground">No special treatment</span>
                                                            </div>
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                {savingNsfw && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                            </div>
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
                                    <div className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                        githubConfigured && githubSyncEnabled ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"
                                    )}>
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
                                        {/* Token status from env */}
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm">Personal Access Token</Label>
                                            <div className={cn(
                                                "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
                                                githubConfigured
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {githubConfigured
                                                    ? <><Check className="h-3 w-3" /> Configured in .env</>
                                                    : <>Set <code className="font-mono">GITHUB_TOKEN</code> in .env</>}
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
                                            <Switch
                                                id="github-sync-toggle"
                                                checked={githubSyncEnabled}
                                                disabled={!githubConfigured}
                                                onCheckedChange={(checked) => handleToggleGithubSync(checked)}
                                            />
                                        </div>
                                    </div>

                                    <Button
                                        variant="secondary"
                                        className="w-full h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium"
                                        onClick={handleSyncStars}
                                        disabled={syncingStars || !githubConfigured}
                                    >
                                        {syncingStars ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <RefreshCw className="h-4 w-4" />
                                        )}
                                        Sync Starred Repositories
                                    </Button>
                                    <div className="flex justify-between items-center px-1">
                                        <p className="text-[10px] text-muted-foreground italic">
                                            Syncs automatically every hour
                                        </p>
                                        {lastGithubSync && (
                                            <p className="text-[10px] text-muted-foreground">
                                                Last synced: {new Date(lastGithubSync + "Z").toLocaleString(undefined, {
                                                    timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || undefined
                                                })}
                                            </p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                                <div className="absolute top-0 right-0 p-4">
                                    <div className={cn(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider",
                                        redditConfigured && redditSyncEnabled ? "bg-orange-500/10 text-orange-500" : "bg-muted text-muted-foreground"
                                    )}>
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
                                        {/* RSS URL status from env */}
                                        <div className="flex items-center justify-between">
                                            <Label className="text-sm">Private RSS Feed URL</Label>
                                            <div className={cn(
                                                "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full",
                                                redditConfigured
                                                    ? "bg-emerald-500/10 text-emerald-500"
                                                    : "bg-muted text-muted-foreground"
                                            )}>
                                                {redditConfigured
                                                    ? <><Check className="h-3 w-3" /> Configured in .env</>
                                                    : <>Set <code className="font-mono">REDDIT_RSS_URL</code> in .env</>}
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
                                            <Switch
                                                id="reddit-sync-toggle"
                                                checked={redditSyncEnabled}
                                                disabled={!redditConfigured}
                                                onCheckedChange={(checked) => handleToggleRedditSync(checked)}
                                            />
                                        </div>

                                        <Button
                                            variant="secondary"
                                            className="w-full h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium"
                                            onClick={handleSyncReddit}
                                            disabled={syncingReddit || !redditConfigured}
                                        >
                                            {syncingReddit ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <RefreshCw className="h-4 w-4" />
                                            )}
                                            Sync Saved Posts
                                        </Button>
                                        <div className="flex justify-between items-center px-1">
                                            <p className="text-[10px] text-muted-foreground italic">
                                                Syncs automatically every hour
                                            </p>
                                            {lastRedditSync && (
                                                <p className="text-[10px] text-muted-foreground">
                                                    Last synced: {new Date(lastRedditSync + "Z").toLocaleString(undefined, {
                                                        timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || undefined
                                                    })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
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
                                    {/* Webhook Status Row */}
                                    {telegramStatus.botConfigured && (
                                        <div className={`flex items-center justify-between p-3 rounded-xl border ${telegramStatus.webhookRegistered
                                            ? "bg-emerald-500/5 border-emerald-500/10"
                                            : "bg-amber-500/5 border-amber-500/10"
                                            }`}>
                                            <div className="flex items-center gap-2.5">
                                                {telegramStatus.webhookRegistered ? (
                                                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                                                ) : (
                                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                                )}
                                                <div>
                                                    <p className={`text-xs font-medium ${telegramStatus.webhookRegistered ? "text-emerald-500" : "text-amber-500"
                                                        }`}>
                                                        {telegramStatus.webhookRegistered ? "Webhook active" : "Webhook not registered"}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {telegramStatus.webhookRegistered
                                                            ? "Bot is receiving updates via your app URL"
                                                            : "Register the webhook so the bot can receive messages"}
                                                    </p>
                                                </div>
                                            </div>
                                            {!telegramStatus.webhookRegistered && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={handleRegisterWebhook}
                                                    disabled={isRegisteringWebhook}
                                                    className="shrink-0 h-8 text-[11px] gap-1.5 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:text-amber-500 cursor-pointer"
                                                >
                                                    {isRegisteringWebhook ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="h-3 w-3" />
                                                    )}
                                                    Register Webhook
                                                </Button>
                                            )}
                                            {telegramStatus.webhookRegistered && (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={handleRegisterWebhook}
                                                    disabled={isRegisteringWebhook}
                                                    className="shrink-0 h-8 text-[11px] gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer"
                                                >
                                                    {isRegisteringWebhook ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="h-3 w-3" />
                                                    )}
                                                    Re-register
                                                </Button>
                                            )}
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
                                                                    Last used: {token.last_used_at ? new Date(token.last_used_at.endsWith('Z') ? token.last_used_at : token.last_used_at + 'Z').toLocaleDateString(undefined, { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || undefined }) : 'Never'}
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

                    {activeTab === "tasks" && (
                        <div className="space-y-6">
                            {/* Thumbnail Card — separate because it has two action buttons */}
                            {(() => {
                                const thumbJob = (taskStats?.bulkJobs || []).find((j: any) => j.type === 'backfill_thumbnails');
                                const isRunning = thumbJob?.status === 'processing';
                                const isPending = thumbJob?.status === 'pending';
                                const progress = thumbJob?.progress || 0;
                                let parsedPayload: any = {};
                                try { parsedPayload = thumbJob?.payload ? JSON.parse(thumbJob.payload) : {}; } catch { }
                                const processed = parsedPayload.processed || 0;
                                const total = parsedPayload.total || 0;
                                const missingCount = taskStats?.maintenance?.missingThumbnails || 0;

                                return (
                                    <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                    isRunning ? "bg-primary/10" : "bg-muted/40"
                                                )}>
                                                    <Image className={cn("h-5 w-5", isRunning ? "text-primary" : "text-muted-foreground")} />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">Fetch Thumbnails</CardTitle>
                                                    <CardDescription className="text-xs mt-0.5">
                                                        Fetch thumbnails for your bookmarks. Fetch only missing ones, or re-fetch all.
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            {isRunning && (
                                                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 animate-pulse">
                                                    {parsedPayload.overwrite ? "Refetching All" : "Fetching Missing"}
                                                </Badge>
                                            )}
                                            {isPending && (
                                                <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/20 shrink-0">
                                                    Queued
                                                </Badge>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {(isRunning || isPending) ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium flex items-center gap-2">
                                                                {isRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                                                {isRunning
                                                                    ? (total > 0 ? `${processed} / ${total} processed` : "Starting...")
                                                                    : "Waiting to start..."}
                                                            </span>
                                                            {isRunning && (
                                                                <span className="text-muted-foreground font-mono text-[11px]">{progress}%</span>
                                                            )}
                                                        </div>
                                                        {isRunning && (
                                                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary transition-all duration-700 rounded-full"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCancelJob(thumbJob.id)}
                                                        className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-destructive hover:border-destructive/30"
                                                    >
                                                        <Square className="h-3 w-3" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    {missingCount > 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-semibold text-foreground">{missingCount}</span> bookmarks missing thumbnails
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                                                            <Check className="h-3.5 w-3.5" />
                                                            All bookmarks have thumbnails
                                                        </p>
                                                    )}
                                                    <div className="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleStartBulkJob('backfill_thumbnails', false)}
                                                            disabled={missingCount === 0}
                                                            className="h-9 text-xs gap-2 cursor-pointer"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                            Fetch Missing
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleStartBulkJob('backfill_thumbnails', true)}
                                                            className="h-9 text-xs gap-2 cursor-pointer"
                                                        >
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                            Refetch All
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })()}

                            {/* Embeddings Card */}
                            {(() => {
                                const embedJob = (taskStats?.bulkJobs || []).find((j: any) => j.type === 'backfill_embeddings');
                                const isRunning = embedJob?.status === 'processing';
                                const isPending = embedJob?.status === 'pending';
                                const progress = embedJob?.progress || 0;
                                let parsedPayload: any = {};
                                try { parsedPayload = embedJob?.payload ? JSON.parse(embedJob.payload) : {}; } catch { }
                                const processed = parsedPayload.processed || 0;
                                const total = parsedPayload.total || 0;
                                const missingCount = taskStats?.maintenance?.missingEmbeddings || 0;

                                return (
                                    <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                                            <div className="flex items-start gap-3">
                                                <div className={cn(
                                                    "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
                                                    isRunning ? "bg-primary/10" : "bg-muted/40"
                                                )}>
                                                    <Brain className={cn("h-5 w-5", isRunning ? "text-primary" : "text-muted-foreground")} />
                                                </div>
                                                <div>
                                                    <CardTitle className="text-base">Generate Embeddings</CardTitle>
                                                    <CardDescription className="text-xs mt-0.5">
                                                        Generate vector embeddings for semantic search on bookmarks that are missing them.
                                                    </CardDescription>
                                                </div>
                                            </div>
                                            {isRunning && (
                                                <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 animate-pulse">
                                                    Running
                                                </Badge>
                                            )}
                                            {isPending && (
                                                <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/20 shrink-0">
                                                    Queued
                                                </Badge>
                                            )}
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            {(isRunning || isPending) ? (
                                                <>
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between text-xs">
                                                            <span className="text-muted-foreground font-medium flex items-center gap-2">
                                                                {isRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                                                {isRunning
                                                                    ? (total > 0 ? `${processed} / ${total} processed` : "Starting...")
                                                                    : "Waiting to start..."}
                                                            </span>
                                                            {isRunning && (
                                                                <span className="text-muted-foreground font-mono text-[11px]">{progress}%</span>
                                                            )}
                                                        </div>
                                                        {isRunning && (
                                                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                                                <div
                                                                    className="h-full bg-primary transition-all duration-700 rounded-full"
                                                                    style={{ width: `${progress}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleCancelJob(embedJob.id)}
                                                        className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-destructive hover:border-destructive/30"
                                                    >
                                                        <Square className="h-3 w-3" />
                                                        Cancel
                                                    </Button>
                                                </>
                                            ) : (
                                                <>
                                                    {missingCount > 0 ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            <span className="font-semibold text-foreground">{missingCount}</span> bookmarks missing embeddings
                                                        </p>
                                                    ) : (
                                                        <p className="text-xs text-emerald-500 flex items-center gap-1.5">
                                                            <Check className="h-3.5 w-3.5" />
                                                            All bookmarks have embeddings
                                                        </p>
                                                    )}
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleStartBulkJob('backfill_embeddings')}
                                                        disabled={missingCount === 0}
                                                        className="h-9 text-xs gap-2 cursor-pointer"
                                                    >
                                                        <RefreshCw className="h-3.5 w-3.5" />
                                                        Start
                                                    </Button>
                                                </>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })()}

                            {/* Job Statistics */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-lg">Job Statistics</CardTitle>
                                        <CardDescription>Overall progress of your background operations.</CardDescription>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleRetryFailed}
                                            disabled={isRetrying || !taskStats?.failed}
                                            className="h-8 text-[11px] gap-1.5 cursor-pointer"
                                        >
                                            <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />
                                            Retry Failed
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleClearTasks('clear_completed')}
                                            disabled={isClearing || !taskStats?.completed}
                                            className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground"
                                        >
                                            <Trash2 className="h-3 w-3" />
                                            Clear Done
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        {[
                                            { label: "Pending", value: taskStats?.pending || 0, color: "text-muted-foreground", bg: "bg-muted/10" },
                                            { label: "Processing", value: taskStats?.processing || 0, color: "text-primary", bg: "bg-primary/10" },
                                            { label: "Completed", value: taskStats?.completed || 0, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                                            { label: "Failed", value: taskStats?.failed || 0, color: "text-destructive", bg: "bg-destructive/10" },
                                        ].map((stat) => (
                                            <div key={stat.label} className={cn("p-3 rounded-2xl border border-border/20", stat.bg)}>
                                                <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">{stat.label}</p>
                                                <p className={cn("text-2xl font-bold mt-0.5", stat.color)}>{stat.value}</p>
                                            </div>
                                        ))}
                                    </div>

                                    {taskStats?.processing + taskStats?.pending > 0 && (
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-muted-foreground font-medium flex items-center gap-2">
                                                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    Currently Processing
                                                </span>
                                                <span className="text-muted-foreground font-mono">
                                                    {Math.round((taskStats.completed / (taskStats.pending + taskStats.processing + taskStats.completed + taskStats.failed)) * 100)}%
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary transition-all duration-700"
                                                    style={{ width: `${(taskStats.completed / (taskStats.pending + taskStats.processing + taskStats.completed + taskStats.failed)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Processing Queue */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg">Processing Queue</CardTitle>
                                    <CardDescription>The last few active or pending jobs.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {taskStats?.activeJobs && taskStats.activeJobs.length > 0 ? (
                                        <div className="space-y-2">
                                            {taskStats.activeJobs.map((job: any) => (
                                                <div key={job.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/20">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                                            <RefreshCw className="h-4 w-4 text-primary animate-spin" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {job.title || job.url || "New Link"}
                                                            </p>
                                                            <p className="text-[10px] text-muted-foreground truncate">{job.url}</p>
                                                        </div>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 capitalize">
                                                        {job.type.replace('_', ' ')}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center border border-dashed border-border/40 rounded-2xl bg-muted/5">
                                            <Database className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                            <p className="text-sm text-muted-foreground">No active jobs in the queue.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeTab === "rules" && (
                        <div className="space-y-6">
                            {/* Existing Rules List */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                                    <div>
                                        <CardTitle className="text-lg">Your Rules</CardTitle>
                                        <CardDescription>Rules automatically run when bookmarks are created or updated.</CardDescription>
                                    </div>
                                    <Button
                                        onClick={() => {
                                            setEditingRuleId(null);
                                            setRuleName("");
                                            setRuleConditions([{ field: "url", operator: "contains", value: "" }]);
                                            setRuleActions([{ type: "add_tags", params: { tags: [""] } }]);
                                            setShowRuleForm(true);
                                        }}
                                        size="sm"
                                        className="cursor-pointer gap-1.5"
                                    >
                                        <Plus className="h-4 w-4" />
                                        Add Rule
                                    </Button>
                                </CardHeader>
                                <CardContent>
                                    {rules.length === 0 && !showRuleForm ? (
                                        <div className="py-8 text-center border border-dashed border-border/40 rounded-2xl bg-muted/5">
                                            <Zap className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                                            <p className="text-sm text-muted-foreground">No rules configured yet.</p>
                                            <p className="text-xs text-muted-foreground mt-1">Create a rule to automate tagging, collections, and more.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {rules.map((rule) => (
                                                <div key={rule.id} className="rounded-xl border border-border/30 bg-card/60 overflow-hidden transition-colors hover:border-border/50">
                                                    <div className="flex items-center justify-between p-3.5">
                                                        <button
                                                            className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer"
                                                            onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}
                                                        >
                                                            <div className={cn(
                                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                                rule.enabled ? "bg-primary/10" : "bg-muted/40"
                                                            )}>
                                                                <Zap className={cn("h-4 w-4", rule.enabled ? "text-primary" : "text-muted-foreground")} />
                                                            </div>
                                                            <div className="min-w-0 flex-1">
                                                                <p className="text-sm font-medium truncate">{rule.name}</p>
                                                                <p className="text-[10px] text-muted-foreground">
                                                                    {rule.event === "bookmark.created" ? "On bookmark created" : "On bookmark updated"}
                                                                    {" · "}
                                                                    {rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                                                                    {" · "}
                                                                    {rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
                                                                </p>
                                                            </div>
                                                            {expandedRuleId === rule.id ? (
                                                                <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            ) : (
                                                                <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                                                            )}
                                                        </button>
                                                        <div className="flex items-center gap-2 ml-3 shrink-0">
                                                            <Switch
                                                                checked={rule.enabled}
                                                                onCheckedChange={(checked) => handleToggleRule(rule.id, checked)}
                                                            />
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleOpenEditRule(rule)}
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setRuleToDelete(rule)}
                                                                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                    {expandedRuleId === rule.id && (
                                                        <div className="px-3.5 pb-3.5 pt-0 space-y-2 border-t border-border/20">
                                                            <div className="pt-3 space-y-1.5">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conditions ({rule.conditionLogic})</p>
                                                                {rule.conditions.map((c, i) => (
                                                                    <div key={i} className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-1.5">
                                                                        <span className="font-medium text-foreground">{c.field}</span>
                                                                        {" "}
                                                                        <span className="italic">{c.operator.replace("_", " ")}</span>
                                                                        {" "}
                                                                        <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{c.value}</code>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            <div className="space-y-1.5">
                                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
                                                                {rule.actions.map((a, i) => (
                                                                    <div key={i} className="text-xs bg-primary/5 text-primary rounded-lg px-3 py-1.5">
                                                                        {getActionSummary(a)}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Delete Rule Alert Dialog */}
                            <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Are you sure you want to delete <span className="font-semibold text-foreground">"{ruleToDelete?.name}"</span>?
                                            This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleDeleteRule}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Delete
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>

                            {/* Add/Edit Rule Dialog */}
                            <Dialog
                                open={showRuleForm}
                                onOpenChange={(open) => {
                                    if (!open) {
                                        setShowRuleForm(false);
                                        setEditingRuleId(null);
                                        setRuleName("");
                                        setRuleConditions([{ field: "url", operator: "contains", value: "" }]);
                                        setRuleActions([{ type: "add_tags", params: { tags: [""] } }]);
                                    }
                                }}
                            >
                                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle>{editingRuleId ? "Edit Rule" : "New Rule"}</DialogTitle>
                                        <DialogDescription>
                                            {editingRuleId ? "Update your rule configuration." : "Define when and what should happen automatically."}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-6 py-4">
                                        {/* Name */}
                                        <div className="space-y-2">
                                            <Label>Rule Name</Label>
                                            <Input
                                                placeholder="e.g. GitHub Auto-Tag"
                                                value={ruleName}
                                                onChange={(e) => setRuleName(e.target.value)}
                                                className="bg-background/50"
                                            />
                                        </div>

                                        {/* Event */}
                                        <div className="space-y-2">
                                            <Label>Trigger Event</Label>
                                            <Select value={ruleEvent} onValueChange={(v) => setRuleEvent(v as RuleEvent)}>
                                                <SelectTrigger className="bg-background/50">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bookmark.created">Bookmark Created</SelectItem>
                                                    <SelectItem value="bookmark.updated">Bookmark Updated</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <Separator className="bg-border/30" />

                                        {/* Conditions */}
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <Label>Conditions</Label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-muted-foreground uppercase">Match</span>
                                                    <Button
                                                        variant={ruleConditionLogic === "AND" ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2 cursor-pointer"
                                                        onClick={() => setRuleConditionLogic("AND")}
                                                    >ALL</Button>
                                                    <Button
                                                        variant={ruleConditionLogic === "OR" ? "default" : "outline"}
                                                        size="sm"
                                                        className="h-6 text-[10px] px-2 cursor-pointer"
                                                        onClick={() => setRuleConditionLogic("OR")}
                                                    >ANY</Button>
                                                </div>
                                            </div>
                                            {ruleConditions.map((cond, idx) => (
                                                <div key={idx} className="flex items-center gap-2">
                                                    <Select value={cond.field} onValueChange={(v) => updateCondition(idx, { field: v as any })}>
                                                        <SelectTrigger className="w-[110px] bg-background/50 h-9 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="url">URL</SelectItem>
                                                            <SelectItem value="title">Title</SelectItem>
                                                            <SelectItem value="description">Description</SelectItem>
                                                            <SelectItem value="domain">Domain</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, { operator: v as any })}>
                                                        <SelectTrigger className="w-[120px] bg-background/50 h-9 text-xs">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="contains">contains</SelectItem>
                                                            <SelectItem value="starts_with">starts with</SelectItem>
                                                            <SelectItem value="equals">equals</SelectItem>
                                                            <SelectItem value="matches_regex">matches regex</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <Input
                                                        placeholder="Value..."
                                                        value={cond.value}
                                                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                                        className="flex-1 bg-background/50 h-9 text-xs"
                                                    />
                                                    {ruleConditions.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => setRuleConditions(prev => prev.filter((_, i) => i !== idx))}
                                                            className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setRuleConditions(prev => [...prev, { field: "url", operator: "contains", value: "" }])}
                                                className="text-xs cursor-pointer gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> Add Condition
                                            </Button>
                                        </div>

                                        <Separator className="bg-border/30" />

                                        {/* Actions */}
                                        <div className="space-y-3">
                                            <Label>Actions</Label>
                                            {ruleActions.map((action, idx) => (
                                                <div key={idx} className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/10">
                                                    <div className="flex items-center gap-2">
                                                        <Select value={action.type} onValueChange={(v) => {
                                                            const newAction: RuleAction = { type: v as any, params: {} };
                                                            if (v === "add_tags") newAction.params = { tags: [""] };
                                                            if (v === "add_to_collection") newAction.params = { collectionName: "" };
                                                            updateAction(idx, newAction);
                                                        }}>
                                                            <SelectTrigger className="w-[180px] bg-background/50 h-9 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="add_tags">Add Tags</SelectItem>
                                                                <SelectItem value="add_to_collection">Add to Collection</SelectItem>
                                                                <SelectItem value="mark_read_later">Mark Read Later</SelectItem>
                                                                <SelectItem value="mark_archived">Mark Archived</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                        {ruleActions.length > 1 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setRuleActions(prev => prev.filter((_, i) => i !== idx))}
                                                                className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 ml-auto"
                                                            >
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {action.type === "add_tags" && (
                                                        <div className="space-y-2">
                                                            {(action.params?.tags || [""]).map((tag: string, tIdx: number) => (
                                                                <div key={tIdx} className="flex items-center gap-2">
                                                                    <Input
                                                                        placeholder="Tag name..."
                                                                        value={tag}
                                                                        list="existing-tags"
                                                                        onChange={(e) => {
                                                                            const newTags = [...(action.params?.tags || [""])];
                                                                            newTags[tIdx] = e.target.value;
                                                                            updateAction(idx, { params: { tags: newTags } });
                                                                        }}
                                                                        className="flex-1 bg-background/50 h-8 text-xs"
                                                                    />
                                                                    {(action.params?.tags || []).length > 1 && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                const newTags = (action.params?.tags || []).filter((_: string, i: number) => i !== tIdx);
                                                                                updateAction(idx, { params: { tags: newTags } });
                                                                            }}
                                                                            className="h-8 w-8 p-0 text-muted-foreground cursor-pointer"
                                                                        >
                                                                            <X className="h-3 w-3" />
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            ))}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => {
                                                                    const newTags = [...(action.params?.tags || [""]), ""];
                                                                    updateAction(idx, { params: { tags: newTags } });
                                                                }}
                                                                className="text-[10px] h-7 cursor-pointer gap-1"
                                                            >
                                                                <Plus className="h-3 w-3" /> Add Tag
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {action.type === "add_to_collection" && (
                                                        <Input
                                                            placeholder="Collection name..."
                                                            value={action.params?.collectionName || ""}
                                                            list="existing-collections"
                                                            onChange={(e) => updateAction(idx, { params: { collectionName: e.target.value } })}
                                                            className="bg-background/50 h-8 text-xs"
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setRuleActions(prev => [...prev, { type: "add_tags", params: { tags: [""] } }])}
                                                className="text-xs cursor-pointer gap-1"
                                            >
                                                <Plus className="h-3 w-3" /> Add Action
                                            </Button>
                                        </div>
                                    </div>
                                    <DialogFooter className="mt-6">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setShowRuleForm(false);
                                                setEditingRuleId(null);
                                            }}
                                            className="h-11 cursor-pointer"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleSaveRule}
                                            disabled={savingRule}
                                            className="h-11 px-8 cursor-pointer font-medium gap-2"
                                        >
                                            {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                            {editingRuleId ? "Update Rule" : "Create Rule"}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>

                            <datalist id="existing-tags">
                                {[...new Set(existingTags.map(t => t.name))].map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>

                            <datalist id="existing-collections">
                                {[...new Set(existingCollections.map(c => c.name))].map(name => (
                                    <option key={name} value={name} />
                                ))}
                            </datalist>
                        </div>
                    )}

                    {activeTab === "link-health" && (
                        <div className="space-y-6">
                            {/* Schedule Card */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <LinkIcon className="h-5 w-5 text-primary" />
                                        Check Schedule
                                    </CardTitle>
                                    <CardDescription>
                                        Configure when PathFind automatically checks all your bookmarks for broken links.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label className="text-sm font-medium">Enable automatic checks</Label>
                                            <p className="text-xs text-muted-foreground mt-0.5">Run link health checks on a schedule</p>
                                        </div>
                                        <Switch
                                            checked={linkCheckEnabled}
                                            onCheckedChange={setLinkCheckEnabled}
                                        />
                                    </div>

                                    {linkCheckEnabled && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                            <div className="space-y-1.5">
                                                <Label>Frequency</Label>
                                                <Select
                                                    value={linkCheckInterval}
                                                    onValueChange={(v) => setLinkCheckInterval(v as 'weekly' | 'monthly' | 'custom')}
                                                >
                                                    <SelectTrigger className="bg-background/50">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="weekly">Every week</SelectItem>
                                                        <SelectItem value="monthly">Every month</SelectItem>
                                                        <SelectItem value="custom">Custom interval</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            {linkCheckInterval === 'custom' && (
                                                <div className="space-y-1.5 animate-in fade-in duration-150">
                                                    <Label>Every how many days?</Label>
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            type="number"
                                                            min={1}
                                                            max={365}
                                                            value={linkCheckIntervalDays}
                                                            onChange={e => setLinkCheckIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                                                            className="w-28 bg-background/50"
                                                        />
                                                        <span className="text-sm text-muted-foreground">days</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {lastLinkCheckAt && (
                                        <p className="text-xs text-muted-foreground">
                                            Last checked: {new Date(lastLinkCheckAt).toLocaleString()}
                                        </p>
                                    )}

                                    <Button
                                        onClick={async () => {
                                            setSavingLinkSchedule(true);
                                            try {
                                                const res = await fetch("/api/settings/link-check", {
                                                    method: "PUT",
                                                    headers: { "Content-Type": "application/json" },
                                                    body: JSON.stringify({
                                                        enabled: linkCheckEnabled,
                                                        interval: linkCheckInterval,
                                                        intervalDays: linkCheckIntervalDays,
                                                    }),
                                                });
                                                if (res.ok) toast.success("Schedule saved");
                                                else toast.error("Failed to save schedule");
                                            } catch {
                                                toast.error("Something went wrong");
                                            }
                                            setSavingLinkSchedule(false);
                                        }}
                                        disabled={savingLinkSchedule}
                                        className="cursor-pointer"
                                    >
                                        {savingLinkSchedule ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                        Save Schedule
                                    </Button>
                                </CardContent>
                            </Card>

                            {/* Manual Run Card */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2">
                                        <Play className="h-5 w-5 text-primary" />
                                        Manual Check
                                    </CardTitle>
                                    <CardDescription>
                                        Run a link health check right now across all your bookmarks.
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {(() => {
                                        const activeJob = taskStats?.bulkJobs?.find((j: any) => j.type === 'check_broken_links');
                                        if (activeJob) {
                                            const payload = (() => { try { return JSON.parse(activeJob.payload); } catch { return {}; } })();
                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-muted-foreground">
                                                            {activeJob.status === 'pending' ? 'Waiting to start…' : `Checking links… ${payload.processed ?? 0} / ${payload.total ?? '?'}`}
                                                        </span>
                                                        <span className="font-medium">{activeJob.progress ?? 0}%</span>
                                                    </div>
                                                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all duration-500 rounded-full"
                                                            style={{ width: `${activeJob.progress ?? 0}%` }}
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="cursor-pointer text-destructive border-destructive/40 hover:bg-destructive/5"
                                                        onClick={() => handleCancelJob(activeJob.id)}
                                                    >
                                                        <X className="h-3.5 w-3.5 mr-1.5" />
                                                        Cancel
                                                    </Button>
                                                </div>
                                            );
                                        }
                                        return (
                                            <Button
                                                onClick={async () => {
                                                    setIsRunningLinkCheck(true);
                                                    try {
                                                        const res = await fetch("/api/tasks", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ action: 'check_broken_links' }),
                                                        });
                                                        if (res.ok) toast.success("Link check started");
                                                        else {
                                                            const d = await res.json();
                                                            toast.error(d.error || "Failed to start job");
                                                        }
                                                    } catch {
                                                        toast.error("Failed to start job");
                                                    }
                                                    setIsRunningLinkCheck(false);
                                                }}
                                                disabled={isRunningLinkCheck}
                                                className="cursor-pointer"
                                            >
                                                {isRunningLinkCheck
                                                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                                    : <Play className="h-4 w-4 mr-2" />}
                                                Run Check Now
                                            </Button>
                                        );
                                    })()}
                                </CardContent>
                            </Card>

                            {/* Broken Links Results Card */}
                            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                                <CardHeader>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <CardTitle className="text-lg flex items-center gap-2">
                                                <ShieldX className="h-5 w-5 text-destructive" />
                                                Broken Links
                                                {brokenBookmarks.length > 0 && (
                                                    <Badge variant="destructive" className="ml-1 text-xs">
                                                        {brokenBookmarks.length}
                                                    </Badge>
                                                )}
                                            </CardTitle>
                                            <CardDescription className="mt-1">
                                                Bookmarks that returned an error or are unreachable. Select any to delete them.
                                            </CardDescription>
                                        </div>
                                        {selectedBrokenIds.size > 0 && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                disabled={isDeletingBroken}
                                                className="cursor-pointer shrink-0"
                                                onClick={async () => {
                                                    setIsDeletingBroken(true);
                                                    try {
                                                        const res = await fetch("/api/bookmarks/broken", {
                                                            method: "DELETE",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({ ids: [...selectedBrokenIds] }),
                                                        });
                                                        if (res.ok) {
                                                            const data = await res.json();
                                                            toast.success(`Deleted ${data.deleted} bookmark${data.deleted !== 1 ? 's' : ''}`);
                                                            setBrokenBookmarks(prev => prev.filter(b => !selectedBrokenIds.has(b.id)));
                                                            setSelectedBrokenIds(new Set());
                                                        } else {
                                                            toast.error("Failed to delete bookmarks");
                                                        }
                                                    } catch {
                                                        toast.error("Something went wrong");
                                                    }
                                                    setIsDeletingBroken(false);
                                                }}
                                            >
                                                {isDeletingBroken
                                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                                                    : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                                                Delete {selectedBrokenIds.size} selected
                                            </Button>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    {brokenBookmarks.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center">
                                            <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                                                <Check className="h-6 w-6 text-green-500" />
                                            </div>
                                            <p className="text-sm font-medium">No broken links found</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {lastLinkCheckAt ? 'All your bookmarks are reachable.' : 'Run a check to find broken links.'}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-lg border border-border/40 overflow-hidden">
                                            {/* Table header */}
                                            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-2.5 bg-muted/30 border-b border-border/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                                <Checkbox
                                                    className="cursor-pointer"
                                                    checked={selectedBrokenIds.size === brokenBookmarks.length && brokenBookmarks.length > 0}
                                                    onCheckedChange={(checked) => {
                                                        if (checked) {
                                                            setSelectedBrokenIds(new Set(brokenBookmarks.map(b => b.id)));
                                                        } else {
                                                            setSelectedBrokenIds(new Set());
                                                        }
                                                    }}
                                                />
                                                <span>Bookmark</span>
                                                <span className="text-right">Status</span>
                                                <span className="text-right">Checked</span>
                                            </div>

                                            {/* Table rows */}
                                            <div className="divide-y divide-border/20">
                                                {brokenBookmarks.map(bm => (
                                                    <div
                                                        key={bm.id}
                                                        className={cn(
                                                            "grid grid-cols-[auto_1fr_auto_auto] gap-3 items-center px-4 py-3 transition-colors",
                                                            selectedBrokenIds.has(bm.id)
                                                                ? "bg-destructive/5"
                                                                : "hover:bg-muted/20"
                                                        )}
                                                    >
                                                        <Checkbox
                                                            className="cursor-pointer"
                                                            checked={selectedBrokenIds.has(bm.id)}
                                                            onCheckedChange={(checked) => {
                                                                setSelectedBrokenIds(prev => {
                                                                    const next = new Set(prev);
                                                                    if (checked) next.add(bm.id);
                                                                    else next.delete(bm.id);
                                                                    return next;
                                                                });
                                                            }}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-sm font-medium truncate">
                                                                {bm.title || '(No title)'}
                                                            </p>
                                                            <a
                                                                href={bm.url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs text-muted-foreground hover:text-primary truncate block transition-colors"
                                                            >
                                                                {bm.url}
                                                            </a>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <Badge
                                                                variant={bm.link_status === 'broken' ? 'destructive' : 'secondary'}
                                                                className="text-xs font-mono"
                                                            >
                                                                {bm.link_status_code ?? bm.link_status}
                                                            </Badge>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <span className="text-xs text-muted-foreground">
                                                                {bm.link_checked_at
                                                                    ? new Date(bm.link_checked_at).toLocaleDateString()
                                                                    : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
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
