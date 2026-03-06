"use client";

import { useState, useEffect } from "react";
import { HexColorPicker } from "react-colorful";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";

interface CollectionFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    collectionId?: string | null;
    onSuccess: () => void;
}

export function CollectionForm({ open, onOpenChange, collectionId, onSuccess }: CollectionFormProps) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [color, setColor] = useState("#3b82f6");
    const [colorPickerOpen, setColorPickerOpen] = useState(false);
    const [isSmart, setIsSmart] = useState(false);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(false);

    const isEditing = !!collectionId;

    useEffect(() => {
        if (collectionId && open) {
            fetch(`/api/collections/${collectionId}`)
                .then(res => res.json())
                .then(data => {
                    setName(data.name);
                    setDescription(data.description || "");
                    setColor(data.color || "#3b82f6");
                    setIsSmart(!!data.is_smart);
                    setQuery(data.query || "");
                });
        } else if (!isEditing) {
            setName("");
            setDescription("");
            setColor("#3b82f6");
            setIsSmart(false);
            setQuery("");
        }
    }, [collectionId, open, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name) return;

        setLoading(true);

        try {
            const endpoint = isEditing
                ? `/api/collections/${collectionId}`
                : "/api/collections";

            const res = await fetch(endpoint, {
                method: isEditing ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    description: description || undefined,
                    color,
                    is_smart: isSmart,
                    query: isSmart ? query : undefined,
                }),
            });

            if (res.ok) {
                toast.success(isEditing ? "Collection updated" : "Collection created");
                onOpenChange(false);
                onSuccess();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to save collection");
            }
        } catch {
            toast.error("Something went wrong");
        }

        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md bg-card border-border/50">
                <DialogHeader>
                    <DialogTitle>{isEditing ? "Edit Collection" : "New Collection"}</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="collection-name">Name</Label>
                        <Input
                            id="collection-name"
                            placeholder="e.g. Work, Research, Inspiration"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                            className="bg-background/50"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="collection-description">Description (Optional)</Label>
                        <Textarea
                            id="collection-description"
                            placeholder="What's this collection about?"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            rows={2}
                            className="bg-background/50 resize-none"
                        />
                    </div>

                    <div className="space-y-3 p-3 rounded-lg border border-primary/10 bg-primary/5">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm font-medium flex items-center gap-2">
                                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                                    Smart Collection
                                </Label>
                                <p className="text-[11px] text-muted-foreground">
                                    Dynamic collection based on search query
                                </p>
                            </div>
                            <Switch
                                checked={isSmart}
                                onCheckedChange={setIsSmart}
                            />
                        </div>

                        {isSmart && (
                            <div className="space-y-2 pt-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                <Label htmlFor="collection-query" className="text-xs">Search Query</Label>
                                <Input
                                    id="collection-query"
                                    placeholder="e.g. has:notes is:readlater"
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    required={isSmart}
                                    className="bg-background/50 h-8 text-sm"
                                />
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label>Color</Label>
                        <Popover open={colorPickerOpen} onOpenChange={setColorPickerOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type="button"
                                    className="flex items-center gap-2.5 h-9 px-3 rounded-md border border-border/50 bg-background/50 hover:bg-background/80 hover:border-border transition-colors cursor-pointer w-full"
                                >
                                    <span
                                        className="w-4 h-4 rounded-full border border-white/10 shadow-sm shrink-0"
                                        style={{ backgroundColor: color }}
                                    />
                                    <code className="text-[11px] font-mono uppercase text-muted-foreground">{color}</code>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-3 space-y-3" align="start">
                                <HexColorPicker color={color} onChange={setColor} style={{ width: "100%" }} />
                                <Separator className="bg-border/30" />
                                <div className="flex items-center gap-2">
                                    <span
                                        className="w-7 h-7 rounded-md shrink-0 border border-white/10"
                                        style={{ backgroundColor: color }}
                                    />
                                    <Input
                                        value={color}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setColor(val.startsWith("#") ? val : `#${val}`);
                                        }}
                                        className="h-7 text-xs font-mono bg-background/50 flex-1"
                                        placeholder="#3b82f6"
                                        maxLength={7}
                                    />
                                </div>
                            </PopoverContent>
                        </Popover>
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
                        <Button type="submit" disabled={loading || !name} className="cursor-pointer">
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Saving…
                                </span>
                            ) : isEditing ? (
                                "Update"
                            ) : (
                                "Create Collection"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
