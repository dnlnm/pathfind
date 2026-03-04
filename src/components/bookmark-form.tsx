"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, X, Plus, RefreshCw, Sparkles, Globe, Upload, Tag, FolderOpen, Check, ChevronDown, EyeOff, AlertCircle, PencilLine } from "lucide-react";
import { BookmarkWithTags } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BookmarkFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    bookmark?: BookmarkWithTags | null;
    onSuccess: () => void;
    initialValues?: {
        url?: string;
        title?: string;
        description?: string;
    } | null;
}

export function BookmarkForm({ open, onOpenChange, bookmark, onSuccess, initialValues }: BookmarkFormProps) {
    const [url, setUrl] = useState("");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [notes, setNotes] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [isReadLater, setIsReadLater] = useState(false);
    const [isNsfw, setIsNsfw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [thumbnail, setThumbnail] = useState("");
    const [generating, setGenerating] = useState(false);
    const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
    const [availableCollections, setAvailableCollections] = useState<{ id: string; name: string; color?: string | null }[]>([]);
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [existingTitle, setExistingTitle] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Tag autocomplete state
    const [existingTags, setExistingTags] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const tagInputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Collection autocomplete state
    const [collectionInput, setCollectionInput] = useState("");
    const [showCollectionSuggestions, setShowCollectionSuggestions] = useState(false);
    const [highlightedCollectionIndex, setHighlightedCollectionIndex] = useState(-1);
    const collectionInputRef = useRef<HTMLInputElement>(null);
    const collectionSuggestionsRef = useRef<HTMLDivElement>(null);

    // Notes collapsible state
    const [notesOpen, setNotesOpen] = useState(false);

    const resetForm = () => {
        setUrl("");
        setTitle("");
        setDescription("");
        setNotes("");
        setTagInput("");
        setTags([]);
        setIsReadLater(false);
        setIsNsfw(false);
        setThumbnail("");
        setSelectedCollections([]);
        setCollectionInput("");
        setIsDuplicate(false);
        setExistingTitle(null);
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

    const isEditing = !!bookmark;

    useEffect(() => {
        if (open) {
            fetch("/api/collections")
                .then(res => res.json())
                .then(data => setAvailableCollections(data))
                .catch(() => { });

            fetch("/api/tags")
                .then(res => res.json())
                .then(data => setExistingTags(data.map((t: { name: string }) => t.name)))
                .catch(() => { });
        } else {
            setShowSuggestions(false);
            setHighlightedIndex(-1);
            setShowCollectionSuggestions(false);
            setHighlightedCollectionIndex(-1);
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
            setIsNsfw(bookmark.isNsfw);
            setThumbnail(bookmark.thumbnail || "");
            setSelectedCollections(bookmark.collections?.map(c => c.id) || []);
            // Auto-expand notes if there's existing content
            setNotesOpen(!!(bookmark.notes && bookmark.notes.trim()));
        } else {
            resetForm();
            if (open && initialValues) {
                if (initialValues.url) setUrl(initialValues.url);
                if (initialValues.title) setTitle(initialValues.title);
                if (initialValues.description) setDescription(initialValues.description);

                // If we got a URL but no title/desc, fetch them automatically
                if (initialValues.url && !initialValues.title) {
                    fetchMetadata(initialValues.url);
                }
            }
        }
    }, [bookmark, open, initialValues]);

    useEffect(() => {
        if (isEditing || !url || !open) {
            setIsDuplicate(false);
            setExistingTitle(null);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/bookmarks/check?url=${encodeURIComponent(url.trim())}`);
                if (res.ok) {
                    const data = await res.json();
                    setIsDuplicate(data.bookmarked);
                    setExistingTitle(data.existingTitle ?? null);
                }
            } catch {
                // Silently fail
            }
        }, 500);

        return () => clearTimeout(timer);
    }, [url, isEditing, open]);


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

    const addTag = useCallback((value?: string) => {
        const raw = (value ?? tagInput).toLowerCase().trim().replace(/\s+/g, "-");
        if (raw && !tags.includes(raw)) {
            setTags(prev => [...prev, raw]);
        }
        setTagInput("");
        setShowSuggestions(false);
        setHighlightedIndex(-1);
        tagInputRef.current?.focus();
    }, [tagInput, tags]);

    const removeTag = (tag: string) => {
        setTags(tags.filter((t) => t !== tag));
    };

    // Filtered suggestions: match input, exclude already-added tags
    const suggestions = tagInput.trim()
        ? existingTags.filter(
            t => t.includes(tagInput.toLowerCase().trim()) && !tags.includes(t)
        )
        : [];

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!showSuggestions && suggestions.length > 0) setShowSuggestions(true);
            setHighlightedIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
            setHighlightedIndex(-1);
        } else if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            if (showSuggestions && highlightedIndex >= 0 && suggestions[highlightedIndex]) {
                addTag(suggestions[highlightedIndex]);
            } else {
                addTag();
            }
        }
    };

    // Collection combobox helpers
    const collectionSuggestions = availableCollections.filter(
        c => c.name.toLowerCase().includes(collectionInput.toLowerCase().trim())
    );

    const toggleCollection = (id: string) => {
        setSelectedCollections(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleCollectionKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!showCollectionSuggestions) setShowCollectionSuggestions(true);
            setHighlightedCollectionIndex(prev => Math.min(prev + 1, collectionSuggestions.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedCollectionIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === "Escape") {
            setShowCollectionSuggestions(false);
            setHighlightedCollectionIndex(-1);
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (showCollectionSuggestions && highlightedCollectionIndex >= 0 && collectionSuggestions[highlightedCollectionIndex]) {
                toggleCollection(collectionSuggestions[highlightedCollectionIndex].id);
                setCollectionInput("");
                setShowCollectionSuggestions(false);
                setHighlightedCollectionIndex(-1);
            }
        }
    };

    const selectedCollectionObjects = availableCollections.filter(c => selectedCollections.includes(c.id));

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
                    isNsfw,
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
                            <div className="flex items-start gap-2 mt-1.5 rounded-lg border border-amber-500/25 bg-amber-500/8 px-3 py-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 leading-snug">
                                        Already in your library
                                    </p>
                                    {existingTitle && (
                                        <p className="text-[11px] text-amber-600/70 dark:text-amber-400/70 truncate mt-0.5">
                                            &ldquo;{existingTitle}&rdquo;
                                        </p>
                                    )}
                                    <p className="text-[11px] text-amber-600/60 dark:text-amber-400/60 mt-0.5">
                                        Saving will update the existing bookmark.
                                    </p>
                                </div>
                                <PencilLine className="h-3.5 w-3.5 text-amber-500/50 mt-0.5 shrink-0" />
                            </div>
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
                        <div className="relative">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                    <Input
                                        id="bookmark-tags"
                                        ref={tagInputRef}
                                        placeholder="Type to search or create a tag…"
                                        value={tagInput}
                                        autoComplete="off"
                                        onChange={(e) => {
                                            setTagInput(e.target.value);
                                            setShowSuggestions(true);
                                            setHighlightedIndex(-1);
                                        }}
                                        onKeyDown={handleTagKeyDown}
                                        onFocus={() => { if (tagInput.trim()) setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                                        className="bg-background/50 pl-9"
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={() => addTag()}
                                    className="shrink-0 cursor-pointer"
                                    disabled={!tagInput.trim()}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Autocomplete dropdown */}
                            {showSuggestions && suggestions.length > 0 && (
                                <div
                                    ref={suggestionsRef}
                                    className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/50 bg-popover shadow-xl overflow-hidden"
                                >
                                    <div className="px-2 py-1 border-b border-border/30">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Existing tags</p>
                                    </div>
                                    <div className="max-h-44 overflow-y-auto">
                                        {suggestions.map((suggestion, idx) => (
                                            <button
                                                key={suggestion}
                                                type="button"
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors cursor-pointer",
                                                    idx === highlightedIndex
                                                        ? "bg-primary text-primary-foreground"
                                                        : "hover:bg-muted/60 text-foreground"
                                                )}
                                                onMouseDown={(e) => {
                                                    e.preventDefault(); // prevent blur from closing before click fires
                                                    addTag(suggestion);
                                                }}
                                                onMouseEnter={() => setHighlightedIndex(idx)}
                                            >
                                                <Tag className="h-3 w-3 shrink-0 opacity-50" />
                                                <span className="truncate">#{suggestion}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                                        onClick={() => removeTag(tag)}
                                    >
                                        #{tag}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bookmark-collections">Collections</Label>
                        <div className="relative">
                            <div className="relative">
                                <FolderOpen className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                                <Input
                                    id="bookmark-collections"
                                    ref={collectionInputRef}
                                    placeholder={availableCollections.length === 0 ? "No collections yet" : "Search collections…"}
                                    disabled={availableCollections.length === 0}
                                    value={collectionInput}
                                    autoComplete="off"
                                    onChange={(e) => {
                                        setCollectionInput(e.target.value);
                                        setShowCollectionSuggestions(true);
                                        setHighlightedCollectionIndex(-1);
                                    }}
                                    onFocus={() => setShowCollectionSuggestions(true)}
                                    onBlur={() => setTimeout(() => setShowCollectionSuggestions(false), 150)}
                                    onKeyDown={handleCollectionKeyDown}
                                    className="bg-background/50 pl-9"
                                />
                            </div>

                            {/* Collection dropdown */}
                            {showCollectionSuggestions && collectionSuggestions.length > 0 && (
                                <div
                                    ref={collectionSuggestionsRef}
                                    className="absolute z-50 top-full mt-1 w-full rounded-lg border border-border/50 bg-popover shadow-xl overflow-hidden"
                                >
                                    <div className="px-2 py-1 border-b border-border/30">
                                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Collections</p>
                                    </div>
                                    <div className="max-h-44 overflow-y-auto">
                                        {collectionSuggestions.map((col, idx) => {
                                            const isSelected = selectedCollections.includes(col.id);
                                            return (
                                                <button
                                                    key={col.id}
                                                    type="button"
                                                    className={cn(
                                                        "w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors cursor-pointer",
                                                        idx === highlightedCollectionIndex
                                                            ? "bg-primary text-primary-foreground"
                                                            : "hover:bg-muted/60 text-foreground"
                                                    )}
                                                    onMouseDown={(e) => {
                                                        e.preventDefault();
                                                        toggleCollection(col.id);
                                                        setCollectionInput("");
                                                        setShowCollectionSuggestions(false);
                                                        setHighlightedCollectionIndex(-1);
                                                        collectionInputRef.current?.focus();
                                                    }}
                                                    onMouseEnter={() => setHighlightedCollectionIndex(idx)}
                                                >
                                                    <div
                                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: col.color || "var(--primary)" }}
                                                    />
                                                    <span className="truncate flex-1">{col.name}</span>
                                                    {isSelected && (
                                                        <Check className={cn(
                                                            "h-3.5 w-3.5 shrink-0",
                                                            idx === highlightedCollectionIndex ? "text-primary-foreground" : "text-primary"
                                                        )} />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Selected collection badges */}
                        {selectedCollectionObjects.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                                {selectedCollectionObjects.map((col) => (
                                    <Badge
                                        key={col.id}
                                        variant="outline"
                                        className="gap-1 cursor-pointer hover:bg-destructive/20 transition-colors"
                                        style={col.color ? {
                                            borderColor: `color-mix(in srgb, ${col.color} 40%, transparent)`,
                                            backgroundColor: `color-mix(in srgb, ${col.color} 12%, transparent)`,
                                            color: col.color,
                                        } : undefined}
                                        onClick={() => toggleCollection(col.id)}
                                    >
                                        <div
                                            className="w-1.5 h-1.5 rounded-full"
                                            style={{ backgroundColor: col.color || "var(--primary)" }}
                                        />
                                        {col.name}
                                        <X className="h-3 w-3" />
                                    </Badge>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Notes — collapsible */}
                    <div className="space-y-1">
                        <button
                            type="button"
                            className="flex items-center gap-1.5 w-full group cursor-pointer"
                            onClick={() => setNotesOpen(o => !o)}
                        >
                            <span className="text-sm font-medium leading-none">
                                Notes
                                {notes.trim() && !notesOpen && (
                                    <span className="ml-1.5 text-[10px] font-normal text-muted-foreground align-middle">(has content)</span>
                                )}
                            </span>
                            <ChevronDown
                                className={cn(
                                    "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ml-auto",
                                    notesOpen && "rotate-180"
                                )}
                            />
                        </button>
                        <div
                            className={cn(
                                "grid transition-all duration-200",
                                notesOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                            )}
                        >
                            <div className="overflow-hidden">
                                <Textarea
                                    id="bookmark-notes"
                                    placeholder="Add notes… (Markdown supported)"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    className="bg-background/50 resize-none mt-2"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Thumbnail (Optional)</Label>
                        <div className="flex items-center gap-4">
                            {/* Thumbnail Preview - 16:9 Aspect Ratio */}
                            <div className="relative w-1/2 shrink-0 aspect-video rounded-lg border border-border/40 bg-muted/20 overflow-hidden flex items-center justify-center">
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
                            <div className="flex flex-col gap-2 flex-1">
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

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="bookmark-readlater"
                                checked={isReadLater}
                                onCheckedChange={(checked) => setIsReadLater(checked === true)}
                            />
                            <Label htmlFor="bookmark-readlater" className="text-sm text-muted-foreground cursor-pointer">
                                Mark as Read Later
                            </Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="bookmark-nsfw"
                                checked={isNsfw}
                                onCheckedChange={(checked) => setIsNsfw(checked === true)}
                            />
                            <Label htmlFor="bookmark-nsfw" className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1">
                                <EyeOff className="h-3 w-3" />
                                Mark as Sensitive
                            </Label>
                        </div>
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
