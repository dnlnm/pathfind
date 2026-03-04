"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover";
import { useRef } from "react";
import { Search, Plus, X, RefreshCw, ChevronRight, Loader2, CheckCircle2, AlertCircle, Sparkles, HelpCircle, Archive, Tag, FolderOpen, Clock, Globe, Info, EyeOff } from "lucide-react";
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

    // Autocomplete state
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [triggerInfo, setTriggerInfo] = useState<{ type: string; start: number; length: number; prefix: string } | null>(null);
    const [allTags, setAllTags] = useState<string[]>([]);
    const [allCollections, setAllCollections] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

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

        // Fetch tags and collections for autocomplete
        fetch("/api/tags")
            .then(res => res.json())
            .then(data => setAllTags(data.map((t: any) => t.name)))
            .catch(() => { });

        fetch("/api/collections")
            .then(res => res.json())
            .then(data => setAllCollections(data.map((c: any) => c.name)))
            .catch(() => { });

        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const input = inputRef.current;
        if (!input) return;

        const cursor = input.selectionStart || 0;
        const beforeCursor = query.slice(0, cursor);

        // Detect triggers: is:, has:, tag:, collection:, #tag
        const isMatch = beforeCursor.match(/(?:^|\s)(-|!)?is:(\w*)$/i);
        const hasMatch = beforeCursor.match(/(?:^|\s)(-|!)?has:(\w*)$/i);
        const tagMatch = beforeCursor.match(/(?:^|\s)(-|!)?tag:(\w*)$/i);
        const hashMatch = beforeCursor.match(/(?:^|\s)(-|!)?#(\w*)$/i);
        const colMatch = beforeCursor.match(/(?:^|\s)(-|!)?collection:(\w*)$/i);

        let type = "";
        let prefix = "";
        let start = 0;

        if (isMatch) {
            type = "is";
            prefix = isMatch[2];
            start = isMatch.index! + isMatch[0].length - prefix.length;
        } else if (hasMatch) {
            type = "has";
            prefix = hasMatch[2];
            start = hasMatch.index! + hasMatch[0].length - prefix.length;
        } else if (tagMatch) {
            type = "tag";
            prefix = tagMatch[2];
            start = tagMatch.index! + tagMatch[0].length - prefix.length;
        } else if (hashMatch) {
            type = "hash";
            prefix = hashMatch[2];
            start = hashMatch.index! + hashMatch[0].length - prefix.length;
        } else if (colMatch) {
            type = "collection";
            prefix = colMatch[2];
            start = colMatch.index! + colMatch[0].length - prefix.length;
        }

        if (type) {
            let options: string[] = [];
            if (type === "is") options = ["archived", "readlater", "nsfw", "broken", "tagged", "incollection"];
            else if (type === "has") options = ["notes", "description", "thumbnail"];
            else if (type === "tag" || type === "hash") options = allTags;
            else if (type === "collection") options = allCollections;

            const filtered = options.filter(opt => opt.toLowerCase().startsWith(prefix.toLowerCase())).slice(0, 8);
            setSuggestions(filtered);
            setTriggerInfo({ type, start, length: prefix.length, prefix });
            setShowSuggestions(filtered.length > 0);
            setSelectedIndex(0);
        } else {
            setShowSuggestions(false);
            setTriggerInfo(null);
        }
    }, [query, allTags, allCollections]);

    const selectSuggestion = (suggestion: string) => {
        if (!triggerInfo) return;

        const before = query.slice(0, triggerInfo.start);
        const after = query.slice(triggerInfo.start + triggerInfo.length);

        // For collections/tags with spaces, we might need quotes. For now keep simple.
        const value = suggestion.includes(" ") ? `"${suggestion}"` : suggestion;
        const newQuery = before + value + after;
        setQuery(newQuery);
        setShowSuggestions(false);

        // Put cursor after the completion
        setTimeout(() => {
            const pos = triggerInfo.start + value.length;
            inputRef.current?.setSelectionRange(pos, pos);
            inputRef.current?.focus();
        }, 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions) {
            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % suggestions.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
            } else if (e.key === "Escape") {
                setShowSuggestions(false);
            }
        }
    };

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
                    className="relative flex items-center gap-2 w-full max-w-xl"
                >
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            placeholder={searchParams.get("ai") === "true" ? "Semantic search..." : "Search bookmarks..."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                            className="pl-9 pr-9 bg-muted/40 border-border/40 focus:bg-background transition-colors"
                        />
                        {showSuggestions && (
                            <div
                                ref={suggestionsRef}
                                className="absolute left-0 right-0 top-full mt-1 z-50 bg-card border border-border/50 rounded-lg shadow-2xl overflow-hidden py-1"
                            >
                                {suggestions.map((suggestion, index) => (
                                    <button
                                        key={suggestion}
                                        type="button"
                                        className={cn(
                                            "w-full text-left px-4 py-2 text-sm transition-colors flex items-center gap-2",
                                            index === selectedIndex ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                                        )}
                                        onMouseDown={(e) => {
                                            e.preventDefault();
                                            selectSuggestion(suggestion);
                                        }}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                    >
                                        {triggerInfo?.type === "is" && <Archive className="h-3.5 w-3.5 opacity-50" />}
                                        {triggerInfo?.type === "has" && <Info className="h-3.5 w-3.5 opacity-50" />}
                                        {(triggerInfo?.type === "tag" || triggerInfo?.type === "hash") && <Tag className="h-3.5 w-3.5 opacity-50" />}
                                        {triggerInfo?.type === "collection" && <FolderOpen className="h-3.5 w-3.5 opacity-50" />}
                                        <span>{suggestion}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {query && (
                            <button
                                type="button"
                                onClick={clearSearch}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Toggle
                        pressed={searchParams.get("ai") === "true"}
                        onPressedChange={(pressed) => {
                            const params = new URLSearchParams(searchParams.toString());
                            if (pressed) {
                                params.set("ai", "true");
                            } else {
                                params.delete("ai");
                            }
                            router.push(`/?${params.toString()}`);
                        }}
                        variant="outline"
                        size="sm"
                        className="flex shrink-0 gap-2 cursor-pointer transition-all shadow-sm px-3"
                        aria-label="Toggle AI Search"
                    >
                        <Sparkles className="h-4 w-4" />
                    </Toggle>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                                title="Search Syntax Help"
                            >
                                <HelpCircle className="h-4 w-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[320px] p-0 overflow-hidden border-border/50 shadow-2xl" align="end" sideOffset={12}>
                            <div className="bg-card">
                                <div className="p-4 border-b border-border/40 bg-muted/20">
                                    <div className="flex items-center gap-2">
                                        <Info className="h-4 w-4 text-primary" />
                                        <h4 className="text-sm font-bold">Search Syntax</h4>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-1">Power user qualifiers for precision search.</p>
                                </div>
                                <div className="p-3 space-y-3">
                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Filters</p>
                                        <div className="grid grid-cols-1 gap-1">
                                            {[
                                                { q: "is:archived", d: "Archived only", i: Archive },
                                                { q: "is:readlater", d: "Read later only", i: Clock },
                                                { q: "is:broken", d: "Broken links", i: AlertCircle },
                                                { q: "is:nsfw", d: "Sensitive content", i: EyeOff },
                                                { q: "has:notes", d: "With notes", i: Info },
                                            ].map(item => (
                                                <div key={item.q} className="flex items-center justify-between group py-1">
                                                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-primary font-mono">{item.q}</code>
                                                    <span className="text-[10px] text-muted-foreground">{item.d}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5 pt-2 border-t border-border/10">
                                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70">Attributes</p>
                                        <div className="space-y-1">
                                            {[
                                                { q: "url:github.com", d: "Match domain", i: Globe },
                                                { q: "#react", d: "Tag name", i: Tag },
                                                { q: "collection:Read", d: "Collection", i: FolderOpen },
                                                { q: "after:2024-01-01", d: "Since date" },
                                            ].map(item => (
                                                <div key={item.q} className="flex items-center justify-between py-1">
                                                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded text-primary font-mono">{item.q}</code>
                                                    <span className="text-[10px] text-muted-foreground">{item.d}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-2 p-2 rounded bg-primary/5 border border-primary/10">
                                        <p className="text-[10px] text-primary/80 leading-relaxed italic">
                                            Combine filters with text search. Use <strong>-</strong> or <strong>!</strong> to negate (e.g. <code>-is:nsfw</code>).
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
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
