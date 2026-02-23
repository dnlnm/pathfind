"use client";

import { useState, useEffect } from "react";
import { Loader2, CheckCircle2, AlertCircle, X, ChevronRight, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface TaskStats {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    activeJobs: any[];
}

export function TaskProgress() {
    const [stats, setStats] = useState<TaskStats | null>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const res = await fetch("/api/tasks");
                if (res.ok) {
                    const data = await res.json();
                    setStats(data);

                    // Show if there are any non-completed jobs
                    const hasActive = data.pending > 0 || data.processing > 0 || data.failed > 0;
                    setIsVisible(hasActive);
                }
            } catch (err) {
                console.error("Failed to fetch task stats", err);
            }
        };

        fetchStats();
        const interval = setInterval(fetchStats, 3000);
        return () => clearInterval(interval);
    }, []);

    if (!isVisible || !stats) return null;

    const total = stats.pending + stats.processing + stats.completed + stats.failed;
    const progress = total > 0 ? (stats.completed / total) * 100 : 0;
    const isWorking = stats.processing > 0 || stats.pending > 0;

    return (
        <div className={cn(
            "fixed bottom-6 right-6 z-50 w-72 transition-all duration-300 ease-in-out",
            isExpanded ? "scale-100 opacity-100" : "scale-95 opacity-90 hover:opacity-100"
        )}>
            <div className="bg-card/95 backdrop-blur-md border border-border/50 shadow-2xl rounded-2xl overflow-hidden">
                {/* Header / Summary */}
                <div
                    className="p-3 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setIsExpanded(!isExpanded)}
                >
                    <div className="flex items-center gap-2.5">
                        <div className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center",
                            isWorking ? "bg-primary/10 text-primary" : "bg-green-500/10 text-green-500"
                        )}>
                            {isWorking ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : stats.failed > 0 ? (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                            ) : (
                                <CheckCircle2 className="h-4 w-4" />
                            )}
                        </div>
                        <div>
                            <p className="text-xs font-semibold">
                                {isWorking ? "Processing Bookmarks" : "Tasks Complete"}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                {stats.completed} of {total} processed
                            </p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full">
                        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
                    </Button>
                </div>

                {/* Progress Bar (Always visible when not expanded) */}
                <div className="h-1 w-full bg-muted/50">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                    <div className="p-4 pt-2 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="p-2 rounded-lg bg-muted/30 border border-border/20">
                                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Pending</p>
                                <p className="text-lg font-semibold">{stats.pending + stats.processing}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-green-500/5 border border-green-500/10">
                                <p className="text-[10px] uppercase tracking-wider text-green-500/70 font-bold">Success</p>
                                <p className="text-lg font-semibold text-green-500">{stats.completed}</p>
                            </div>
                            {stats.failed > 0 && (
                                <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/10 col-span-2">
                                    <p className="text-[10px] uppercase tracking-wider text-destructive/70 font-bold">Failed</p>
                                    <p className="text-lg font-semibold text-destructive">{stats.failed}</p>
                                </div>
                            )}
                        </div>

                        {stats.activeJobs.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Active Jobs</p>
                                {stats.activeJobs.map((job) => (
                                    <div key={job.id} className="flex items-center gap-2 text-[11px] bg-muted/20 p-2 rounded-md border border-border/10">
                                        <Loader2 className="h-3 w-3 animate-spin text-primary shrink-0" />
                                        <span className="truncate flex-1 font-medium">
                                            {job.title || job.url || "Fetching..."}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 pt-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 text-[10px] h-7 cursor-pointer"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    await fetch("/api/tasks", {
                                        method: "POST",
                                        body: JSON.stringify({ action: 'clear_completed' }),
                                        headers: { "Content-Type": "application/json" }
                                    });
                                }}
                            >
                                Clear Finished
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 cursor-pointer"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsVisible(false);
                                }}
                            >
                                <X className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
