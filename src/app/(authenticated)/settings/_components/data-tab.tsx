"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Upload, Download } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

export function DataTab() {
    const router = useRouter();
    const [importing, setImporting] = useState(false);
    const [includeThumbnails, setIncludeThumbnails] = useState(false);

    const handleExport = async (format: "html" | "json" = "html") => {
        try {
            const urlParams = new URLSearchParams({ format });
            if (format === "json" && includeThumbnails) {
                urlParams.append("includeThumbnails", "true");
            }
            const res = await fetch(`/api/import-export?${urlParams.toString()}`);
            if (res.ok) {
                const blob = await res.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `pathfind-bookmarks-${new Date().toISOString().split("T")[0]}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                toast.success(`Bookmarks exported as ${format.toUpperCase()}`);
            }
        } catch {
            toast.error("Export failed");
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setImporting(true);
        try {
            const text = await file.text();
            const isJson = file.name.endsWith(".json");
            const payload = isJson ? { json: text } : { html: text };

            const res = await fetch("/api/import-export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                const data = await res.json();
                toast.success(`Imported ${data.count} bookmarks`);
                router.refresh();
            } else {
                toast.error("Import failed");
            }
        } catch {
            toast.error("Import failed");
        }
        setImporting(false);
        e.target.value = "";
    };

    return (
        <div className="space-y-6">
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Portability</CardTitle>
                    <CardDescription>Move your data in and out of PathFind using standard formats.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-3 p-4 rounded-2xl border border-border/30 bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Upload className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm">Import</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Upload a Netscape HTML or Pathfind JSON backup file.</p>
                            <div className="relative">
                                <input type="file" accept=".html,.htm,.json" onChange={handleImport} className="absolute inset-0 opacity-0 cursor-pointer" id="import-file" />
                                <Button variant="outline" asChild className="w-full gap-2 cursor-pointer bg-background/50">
                                    <label htmlFor="import-file">
                                        {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                        Choose File
                                    </label>
                                </Button>
                            </div>
                        </div>
                        <div className="space-y-3 p-4 rounded-2xl border border-border/30 bg-muted/30">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                                    <Download className="h-4 w-4" />
                                </div>
                                <span className="font-semibold text-sm">Export</span>
                            </div>
                            <p className="text-xs text-muted-foreground">Download all your PathFind bookmarks as HTML or a full JSON backup.</p>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => handleExport("html")} className="flex-1 gap-2 cursor-pointer bg-background/50">
                                    <Download className="h-4 w-4" />
                                    HTML
                                </Button>
                                <Button variant="outline" onClick={() => handleExport("json")} className="flex-1 gap-2 cursor-pointer bg-background/50">
                                    <Download className="h-4 w-4" />
                                    JSON
                                </Button>
                            </div>
                            <div className="flex items-center space-x-2 pt-1 border-t border-border/10">
                                <Checkbox
                                    id="includeThumbnails"
                                    checked={includeThumbnails}
                                    onCheckedChange={(checked) => setIncludeThumbnails(checked === true)}
                                />
                                <Label htmlFor="includeThumbnails" className="text-[10px] leading-tight text-muted-foreground font-normal cursor-pointer">
                                    Include full thumbnail images (makes file larger)
                                </Label>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
