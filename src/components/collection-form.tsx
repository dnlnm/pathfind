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

    const colors = [
        "#3b82f6", // blue
        "#ef4444", // red
        "#10b981", // emerald
        "#f59e0b", // amber
        "#8b5cf6", // violet
        "#ec4899", // pink
        "#6b7280", // gray
        "#06b6d4", // cyan
    ];

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
                        <div className="flex flex-wrap gap-2 pt-1">
                            {colors.map((c) => (
                                <button
                                    key={c}
                                    type="button"
                                    className={`w-6 h-6 rounded-full border-2 transition-all ${color === c ? "border-primary scale-110" : "border-transparent"
                                        }`}
                                    style={{ backgroundColor: c }}
                                    onClick={() => setColor(c)}
                                />
                            ))}
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
