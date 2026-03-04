"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, Check, ArrowRight, Scan, Globe, Clock, ExternalLink, Merge } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BookmarkWithTags } from "@/types";

interface DuplicateGroup {
    canonicalUrl: string;
    bookmarks: BookmarkWithTags[];
}

export function DuplicatesTab() {
    const [isScanning, setIsScanning] = useState(false);
    const [groups, setGroups] = useState<DuplicateGroup[]>([]);
    const [totalDuplicates, setTotalDuplicates] = useState(0);
    const [hasScanned, setHasScanned] = useState(false);
    const [mergingGroupIndex, setMergingGroupIndex] = useState<number | null>(null);

    const handleScan = async () => {
        setIsScanning(true);
        try {
            const res = await fetch("/api/bookmarks/duplicates");
            if (res.ok) {
                const data = await res.json();
                setGroups(data.groups || []);
                setTotalDuplicates(data.totalDuplicates || 0);
                setHasScanned(true);
                if ((data.groups || []).length === 0) {
                    toast.success("No duplicates found!");
                } else {
                    toast.info(`Found ${data.totalDuplicates} duplicate${data.totalDuplicates !== 1 ? "s" : ""} in ${data.groups.length} group${data.groups.length !== 1 ? "s" : ""}`);
                }
            } else {
                toast.error("Failed to scan for duplicates");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setIsScanning(false);
    };

    const handleMerge = async (groupIndex: number, primaryId: string, duplicateId: string) => {
        setMergingGroupIndex(groupIndex);
        try {
            const res = await fetch("/api/bookmarks/duplicates/merge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ primaryId, duplicateId }),
            });
            if (res.ok) {
                toast.success("Bookmarks merged successfully");
                // Remove the merged group from the list
                setGroups(prev => prev.filter((_, i) => i !== groupIndex));
                setTotalDuplicates(prev => prev - 1);
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to merge bookmarks");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setMergingGroupIndex(null);
    };

    const handleDismiss = (groupIndex: number) => {
        setGroups(prev => prev.filter((_, i) => i !== groupIndex));
    };

    const hostname = (url: string) => {
        try { return new URL(url).hostname.replace("www.", ""); } catch { return url; }
    };

    return (
        <div className="space-y-6">
            {/* Controls Card */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold tracking-tight">
                        <Copy className="h-5 w-5 text-primary" />
                        Duplicate Detection
                    </CardTitle>
                    <CardDescription>Find bookmarks that point to the same page despite having different URLs (tracking params, www prefix, etc.).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4">
                        <Button onClick={handleScan} disabled={isScanning} className="cursor-pointer shadow-sm">
                            {isScanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Scan className="h-4 w-4 mr-2" />}
                            Scan for Duplicates
                        </Button>
                        {hasScanned && (
                            <span className="text-sm text-muted-foreground">
                                {groups.length === 0
                                    ? "No duplicates found"
                                    : `${totalDuplicates} duplicate${totalDuplicates !== 1 ? "s" : ""} in ${groups.length} group${groups.length !== 1 ? "s" : ""}`
                                }
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {hasScanned && groups.length === 0 && (
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                    <CardContent className="p-0">
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                                <Check className="h-5 w-5 text-emerald-500" />
                            </div>
                            <p className="text-sm font-semibold">No Duplicates</p>
                            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">All your bookmarks have unique canonical URLs. Nothing to merge.</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {groups.map((group, groupIndex) => (
                <Card key={group.canonicalUrl} className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden animate-in fade-in slide-in-from-bottom-1 duration-300">
                    <CardHeader className="pb-3 border-b border-border/10">
                        <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                                <CardTitle className="text-sm flex items-center gap-2 font-medium">
                                    <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                    <span className="truncate text-muted-foreground font-mono text-xs">{hostname(group.canonicalUrl)}</span>
                                    <Badge variant="secondary" className="text-[10px] shrink-0">{group.bookmarks.length} copies</Badge>
                                </CardTitle>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2 cursor-pointer shrink-0"
                                onClick={() => handleDismiss(groupIndex)}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-border/10">
                            {group.bookmarks.map((bm, bmIndex) => {
                                const otherIds = group.bookmarks.filter(b => b.id !== bm.id).map(b => b.id);
                                const isMerging = mergingGroupIndex === groupIndex;

                                return (
                                    <div key={bm.id} className={cn(
                                        "flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/10",
                                        bmIndex === 0 ? "bg-primary/[0.02]" : ""
                                    )}>
                                        {/* Bookmark Info */}
                                        <div className="flex-1 min-w-0 space-y-1.5">
                                            <div className="flex items-center gap-2">
                                                <img
                                                    src={bm.favicon || `https://twenty-icons.com/${hostname(bm.url)}`}
                                                    alt=""
                                                    className="w-4 h-4 object-contain shrink-0"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                                                />
                                                <p className="text-sm font-medium truncate">{bm.title || "(No title)"}</p>
                                                {bmIndex === 0 && (
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 border-primary/30 text-primary shrink-0">Oldest</Badge>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground truncate font-mono">{bm.url}</p>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {bm.tags.map(tag => (
                                                    <Badge key={tag.id} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                                                        #{tag.name}
                                                    </Badge>
                                                ))}
                                                {bm.collections?.map(col => (
                                                    <Badge
                                                        key={col.id}
                                                        variant="outline"
                                                        className="text-[10px] px-1.5 py-0 h-5 gap-1"
                                                        style={col.color ? {
                                                            borderColor: `color-mix(in srgb, ${col.color} 30%, transparent)`,
                                                            color: col.color,
                                                        } : {}}
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color || "hsl(var(--primary))" }} />
                                                        {col.name}
                                                    </Badge>
                                                ))}
                                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                                                    <Clock className="h-2.5 w-2.5" />
                                                    {new Date(bm.createdAt.endsWith("Z") ? bm.createdAt : bm.createdAt + "Z").toLocaleDateString("en-US", {
                                                        month: "short", day: "numeric", year: "numeric"
                                                    })}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex items-center gap-2 shrink-0">
                                            <a
                                                href={bm.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-muted-foreground hover:text-foreground transition-colors"
                                            >
                                                <ExternalLink className="h-3.5 w-3.5" />
                                            </a>
                                            {group.bookmarks.length === 2 && (
                                                <Button
                                                    size="sm"
                                                    variant={bmIndex === 0 ? "default" : "outline"}
                                                    className="h-7 text-[11px] gap-1.5 cursor-pointer"
                                                    disabled={isMerging}
                                                    onClick={() => handleMerge(groupIndex, bm.id, otherIds[0])}
                                                >
                                                    {isMerging ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <Merge className="h-3 w-3" />
                                                    )}
                                                    Keep this
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Multi-dupe info banner */}
                        {group.bookmarks.length > 2 && (
                            <div className="px-6 py-3 bg-muted/20 border-t border-border/10">
                                <p className="text-[11px] text-muted-foreground">
                                    This group has {group.bookmarks.length} copies. Use the &quot;Keep this&quot; buttons above for a pair, or manually delete extras from the main view.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
