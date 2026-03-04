"use client";

import { useState, useEffect } from "react";
import { BookmarkWithTags } from "@/types";
import {
    Card,
    CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Button } from "@/components/ui/button";
import {
    MoreHorizontal,
    ExternalLink,
    Clock,
    Archive,
    Pencil,
    Trash2,
    Globe,
    ArchiveRestore,
    EyeOff,
    Eye,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";

interface BookmarkCardProps {
    bookmark: BookmarkWithTags;
    onEdit: (bookmark: BookmarkWithTags) => void;
    onRefresh: () => void;
    layout?: "list" | "grid";
    isSelected?: boolean;
    onSelect?: (id: string, selected: boolean) => void;
    selectionMode?: boolean;
    nsfwDisplayMode?: "blur" | "hide" | "show";
}

export function BookmarkCard({
    bookmark,
    onEdit,
    onRefresh,
    layout = "list",
    isSelected = false,
    onSelect,
    selectionMode = false,
    nsfwDisplayMode = "blur"
}: BookmarkCardProps) {
    const router = useRouter();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [clickAction, setClickAction] = useState<"current" | "new">("new");
    // Optimistic local state — mirrors the bookmark prop but updates immediately
    const [localBookmark, setLocalBookmark] = useState(bookmark);
    const [isDeleted, setIsDeleted] = useState(false);

    // Sync local state when the parent passes a new bookmark prop (e.g. after a real refresh)
    useEffect(() => {
        setLocalBookmark(bookmark);
    }, [bookmark]);

    useEffect(() => {
        const saved = localStorage.getItem("bookmark-click-action") as "current" | "new" | null;
        if (saved) setClickAction(saved);

        // Add listener for real-time updates when setting is changed in another tab or component
        const handleStorageChange = () => {
            const updated = localStorage.getItem("bookmark-click-action") as "current" | "new" | null;
            if (updated) setClickAction(updated);
        };

        // Listen to storage events (from other tabs) and custom events (from our setting tab)
        window.addEventListener("storage", handleStorageChange);
        window.addEventListener("bookmark-click-action-changed", handleStorageChange);

        return () => {
            window.removeEventListener("storage", handleStorageChange);
            window.removeEventListener("bookmark-click-action-changed", handleStorageChange);
        };
    }, []);

    const handleToggle = async (field: "isReadLater" | "isArchived" | "isNsfw") => {
        const previousValue = localBookmark[field];
        const nextValue = !previousValue;

        // Optimistically flip the local state immediately
        setLocalBookmark(prev => ({ ...prev, [field]: nextValue }));
        if (field === "isNsfw" && nextValue === false) setRevealed(false);

        const successMessage =
            field === "isReadLater"
                ? previousValue ? "Removed from Read Later" : "Added to Read Later"
                : field === "isNsfw"
                    ? previousValue ? "NSFW flag removed" : "Marked as NSFW"
                    : previousValue ? "Unarchived" : "Archived";

        try {
            const res = await fetch(`/api/bookmarks/${localBookmark.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [field]: nextValue,
                    tags: localBookmark.tags.map((t) => t.name),
                    collections: localBookmark.collections?.map((c) => c.id),
                }),
            });
            if (res.ok) {
                toast.success(successMessage);
                // Quietly sync in background without a blocking re-fetch
                onRefresh();
            } else {
                // Revert on server error
                setLocalBookmark(prev => ({ ...prev, [field]: previousValue }));
                toast.error("Failed to update bookmark");
            }
        } catch {
            // Revert on network error
            setLocalBookmark(prev => ({ ...prev, [field]: previousValue }));
            toast.error("Failed to update bookmark");
        }
    };

    const handleDelete = async () => {
        // Optimistically hide the card immediately
        setIsDeleted(true);

        try {
            const res = await fetch(`/api/bookmarks/${localBookmark.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Bookmark deleted");
                onRefresh();
            } else {
                // Revert — bring the card back
                setIsDeleted(false);
                toast.error("Failed to delete bookmark");
            }
        } catch {
            setIsDeleted(false);
            toast.error("Failed to delete bookmark");
        }
    };

    const hostname = (() => {
        try {
            return new URL(bookmark.url).hostname.replace("www.", "");
        } catch {
            return bookmark.url;
        }
    })();

    const twentyFavicon = `https://twenty-icons.com/${hostname}`;

    const tagList = bookmark.tags;

    const isGrid = layout === "grid";

    if (isDeleted) return null;

    return (
        <>
            <Card
                className={cn(
                    "group border-border/40 bg-card/50 hover:bg-card/80 hover:border-border/60 transition-all duration-200 overflow-hidden flex flex-col p-0 gap-0 relative",
                    isGrid ? "rounded-2xl h-[340px]" : "min-h-[110px]",
                    isSelected ? "ring-2 ring-primary bg-primary/5" : "",
                    selectionMode ? "cursor-pointer select-none" : ""
                )}
                onClick={() => {
                    if (selectionMode) {
                        onSelect?.(localBookmark.id, !isSelected);
                    }
                }}
            >
                {isSelected && (
                    <div className="absolute inset-0 bg-primary/5 z-10 pointer-events-none" />
                )}
                {isGrid && localBookmark.thumbnail && (
                    <div className="w-full aspect-video rounded-t-2xl border-b border-border/20 bg-muted/30 overflow-hidden relative shrink-0">
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                            <Globe className="h-8 w-8" />
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={localBookmark.thumbnail!}
                            alt=""
                            className={cn(
                                "absolute inset-0 w-full h-full object-cover transition-all duration-300",
                                localBookmark.isNsfw && !revealed && nsfwDisplayMode !== "show" ? "blur-xl scale-110" : ""
                            )}
                            onError={(e) => {
                                (e.target as HTMLImageElement).style.opacity = "0";
                            }}
                            loading="lazy"
                        />
                        {localBookmark.isNsfw && !revealed && nsfwDisplayMode !== "show" && (
                            <button
                                className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 z-20 cursor-pointer"
                                onClick={(e) => { e.stopPropagation(); setRevealed(true); }}
                            >
                                <div className="bg-background/60 backdrop-blur-sm rounded-xl px-3 py-2 flex flex-col items-center gap-1">
                                    <EyeOff className="h-4 w-4 text-foreground/70" />
                                    <span className="text-[10px] font-medium text-foreground/70">Click to reveal</span>
                                </div>
                            </button>
                        )}
                        {selectionMode && (
                            <div className="absolute top-3 left-3 z-30">
                                <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={(checked) => onSelect?.(bookmark.id, !!checked)}
                                    className="bg-background/80 shadow-sm border-white/20"
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        )}
                    </div>
                )}
                <CardContent className={cn(
                    "p-3 flex-1 flex flex-col min-h-0",
                    isGrid ? "p-4" : ""
                )}>
                    <div className={cn("flex gap-3 h-full", isGrid ? "flex-col gap-2 items-start" : "items-stretch")}>
                        {/* Left Column: Favicon & Checkbox */}
                        <div className={cn(
                            "flex flex-col items-center gap-2.5 shrink-0",
                            (!isGrid && !selectionMode) ? "hidden sm:flex" : "flex"
                        )}>
                            {(!isGrid || !bookmark.thumbnail) && (
                                <div className={cn(
                                    "mt-0.5 w-8 h-8 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden",
                                    isGrid ? "w-10 h-10 mt-0" : ""
                                )}>
                                    {bookmark.favicon ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={bookmark.favicon}
                                            alt=""
                                            className="w-5 h-5 object-contain"
                                            onError={(e) => {
                                                const target = e.target as HTMLImageElement;
                                                if (target.src !== twentyFavicon) {
                                                    target.src = twentyFavicon;
                                                } else {
                                                    target.style.display = "none";
                                                    target.nextElementSibling?.classList.remove("hidden");
                                                }
                                            }}
                                        />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            src={twentyFavicon}
                                            alt=""
                                            className="w-5 h-5 object-contain"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).style.display = "none";
                                                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                            }}
                                        />
                                    )}
                                    <Globe className={cn("h-4 w-4 text-muted-foreground hidden")} />
                                </div>
                            )}

                            {selectionMode && (!isGrid || !bookmark.thumbnail) && (
                                <div className="flex items-center justify-center py-1">
                                    <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={(checked) => onSelect?.(bookmark.id, !!checked)}
                                        className="bg-background/80 shadow-sm"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 space-y-1 w-full flex flex-col">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <a
                                        href={localBookmark.url}
                                        target={clickAction === "new" ? "_blank" : "_self"}
                                        rel="noopener noreferrer"
                                        className={`text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 w-full ${isGrid ? "text-base leading-tight" : ""}`}
                                        onClick={(e) => {
                                            if (selectionMode) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSelect?.(localBookmark.id, !isSelected);
                                            }
                                        }}
                                    >
                                        {!isGrid && (
                                            <>
                                                <img
                                                    src={localBookmark.favicon || twentyFavicon}
                                                    alt=""
                                                    className="w-3.5 h-3.5 object-contain sm:hidden"
                                                    onError={(e) => {
                                                        const target = e.target as HTMLImageElement;
                                                        if (target.src !== twentyFavicon) {
                                                            target.src = twentyFavicon;
                                                        } else {
                                                            target.classList.add("hidden");
                                                            target.nextElementSibling?.classList.remove("hidden");
                                                        }
                                                    }}
                                                />
                                                <Globe className={cn("h-3 w-3 text-muted-foreground/50 sm:hidden hidden")} />
                                            </>
                                        )}
                                        <span className={cn("truncate", isGrid ? "line-clamp-2 white-space-normal" : "flex-1")}>
                                            {localBookmark.title || localBookmark.url}
                                        </span>
                                        <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                    </a>
                                    <p className="text-xs text-muted-foreground/70 truncate mt-0.5 hidden sm:block">
                                        {hostname}
                                    </p>
                                </div>
                            </div>

                            {localBookmark.description && (
                                <p className={cn(
                                    "text-xs text-muted-foreground",
                                    isGrid ? "line-clamp-2" : "truncate"
                                )}>
                                    {localBookmark.description}
                                </p>
                            )}

                            {/* Tags & Date */}
                            <div className="flex items-center gap-2 flex-wrap pt-1 mt-auto">
                                {localBookmark.tags.map((tag) => (
                                    <Badge
                                        key={tag.id}
                                        variant="secondary"
                                        className="text-xs px-2 py-0 h-6 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                                        onClick={(e) => {
                                            if (selectionMode) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSelect?.(localBookmark.id, !isSelected);
                                            } else {
                                                router.push(`/?tag=${tag.name}`);
                                            }
                                        }}
                                    >
                                        #{tag.name}
                                    </Badge>
                                ))}
                                {localBookmark.collections?.map((col) => (
                                    <Badge
                                        key={col.id}
                                        variant="outline"
                                        className="text-xs px-2 py-0 h-6 cursor-pointer hover:opacity-80 transition-opacity gap-1"
                                        style={col.color ? {
                                            borderColor: `color-mix(in srgb, ${col.color} 30%, transparent)`,
                                            backgroundColor: `color-mix(in srgb, ${col.color} 10%, transparent)`,
                                            color: col.color
                                        } : {
                                            borderColor: 'hsl(var(--primary) / 0.2)',
                                            color: 'hsl(var(--primary))'
                                        }}
                                        onClick={(e) => {
                                            if (selectionMode) {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                onSelect?.(localBookmark.id, !isSelected);
                                            } else {
                                                router.push(`/?collection=${col.id}`);
                                            }
                                        }}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col.color || "hsl(var(--primary))" }} />
                                        {col.name}
                                    </Badge>
                                ))}
                                {localBookmark.isReadLater && (
                                    <Badge variant="outline" className="text-xs px-2 py-0 h-6 border-amber-500/30 text-amber-500">
                                        <Clock className="h-3 w-3 mr-1" />
                                        read later
                                    </Badge>
                                )}
                                {localBookmark.isNsfw && (
                                    <Badge variant="outline" className="bg-rose-50 dark:bg-rose-800 px-0 w-6 h-6 flex items-center justify-center border-rose-500/30" title="NSFW">
                                        <EyeOff className="h-3.5 w-3.5" />
                                    </Badge>
                                )}
                                <div className="flex items-center gap-1.5 ml-auto">
                                    <div className={cn("flex shrink-0", selectionMode ? "invisible pointer-events-none" : "")}>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={cn(
                                                        "h-6 w-6 transition-opacity shrink-0 cursor-pointer",
                                                        isGrid ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                                    )}
                                                >
                                                    <MoreHorizontal className="h-3.5 w-3.5" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48">
                                                <DropdownMenuItem onClick={() => onEdit(localBookmark)} className="cursor-pointer">
                                                    <Pencil className="h-4 w-4 mr-2" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggle("isReadLater")} className="cursor-pointer">
                                                    <Clock className="h-4 w-4 mr-2" />
                                                    {localBookmark.isReadLater ? "Remove from Read Later" : "Read Later"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggle("isArchived")} className="cursor-pointer">
                                                    {localBookmark.isArchived ? (
                                                        <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                                                    ) : (
                                                        <><Archive className="h-4 w-4 mr-2" /> Archive</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => handleToggle("isNsfw")} className="cursor-pointer">
                                                    {localBookmark.isNsfw ? (
                                                        <><Eye className="h-4 w-4 mr-2" /> Remove NSFW Flag</>
                                                    ) : (
                                                        <><EyeOff className="h-4 w-4 mr-2" /> Mark as NSFW</>
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setDeleteDialogOpen(true)}
                                                    className="text-destructive focus:text-destructive cursor-pointer"
                                                >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <span
                                        className="text-[10px] text-muted-foreground/50 whitespace-nowrap"
                                        suppressHydrationWarning
                                    >
                                        {new Date(localBookmark.createdAt.endsWith("Z") ? localBookmark.createdAt : localBookmark.createdAt + "Z").toLocaleDateString("en-US", {
                                            month: "short",
                                            day: "numeric",
                                            timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || undefined
                                        })}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Thumbnail (List View Only) */}
                        {!isGrid && localBookmark.thumbnail && (
                            <div className="shrink-0 ml-2 w-24 h-16 sm:w-36 sm:h-20 rounded-lg border border-border/30 bg-muted/50 overflow-hidden relative self-center">
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                                    <Globe className="h-6 w-6" />
                                </div>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={localBookmark.thumbnail}
                                    alt=""
                                    className={cn(
                                        "absolute inset-0 w-full h-full object-cover transition-all duration-300",
                                        localBookmark.isNsfw && !revealed && nsfwDisplayMode !== "show" ? "blur-lg scale-110" : ""
                                    )}
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.opacity = "0";
                                    }}
                                    loading="lazy"
                                />
                                {localBookmark.isNsfw && !revealed && nsfwDisplayMode !== "show" && (
                                    <button
                                        className="absolute inset-0 flex items-center justify-center z-10 cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); setRevealed(true); }}
                                    >
                                        <EyeOff className="h-4 w-4 text-foreground/60" />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete bookmark?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <span className="font-medium text-foreground">{localBookmark.title || localBookmark.url}</span>{" "}
                            will be permanently deleted and cannot be recovered.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
