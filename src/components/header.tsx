"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { Search, Plus, X, RefreshCw, ChevronRight, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface HeaderProps {
    onAddBookmark: () => void;
}

export function Header({ onAddBookmark }: HeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");
    const [taskStats, setTaskStats] = useState<any>(null);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch("/api/tasks");
                if (res.ok) {
                    const data = await res.json();
                    setTaskStats(data);
                }
            } catch (err) {
                // Silent fail
            }
        };

        fetchTasks();
        const interval = setInterval(fetchTasks, 3000);
        return () => clearInterval(interval);
    }, []);

    const taskCount = (taskStats?.pending || 0) + (taskStats?.processing || 0);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
            params.set("q", query);
        } else {
            params.delete("q");
        }
        params.delete("page");
        router.push(`/?${params.toString()}`);
    };

    const clearSearch = () => {
        setQuery("");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        router.push(`/?${params.toString()}`);
    };

    return (
        <header className="sticky top-0 z-30 flex items-center border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
            <div className="flex items-center w-10 sm:w-48">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
            </div>

            <div className="flex-1 flex justify-center px-4 font-normal">
                <form
                    onSubmit={handleSearch}
                    className="relative w-full max-w-xl"
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search bookmarks..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9 pr-9 bg-muted/40 border-border/40 focus:bg-background transition-colors"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={clearSearch}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </form>
            </div>

            <div className="flex items-center justify-end w-10 sm:w-auto gap-2">
                {taskCount > 0 && (
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-primary transition-colors cursor-pointer px-2">
                                <div className="relative">
                                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                                    <Badge className="absolute -top-2 -right-2 h-4 min-w-[16px] px-1 flex items-center justify-center text-[10px] bg-primary text-primary-foreground border-none">
                                        {taskCount}
                                    </Badge>
                                </div>
                                <span className="hidden md:inline text-xs font-medium">Tasks</span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 overflow-hidden border-border/50 shadow-2xl" align="end" sideOffset={12}>
                            <div className="bg-card">
                                {/* Header */}
                                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold">Background Tasks</h4>
                                            <p className="text-[10px] text-muted-foreground">{taskCount} tasks remaining</p>
                                        </div>
                                    </div>
                                    <Link href="/settings?tab=tasks">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted/50">
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </Link>
                                </div>

                                {/* Progress Bar */}
                                {taskStats && (
                                    <div className="h-1 w-full bg-muted/30">
                                        <div
                                            className="h-full bg-primary transition-all duration-700"
                                            style={{
                                                width: `${Math.round((taskStats.completed / (taskStats.pending + taskStats.processing + taskStats.completed + taskStats.failed)) * 100)}%`
                                            }}
                                        />
                                    </div>
                                )}

                                {/* Content */}
                                <div className="p-2 max-h-[300px] overflow-y-auto">
                                    {taskStats?.activeJobs && taskStats.activeJobs.length > 0 ? (
                                        <div className="space-y-1">
                                            {taskStats.activeJobs.map((job: any) => (
                                                <div key={job.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                                                    <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                                                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[11px] font-medium truncate">{job.title || job.url}</p>
                                                        <p className="text-[9px] text-muted-foreground truncate">{job.url}</p>
                                                    </div>
                                                </div>
                                            ))}
                                            {taskStats.pending > taskStats.activeJobs.length && (
                                                <p className="text-[10px] text-center text-muted-foreground py-2 border-t border-border/20 mt-1">
                                                    + {taskStats.pending} more in queue
                                                </p>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="py-8 text-center text-muted-foreground">
                                            <p className="text-xs">No active tasks found.</p>
                                        </div>
                                    )}
                                </div>

                                {/* Footer Link */}
                                <Link href="/settings?tab=tasks">
                                    <div className="p-3 bg-muted/20 border-t border-border/40 hover:bg-muted/40 transition-colors text-center cursor-pointer">
                                        <span className="text-[11px] font-medium text-primary">View Full Queue</span>
                                    </div>
                                </Link>
                            </div>
                        </PopoverContent>
                    </Popover>
                )}
                <Button onClick={onAddBookmark} size="sm" className="gap-2 cursor-pointer shadow-sm shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Bookmark</span>
                </Button>
            </div>
        </header>
    );
}
