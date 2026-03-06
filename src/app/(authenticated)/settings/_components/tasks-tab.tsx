"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RefreshCw, Trash2, Image, Brain, Square, Check, Database } from "lucide-react";
import { cn } from "@/lib/utils";

interface TasksTabProps {
    taskStats: any;
    onRetryFailed: () => Promise<void>;
    onClearTasks: (action: 'clear_completed' | 'clear_all') => Promise<void>;
    onStartBulkJob: (jobType: 'backfill_thumbnails' | 'backfill_embeddings', overwrite?: boolean) => Promise<void>;
    onCancelJob: (jobId: string) => Promise<void>;
    isRetrying: boolean;
    isClearing: boolean;
}

export function TasksTab({ taskStats, onRetryFailed, onClearTasks, onStartBulkJob, onCancelJob, isRetrying, isClearing }: TasksTabProps) {
    const thumbJob = (taskStats?.bulkJobs || []).find((j: any) => j.type === 'backfill_thumbnails');
    const thumbIsRunning = thumbJob?.status === 'processing';
    const thumbIsPending = thumbJob?.status === 'pending';
    const thumbProgress = thumbJob?.progress || 0;
    const thumbPayload = (() => { try { return thumbJob?.payload ? JSON.parse(thumbJob.payload) : {}; } catch { return {}; } })();
    const thumbProcessed = thumbPayload.processed || 0;
    const thumbTotal = thumbPayload.total || 0;
    const missingThumbnails = taskStats?.maintenance?.missingThumbnails || 0;

    const embedJob = (taskStats?.bulkJobs || []).find((j: any) => j.type === 'backfill_embeddings');
    const embedIsRunning = embedJob?.status === 'processing';
    const embedIsPending = embedJob?.status === 'pending';
    const embedProgress = embedJob?.progress || 0;
    const embedPayload = (() => { try { return embedJob?.payload ? JSON.parse(embedJob.payload) : {}; } catch { return {}; } })();
    const embedProcessed = embedPayload.processed || 0;
    const embedTotal = embedPayload.total || 0;
    const missingEmbeddings = taskStats?.maintenance?.missingEmbeddings || 0;

    return (
        <div className="space-y-4">
            {/* Top row: Thumbnails + Embeddings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Thumbnails Card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                        <div className="flex items-start gap-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", thumbIsRunning ? "bg-primary/10" : "bg-muted/40")}>
                                <Image className={cn("h-5 w-5", thumbIsRunning ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                                <CardTitle className="text-base">Fetch Thumbnails</CardTitle>
                                <CardDescription className="text-xs mt-0.5">Fetch thumbnails for your bookmarks. Fetch only missing ones, or re-fetch all.</CardDescription>
                            </div>
                        </div>
                        {thumbIsRunning && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 animate-pulse">{thumbPayload.overwrite ? "Refetching All" : "Fetching Missing"}</Badge>}
                        {thumbIsPending && <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/20 shrink-0">Queued</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(thumbIsRunning || thumbIsPending) ? (
                            <>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground font-medium flex items-center gap-2">
                                            {thumbIsRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                            {thumbIsRunning ? (thumbTotal > 0 ? `${thumbProcessed} / ${thumbTotal} processed` : "Starting...") : "Waiting to start..."}
                                        </span>
                                        {thumbIsRunning && <span className="text-muted-foreground font-mono text-[11px]">{thumbProgress}%</span>}
                                    </div>
                                    {thumbIsRunning && (
                                        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-700 rounded-full" style={{ width: `${thumbProgress}%` }} />
                                        </div>
                                    )}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => onCancelJob(thumbJob.id)} className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-destructive hover:border-destructive/30">
                                    <Square className="h-3 w-3" />Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                {missingThumbnails > 0 ? (
                                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{missingThumbnails}</span> bookmarks missing thumbnails</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />All bookmarks have thumbnails</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => onStartBulkJob('backfill_thumbnails', false)} disabled={missingThumbnails === 0} className="h-9 text-xs gap-2 cursor-pointer">
                                        <RefreshCw className="h-3.5 w-3.5" />Fetch Missing
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => onStartBulkJob('backfill_thumbnails', true)} className="h-9 text-xs gap-2 cursor-pointer">
                                        <RefreshCw className="h-3.5 w-3.5" />Refetch All
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Embeddings Card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                        <div className="flex items-start gap-3">
                            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors", embedIsRunning ? "bg-primary/10" : "bg-muted/40")}>
                                <Brain className={cn("h-5 w-5", embedIsRunning ? "text-primary" : "text-muted-foreground")} />
                            </div>
                            <div>
                                <CardTitle className="text-base">Generate Embeddings</CardTitle>
                                <CardDescription className="text-xs mt-0.5">Generate vector embeddings for semantic search on bookmarks that are missing them. <span className="text-destructive font-medium">Sensitive links are excluded.</span></CardDescription>
                            </div>
                        </div>
                        {embedIsRunning && <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 animate-pulse">{embedPayload.overwrite ? "Regenerating All" : "Generating Missing"}</Badge>}
                        {embedIsPending && <Badge variant="outline" className="text-[10px] bg-amber-500/5 text-amber-500 border-amber-500/20 shrink-0">Queued</Badge>}
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(embedIsRunning || embedIsPending) ? (
                            <>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground font-medium flex items-center gap-2">
                                            {embedIsRunning && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
                                            {embedIsRunning ? (embedTotal > 0 ? `${embedProcessed} / ${embedTotal} processed` : "Starting...") : "Waiting to start..."}
                                        </span>
                                        {embedIsRunning && <span className="text-muted-foreground font-mono text-[11px]">{embedProgress}%</span>}
                                    </div>
                                    {embedIsRunning && (
                                        <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                            <div className="h-full bg-primary transition-all duration-700 rounded-full" style={{ width: `${embedProgress}%` }} />
                                        </div>
                                    )}
                                </div>
                                <Button variant="outline" size="sm" onClick={() => onCancelJob(embedJob.id)} className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-destructive hover:border-destructive/30">
                                    <Square className="h-3 w-3" />Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                {missingEmbeddings > 0 ? (
                                    <p className="text-xs text-muted-foreground"><span className="font-semibold text-foreground">{missingEmbeddings}</span> bookmarks missing embeddings</p>
                                ) : (
                                    <p className="text-xs text-emerald-500 flex items-center gap-1.5"><Check className="h-3.5 w-3.5" />All bookmarks have embeddings</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <Button size="sm" onClick={() => onStartBulkJob('backfill_embeddings', false)} disabled={missingEmbeddings === 0} className="h-9 text-xs gap-2 cursor-pointer">
                                        <RefreshCw className="h-3.5 w-3.5" />Generate Missing
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => onStartBulkJob('backfill_embeddings', true)} className="h-9 text-xs gap-2 cursor-pointer">
                                        <RefreshCw className="h-3.5 w-3.5" />Regenerate All
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Bottom row: Statistics + Active Queue */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Job Statistics */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                        <div>
                            <CardTitle className="text-lg">Statistics</CardTitle>
                            <CardDescription>Overall background job counts.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={onRetryFailed} disabled={isRetrying || !taskStats?.failed} className="h-8 text-[11px] gap-1.5 cursor-pointer">
                                <RefreshCw className={cn("h-3 w-3", isRetrying && "animate-spin")} />Retry Failed
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onClearTasks('clear_completed')} disabled={isClearing || !taskStats?.completed} className="h-8 text-[11px] gap-1.5 cursor-pointer text-muted-foreground hover:text-foreground">
                                <Trash2 className="h-3 w-3" />Clear Done
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
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
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-medium flex items-center gap-2">
                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />Processing
                                    </span>
                                    <span className="text-muted-foreground font-mono">
                                        {Math.round((taskStats.completed / (taskStats.pending + taskStats.processing + taskStats.completed + taskStats.failed || 1)) * 100)}%
                                    </span>
                                </div>
                                <div className="h-2 w-full bg-muted/40 rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-700" style={{ width: `${(taskStats.completed / (taskStats.pending + taskStats.processing + taskStats.completed + taskStats.failed || 1)) * 100}%` }} />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Active Queue */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader>
                        <CardTitle className="text-lg">Active Queue</CardTitle>
                        <CardDescription>Currently active or pending jobs.</CardDescription>
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
                                                <p className="text-sm font-medium truncate">{job.title || job.url || "New Link"}</p>
                                                <p className="text-[10px] text-muted-foreground truncate">{job.url}</p>
                                            </div>
                                        </div>
                                        <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0 capitalize">{job.type.replace('_', ' ')}</Badge>
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
        </div>
    );
}
