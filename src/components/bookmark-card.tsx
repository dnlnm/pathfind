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

interface BookmarkCardProps {
    bookmark: BookmarkWithTags;
    onEdit: (bookmark: BookmarkWithTags) => void;
    onRefresh: () => void;
    layout?: "list" | "grid";
}

export function BookmarkCard({ bookmark, onEdit, onRefresh, layout = "list" }: BookmarkCardProps) {
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

    const tagList = bookmark.tags;

    const isGrid = layout === "grid";

    return (
        <Card className={cn(
            "group border-border/40 bg-card/50 hover:bg-card/80 hover:border-border/60 transition-all duration-200 overflow-hidden flex flex-col p-0 gap-0",
            isGrid ? "rounded-2xl h-[400px]" : "h-[110px]"
        )}>
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
                </div>
            )}
            <CardContent className={cn(
                "p-3 flex-1 flex flex-col min-h-0",
                isGrid ? "p-4" : ""
            )}>
                <div className={cn("flex gap-3 h-full", isGrid ? "flex-col gap-2 items-start" : "items-stretch")}>
                    {/* Favicon - only in list view or if no thumbnail in grid */}
                    {(!isGrid || !bookmark.thumbnail) && (
                        <div className={`mt-0.5 w-8 h-8 rounded-lg bg-muted/50 border border-border/30 flex items-center justify-center shrink-0 overflow-hidden ${isGrid ? "w-10 h-10 mt-0" : ""}`}>
                            {bookmark.favicon ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={bookmark.favicon}
                                    alt=""
                                    className="w-5 h-5 object-contain"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = "none";
                                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                                    }}
                                />
                            ) : null}
                            <Globe className={`h-4 w-4 text-muted-foreground ${bookmark.favicon ? "hidden" : ""}`} />
                        </div>
                    )}

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-1 w-full">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                                <a
                                    href={bookmark.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`text-sm font-medium text-foreground hover:text-primary transition-colors line-clamp-1 inline-flex items-center gap-1.5 ${isGrid ? "text-base leading-tight" : ""}`}
                                >
                                    {bookmark.title || bookmark.url}
                                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0" />
                                </a>
                                <p className="text-xs text-muted-foreground/70 truncate mt-0.5">
                                    {hostname}
                                </p>
                            </div>

                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 cursor-pointer ${isGrid ? "opacity-100" : ""}`}
                                    >
                                        <MoreHorizontal className="h-4 w-4" />
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

                        {bookmark.description && (
                            <p className={`text-xs text-muted-foreground ${isGrid ? "line-clamp-2" : "line-clamp-1"}`}>
                                {bookmark.description}
                            </p>
                        )}

                        {/* Tags & Date */}
                        <div className="flex items-center gap-2 flex-wrap pt-1 mt-auto">
                            {tagList.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="secondary"
                                    className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors"
                                    onClick={() => router.push(`/?tag=${tag.name}`)}
                                >
                                    {tag.name}
                                </Badge>
                            ))}
                            {bookmark.collections?.map((col) => (
                                <Badge
                                    key={col.id}
                                    variant="outline"
                                    className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-primary/20 transition-colors gap-1 border-primary/20"
                                    onClick={() => router.push(`/?collection=${col.id}`)}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                                    {col.name}
                                </Badge>
                            ))}
                            {bookmark.isReadLater && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-amber-500/30 text-amber-500">
                                    <Clock className="h-2.5 w-2.5 mr-0.5" />
                                    read later
                                </Badge>
                            )}
                            <span
                                className="text-[10px] text-muted-foreground/50 ml-auto whitespace-nowrap"
                                suppressHydrationWarning
                            >
                                {new Date(bookmark.createdAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                })}
                            </span>
                        </div>
                    </div>

                    {/* Thumbnail (List View Only) */}
                    {!isGrid && bookmark.thumbnail && (
                        <div className="hidden sm:block shrink-0 ml-2 w-36 h-20 rounded-lg border border-border/30 bg-muted/50 overflow-hidden relative self-center">
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
