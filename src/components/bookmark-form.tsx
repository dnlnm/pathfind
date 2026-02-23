"use client";

import { useState, useEffect, useRef } from "react";
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
import { Loader2, X, Plus, RefreshCw, Sparkles, Globe, Upload } from "lucide-react";
import { BookmarkWithTags } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    const [thumbnail, setThumbnail] = useState("");
    const [generating, setGenerating] = useState(false);
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [availableCollections, setAvailableCollections] = useState<{ id: string; name: string }[]>([]);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isEditing = !!bookmark;

    useEffect(() => {
        if (open) {
            fetch("/api/collections")
                .then(res => res.json())
                .then(data => setAvailableCollections(data))
                .catch(() => { });
        }
    }, [open]);

    useEffect(() => {
        if (bookmark) {
            setUrl(bookmark.url);
            setTitle(bookmark.title || "");
            setDescription(bookmark.description || "");
            setNotes(bookmark.notes || "");
            setTags(bookmark.tags.map((t) => t.name));
            setIsReadLater(bookmark.isReadLater);
            setThumbnail(bookmark.thumbnail || "");
            setSelectedCollections(bookmark.collections?.map(c => c.id) || []);
        } else {
            resetForm();
        }
    }, [bookmark, open]);

    useEffect(() => {
        if (isEditing || !url || !open) {
            setIsDuplicate(false);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/bookmarks/check?url=${encodeURIComponent(url.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    setIsDuplicate(data.bookmarked);
                }
            } catch {
                // Silently fail
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [url, isEditing, open]);

    const resetForm = () => {
        setUrl("");
        setTitle("");
        setDescription("");
        setNotes("");
        setTagInput("");
        setTags([]);
        setIsReadLater(false);
        setThumbnail("");
        setSelectedCollections([]);
        setIsDuplicate(false);
    };

    const fetchMetadata = async (targetUrl: string = url) => {
        if (!targetUrl) return;
        setFetching(true);
        try {
            const res = await fetch("/api/metadata", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: targetUrl }),
            });
            if (res.ok) {
                const data = await res.json();
                if (data.title && !title) setTitle(data.title);
                if (data.description && !description) setDescription(data.description);
                if (data.thumbnail) setThumbnail(data.thumbnail);
            }
        } catch {
            // Silently fail metadata fetch
        }
        setFetching(false);
    };

    const generateDynamicThumbnail = async () => {
        if (!title && !url) {
            toast.error("Please enter a title or URL first");
            return;
        }
        setGenerating(true);
        try {
            const domain = url ? new URL(url).hostname.replace("www.", "") : "";
            const dynamicUrl = `/api/thumbnail?title=${encodeURIComponent(title || "Bookmark")}&domain=${encodeURIComponent(domain)}`;
            setThumbnail(dynamicUrl);
            toast.success("Dynamic thumbnail generated");
        } catch {
            toast.error("Failed to generate thumbnail");
        }
        setGenerating(false);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please upload an image file");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error("File size should be less than 2MB");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const result = event.target?.result as string;
            setThumbnail(result);
            toast.success("Image uploaded successfully");
        };
        reader.readAsDataURL(file);
    };

    const handleUrlBlur = () => {
        if (url && !isEditing && !title && !description) {
            fetchMetadata(url);
        }
    };

    const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        const pastedText = e.clipboardData.getData("text");
        if (pastedText && (pastedText.startsWith("http://") || pastedText.startsWith("https://"))) {
            if (!isEditing && !title && !description) {
                fetchMetadata(pastedText);
            }
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
                    thumbnail: thumbnail || null,
                    collections: selectedCollections,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.isUpdate && !isEditing) {
                    toast.success("Existing bookmark updated successfully");
                } else {
                    toast.success(isEditing ? "Bookmark updated" : "Bookmark saved");
                }
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
            <DialogContent className="sm:max-w-lg bg-card border-border/50 max-h-[90vh] overflow-y-auto">
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
                                onPaste={handleUrlPaste}
                                required
                                className="bg-background/50"
                            />
                            {fetching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                        </div>
                        {isDuplicate && !isEditing && (
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-500 mt-1.5 flex items-center">
                                This link is already saved. Submitting will update your existing bookmark.
                            </p>
                        )}
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

                    <div className="space-y-2">
                        <Label>Collections</Label>
                        <div className="flex flex-wrap gap-2 pt-1">
                            {availableCollections.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">No collections created yet.</p>
                            ) : (
                                availableCollections.map((collection) => (
                                    <Badge
                                        key={collection.id}
                                        variant={selectedCollections.includes(collection.id) ? "default" : "outline"}
                                        className="cursor-pointer"
                                        onClick={() => {
                                            setSelectedCollections(prev =>
                                                prev.includes(collection.id)
                                                    ? prev.filter(id => id !== collection.id)
                                                    : [...prev, collection.id]
                                            );
                                        }}
                                    >
                                        {collection.name}
                                    </Badge>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Thumbnail (Optional)</Label>
                        <div className="space-y-3">
                            {/* Thumbnail Preview - 16:9 Aspect Ratio */}
                            <div className="relative w-full aspect-video rounded-lg border border-border/40 bg-muted/20 overflow-hidden flex items-center justify-center">
                                {thumbnail ? (
                                    <>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                            src={thumbnail}
                                            alt="Thumbnail preview"
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLImageElement).src = "";
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            size="icon"
                                            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur shadow-sm cursor-pointer"
                                            onClick={() => setThumbnail("")}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground opacity-30">
                                        <Globe className="h-10 w-10" />
                                        <span className="text-xs font-medium">16:9 Preview</span>
                                    </div>
                                )}
                            </div>

                            {/* Options - Just the 3 buttons */}
                            <div className="grid grid-cols-3 gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleFileUpload}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px] gap-1.5 cursor-pointer"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                    Upload
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px] gap-1.5 cursor-pointer"
                                    onClick={() => fetchMetadata()}
                                    disabled={fetching || !url}
                                >
                                    <RefreshCw className={cn("h-3.5 w-3.5", fetching && "animate-spin")} />
                                    Fetch
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8 text-[11px] gap-1.5 cursor-pointer"
                                    onClick={generateDynamicThumbnail}
                                    disabled={generating || (!title && !url)}
                                >
                                    <Sparkles className={cn("h-3.5 w-3.5", generating && "animate-spin")} />
                                    Dynamic
                                </Button>
                            </div>
                        </div>
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
                            ) : isDuplicate ? (
                                "Update Bookmark"
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
