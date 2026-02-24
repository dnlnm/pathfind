"use client";

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
}

export function BookmarkCard({
    bookmark,
    onEdit,
    onRefresh,
    layout = "list",
    isSelected = false,
    onSelect,
    selectionMode = false
}: BookmarkCardProps) {
    const router = useRouter();

    const handleToggle = async (field: "isReadLater" | "isArchived") => {
        try {
            const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    [field]: !bookmark[field],
                    tags: bookmark.tags.map((t) => t.name),
                    collections: bookmark.collections?.map((c) => c.id),
                }),
            });
            if (res.ok) {
                toast.success(
                    field === "isReadLater"
                        ? bookmark.isReadLater
                            ? "Removed from Read Later"
                            : "Added to Read Later"
                        : bookmark.isArchived
                            ? "Unarchived"
                            : "Archived"
                );
                onRefresh();
            }
        } catch {
            toast.error("Failed to update bookmark");
        }
    };

    const handleDelete = async () => {
        try {
            const res = await fetch(`/api/bookmarks/${bookmark.id}`, {
                method: "DELETE",
            });
            if (res.ok) {
                toast.success("Bookmark deleted");
                onRefresh();
            }
        } catch {
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

    return (
        <Card
            className={cn(
                "group border-border/40 bg-card/50 hover:bg-card/80 hover:border-border/60 transition-all duration-200 overflow-hidden flex flex-col p-0 gap-0 relative",
                isGrid ? "rounded-2xl h-[340px]" : "min-h-[110px]",
                isSelected ? "ring-2 ring-primary bg-primary/5" : "",
                selectionMode ? "cursor-pointer select-none" : ""
            )}
            onClick={() => {
                if (selectionMode) {
                    onSelect?.(bookmark.id, !isSelected);
                }
            }}
        >
            {isSelected && (
                <div className="absolute inset-0 bg-primary/5 z-10 pointer-events-none" />
            )}
            {isGrid && bookmark.thumbnail && (
                <div className="w-full aspect-video rounded-t-2xl border-b border-border/20 bg-muted/30 overflow-hidden relative shrink-0">
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                        <Globe className="h-8 w-8" />
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={bookmark.thumbnail}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                        onError={(e) => {
                            (e.target as HTMLImageElement).style.opacity = "0";
                        }}
                        loading="lazy"
                    />
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
                                    href={bookmark.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-sm font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 w-full ${isGrid ? "text-base leading-tight" : ""}`}
                                    onClick={(e) => {
                                        if (selectionMode) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onSelect?.(bookmark.id, !isSelected);
                                        }
                                    }}
                                >
                                    {!isGrid && (
                                        <>
                                            <img
                                                src={bookmark.favicon || twentyFavicon}
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
                                        {bookmark.title || bookmark.url}
                                    </span>
                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                </a>
                                <p className="text-xs text-muted-foreground/70 truncate mt-0.5 hidden sm:block">
                                    {hostname}
                                </p>
                            </div>
                        </div>

                        {bookmark.description && (
                            <p className={cn(
                                "text-xs text-muted-foreground",
                                isGrid ? "line-clamp-2" : "truncate"
                            )}>
                                {bookmark.description}
                            </p>
                        )}

                        {/* Tags & Date */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 mt-auto">
                            {tagList.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-xs px-2 py-0 h-6 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                                    onClick={(e) => {
                                        if (selectionMode) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onSelect?.(bookmark.id, !isSelected);
                                        } else {
                                            router.push(`/?tag=${tag.name}`);
                                        }
                                    }}
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                            {bookmark.collections?.map((col) => (
                                <Badge
                                    key={col.id}
                                    variant="outline"
                                    className="text-xs px-2 py-0 h-6 cursor-pointer hover:bg-primary/20 transition-colors gap-1 border-primary/20"
                                    onClick={(e) => {
                                        if (selectionMode) {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            onSelect?.(bookmark.id, !isSelected);
                                        } else {
                                            router.push(`/?collection=${col.id}`);
                                        }
                                    }}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    {col.name}
                                </Badge>
                            ))}
                            {bookmark.isReadLater && (
                                <Badge variant="outline" className="text-xs px-2 py-0 h-6 border-amber-500/30 text-amber-500">
                                    <Clock className="h-3 w-3 mr-1" />
                                    read later
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
                                            <DropdownMenuItem onClick={() => onEdit(bookmark)} className="cursor-pointer">
                                                <Pencil className="h-4 w-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleToggle("isReadLater")} className="cursor-pointer">
                                                <Clock className="h-4 w-4 mr-2" />
                                                {bookmark.isReadLater ? "Remove from Read Later" : "Read Later"}
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleToggle("isArchived")} className="cursor-pointer">
                                                {bookmark.isArchived ? (
                                                    <><ArchiveRestore className="h-4 w-4 mr-2" /> Unarchive</>
                                                ) : (
                                                    <><Archive className="h-4 w-4 mr-2" /> Archive</>
                                                )}
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={handleDelete}
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
                                    {new Date(bookmark.createdAt).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                    })}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Thumbnail (List View Only) */}
                    {!isGrid && bookmark.thumbnail && (
                        <div className="shrink-0 ml-2 w-24 h-16 sm:w-36 sm:h-20 rounded-lg border border-border/30 bg-muted/50 overflow-hidden relative self-center">
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/20">
                                <Globe className="h-6 w-6" />
                            </div>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={bookmark.thumbnail}
                                alt=""
                                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-300"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.opacity = "0";
                                }}
                                loading="lazy"
                            />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
