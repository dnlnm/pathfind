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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
                });
        } else if (!isEditing) {
            setName("");
            setDescription("");
            setColor("#3b82f6");
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
