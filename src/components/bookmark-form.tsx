"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus } from "lucide-react";
import { BookmarkWithTags } from "@/types";
import { toast } from "sonner";

interface BookmarkFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookmark?: BookmarkWithTags | null;
    onSuccess: () => void;
}

export function BookmarkForm({ open, onOpenChange, bookmark, onSuccess }: BookmarkFormProps) {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [isReadLater, setIsReadLater] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const isEditing = !!bookmark;

    useEffect(() => {
        if (bookmark) {
            setUrl(bookmark.url);
            setTitle(bookmark.title || "");
            setDescription(bookmark.description || "");
            setNotes(bookmark.notes || "");
            setTags(bookmark.tags.map((t) => t.name));
            setIsReadLater(bookmark.isReadLater);
        } else {
            resetForm();
        }
    }, [bookmark, open]);

    const resetForm = () => {
        setUrl("");
        setTitle("");
        setDescription("");
        setNotes("");
        setTagInput("");
        setTags([]);
        setIsReadLater(false);
    };

    const fetchMetadata = async () => {
        if (!url) return;
        setFetching(true);
        try {
            const res = await fetch("/api/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.title && !title) setTitle(data.title);
                if (data.description && !description) setDescription(data.description);
            }
        } catch {
            // Silently fail metadata fetch
        }
        setFetching(false);
    };

    const handleUrlBlur = () => {
        if (url && !isEditing && !title && !description) {
            fetchMetadata();
        }
    };

    const addTag = () => {
        const normalized = tagInput.toLowerCase().trim().replace(/\s+/g, "-");
        if (normalized && !tags.includes(normalized)) {
            setTags([...tags, normalized]);
        }
        setTagInput("");
    };

    const removeTag = (tag: string) => {
        setTags(tags.filter((t) => t !== tag));
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            addTag();
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!url) return;

        setLoading(true);

        try {
            const endpoint = isEditing
                ? `/api/bookmarks/${bookmark.id}`
                : "/api/bookmarks";

            const res = await fetch(endpoint, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    url,
                    title: title || undefined,
                    description: description || undefined,
                    notes: notes || undefined,
                    tags,
                    isReadLater,
                }),
            });

            if (res.ok) {
                toast.success(isEditing ? "Bookmark updated" : "Bookmark saved");
                onOpenChange(false);
                resetForm();
                onSuccess();
            } else {
                toast.error("Failed to save bookmark");
            }
        } catch {
            toast.error("Something went wrong");
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg bg-card border-border/50">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Bookmark" : "Add Bookmark"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="bookmark-url">URL</Label>
                        <div className="relative">
                            <Input
                                id="bookmark-url"
                                type="url"
                                placeholder="https://example.com"
                                value={url}
                                onChange={(e) => setUrl(e.target.value)}
                                onBlur={handleUrlBlur}
                                required
                                className="bg-background/50"
                            />
                            {fetching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bookmark-title">Title</Label>
                        <Input
                            id="bookmark-title"
                            placeholder="Page title (auto-fetched)"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="bg-background/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bookmark-description">Description</Label>
                        <Input
                            id="bookmark-description"
                            placeholder="Brief description"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="bg-background/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bookmark-tags">Tags</Label>
                        <div className="flex gap-2">
                            <Input
                                id="bookmark-tags"
                                placeholder="Add tag and press Enter"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                className="bg-background/50"
                            />
                            <Button type="button" variant="outline" size="icon" onClick={addTag} className="shrink-0 cursor-pointer">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="gap-1 cursor-pointer hover:bg-destructive/20"
                                        onClick={() => removeTag(tag)}
                                    >
                                        {tag}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bookmark-notes">Notes (Markdown)</Label>
                        <Textarea
                            id="bookmark-notes"
                            placeholder="Add notes..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            className="bg-background/50 resize-none"
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            id="bookmark-readlater"
                            checked={isReadLater}
                            onChange={(e) => setIsReadLater(e.target.checked)}
                            className="rounded border-border accent-primary"
                        />
                        <Label htmlFor="bookmark-readlater" className="text-sm text-muted-foreground cursor-pointer">
                            Mark as Read Later
                        </Label>
                    </div>

                    <div className="flex gap-2 justify-end pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            className="cursor-pointer"
                        >
                            Cancel
                        </Button>
                        <Button type="submit" disabled={loading || !url} className="cursor-pointer">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </span>
                            ) : isEditing ? (
                                "Update"
                            ) : (
                                "Save Bookmark"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
