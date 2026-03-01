"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Link as LinkIcon, Play, ShieldX, Trash2, Check, X, Calendar, Activity } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface LinkHealthTabProps {
    linkCheckEnabled: boolean;
    setLinkCheckEnabled: React.Dispatch<React.SetStateAction<boolean>>;
    linkCheckInterval: 'weekly' | 'monthly' | 'custom';
    setLinkCheckInterval: React.Dispatch<React.SetStateAction<'weekly' | 'monthly' | 'custom'>>;
    linkCheckIntervalDays: number;
    setLinkCheckIntervalDays: React.Dispatch<React.SetStateAction<number>>;
    lastLinkCheckAt: string | null;
    brokenBookmarks: { id: string; url: string; title: string | null; favicon: string | null; link_status: string; link_status_code: number | null; link_checked_at: string | null }[];
    setBrokenBookmarks: React.Dispatch<React.SetStateAction<any[]>>;
    taskStats: any;
    onCancelJob: (jobId: string) => Promise<void>;
}

export function LinkHealthTab({
    linkCheckEnabled, setLinkCheckEnabled,
    linkCheckInterval, setLinkCheckInterval,
    linkCheckIntervalDays, setLinkCheckIntervalDays,
    lastLinkCheckAt,
    brokenBookmarks, setBrokenBookmarks,
    taskStats, onCancelJob,
}: LinkHealthTabProps) {
    const [savingLinkSchedule, setSavingLinkSchedule] = useState(false);
    const [isRunningLinkCheck, setIsRunningLinkCheck] = useState(false);
    const [selectedBrokenIds, setSelectedBrokenIds] = useState<Set<string>>(new Set());
    const [isDeletingBroken, setIsDeletingBroken] = useState(false);

    const activeJob = taskStats?.bulkJobs?.find((j: any) => j.type === 'check_broken_links');

    const handleSaveSchedule = async () => {
        setSavingLinkSchedule(true);
        try {
            const res = await fetch("/api/settings/link-check", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ enabled: linkCheckEnabled, interval: linkCheckInterval, intervalDays: linkCheckIntervalDays }),
            });
            if (res.ok) toast.success("Schedule saved");
            else toast.error("Failed to save schedule");
        } catch { toast.error("Something went wrong"); }
        setSavingLinkSchedule(false);
    };

    const handleRunCheck = async () => {
        setIsRunningLinkCheck(true);
        try {
            const res = await fetch("/api/tasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: 'check_broken_links' }),
            });
            if (res.ok) toast.success("Link check started");
            else { const d = await res.json(); toast.error(d.error || "Failed to start job"); }
        } catch { toast.error("Failed to start job"); }
        setIsRunningLinkCheck(false);
    };

    const handleDeleteSelected = async () => {
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
            } else { toast.error("Failed to delete bookmarks"); }
        } catch { toast.error("Something went wrong"); }
        setIsDeletingBroken(false);
    };

    return (
        <div className="space-y-6">
            {/* Combined Controls Card */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold tracking-tight">
                        <Activity className="h-5 w-5 text-primary" />
                        Link Health Controls
                    </CardTitle>
                    <CardDescription>Manage your link validation schedule and manual scans.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                        {/* Left Column: Schedule */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Automation</span>
                            </div>

                            <div className="space-y-4 rounded-xl p-4 bg-muted/20 border border-border/20">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <Label className="text-sm font-medium">Automatic checks</Label>
                                        <p className="text-[11px] text-muted-foreground leading-tight">Run checks on a background schedule</p>
                                    </div>
                                    <Switch checked={linkCheckEnabled} onCheckedChange={setLinkCheckEnabled} />
                                </div>

                                {linkCheckEnabled && (
                                    <div className="space-y-3 pt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Frequency</Label>
                                            <Select value={linkCheckInterval} onValueChange={(v) => setLinkCheckInterval(v as any)}>
                                                <SelectTrigger className="bg-background/50 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="weekly" className="text-xs">Every week</SelectItem>
                                                    <SelectItem value="monthly" className="text-xs">Every month</SelectItem>
                                                    <SelectItem value="custom" className="text-xs">Custom interval</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        {linkCheckInterval === 'custom' && (
                                            <div className="space-y-1.5 animate-in fade-in duration-150">
                                                <Label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Interval Days</Label>
                                                <div className="flex items-center gap-2">
                                                    <Input type="number" min={1} max={365} value={linkCheckIntervalDays} onChange={e => setLinkCheckIntervalDays(Math.max(1, parseInt(e.target.value) || 1))} className="h-9 w-24 bg-background/50 text-xs" />
                                                    <span className="text-xs text-muted-foreground">days</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                <Button onClick={handleSaveSchedule} disabled={savingLinkSchedule} className="w-full h-9 text-xs cursor-pointer shadow-sm">
                                    {savingLinkSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Check className="h-3.5 w-3.5 mr-2" />}
                                    Save Schedule
                                </Button>
                            </div>
                        </div>

                        {/* Right Column: Status & Manual Run */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live Status</span>
                            </div>

                            <div className="space-y-4 rounded-xl p-4 bg-muted/20 border border-border/20 h-full flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-medium">Last Scan</Label>
                                            <p className="text-[11px] text-muted-foreground leading-tight">
                                                {lastLinkCheckAt ? new Date(lastLinkCheckAt).toLocaleString() : "Never checked"}
                                            </p>
                                        </div>
                                        {activeJob && (
                                            <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 animate-pulse">Running</Badge>
                                        )}
                                    </div>

                                    {activeJob ? (
                                        <div className="space-y-3 pt-2">
                                            <div className="flex items-center justify-between text-xs font-mono">
                                                <span className="text-muted-foreground">
                                                    {activeJob.status === 'pending' ? 'Queued...' : `In progress... ${JSON.parse(activeJob.payload || '{}').processed ?? 0} checked`}
                                                </span>
                                                <span className="text-primary font-bold">{activeJob.progress ?? 0}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                                                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${activeJob.progress ?? 0}%` }} />
                                            </div>
                                            <Button variant="outline" size="sm" className="w-full h-8 text-[11px] border-destructive/20 text-destructive hover:bg-destructive/5 hover:border-destructive/40 cursor-pointer" onClick={() => onCancelJob(activeJob.id)}>
                                                <X className="h-3 w-3 mr-1.5" />Stop Scan
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="py-2">
                                            <p className="text-[11px] text-muted-foreground italic mb-2">No scan currently running. You can trigger a full validation of all bookmarks manually.</p>
                                        </div>
                                    )}
                                </div>

                                {!activeJob && (
                                    <Button onClick={handleRunCheck} disabled={isRunningLinkCheck} variant="secondary" className="w-full h-9 text-xs cursor-pointer border border-border bg-background/50 hover:bg-background">
                                        {isRunningLinkCheck ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Play className="h-3.5 w-3.5 mr-2" />}
                                        Run Full Scan Now
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Broken Links Table */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                <CardHeader className="pb-3 border-b border-border/10">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-base flex items-center gap-2">
                                <ShieldX className="h-4 w-4 text-destructive" />
                                Broken Links
                                {brokenBookmarks.length > 0 && <Badge variant="destructive" className="ml-1.5 h-4.5 px-1.5 text-[10px]">{brokenBookmarks.length}</Badge>}
                            </CardTitle>
                            <CardDescription className="text-xs">Unreachable bookmarks identified in the last scan.</CardDescription>
                        </div>
                        {selectedBrokenIds.size > 0 && (
                            <Button variant="destructive" size="sm" disabled={isDeletingBroken} className="h-8 text-xs cursor-pointer px-3" onClick={handleDeleteSelected}>
                                {isDeletingBroken ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Trash2 className="h-3 w-3 mr-1.5" />}
                                Delete {selectedBrokenIds.size}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {brokenBookmarks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                                <Check className="h-5 w-5 text-emerald-500" />
                            </div>
                            <p className="text-sm font-semibold">Perfect Health</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">All validated bookmarks are currently reachable.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <div className="min-w-[600px]">
                                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-6 py-3 bg-muted/20 border-b border-border/20 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                    <Checkbox
                                        className="h-3.5 w-3.5 cursor-pointer"
                                        checked={selectedBrokenIds.size === brokenBookmarks.length && brokenBookmarks.length > 0}
                                        onCheckedChange={(checked) => {
                                            if (checked) setSelectedBrokenIds(new Set(brokenBookmarks.map(b => b.id)));
                                            else setSelectedBrokenIds(new Set());
                                        }}
                                    />
                                    <span>Bookmark</span>
                                    <span className="text-right">Status Code</span>
                                    <span className="text-right">Last Verified</span>
                                </div>
                                <div className="divide-y divide-border/10 max-h-[400px] overflow-y-auto">
                                    {brokenBookmarks.map(bm => (
                                        <div key={bm.id} className={cn("grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-6 py-3 transition-colors", selectedBrokenIds.has(bm.id) ? "bg-destructive/5" : "hover:bg-muted/10")}>
                                            <Checkbox
                                                className="h-3.5 w-3.5 cursor-pointer"
                                                checked={selectedBrokenIds.has(bm.id)}
                                                onCheckedChange={(checked) => {
                                                    setSelectedBrokenIds(prev => {
                                                        const next = new Set(prev);
                                                        if (checked) next.add(bm.id); else next.delete(bm.id);
                                                        return next;
                                                    });
                                                }}
                                            />
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate leading-none mb-1.5">{bm.title || '(No title)'}</p>
                                                <p className="text-[11px] text-muted-foreground truncate leading-none uppercase tracking-tight">{new URL(bm.url).hostname}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <Badge variant="outline" className="h-5 px-1.5 rounded-md text-[10px] font-mono border-destructive/30 text-destructive bg-destructive/5">
                                                    {bm.link_status_code ?? bm.link_status}
                                                </Badge>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{bm.link_checked_at ? new Date(bm.link_checked_at).toLocaleDateString() : '—'}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
