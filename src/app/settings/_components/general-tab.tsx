"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Monitor, Moon, Sun, EyeOff, CheckCircle2, MousePointerClick, ExternalLink, Link } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface GeneralTabProps {
    nsfwDisplay: "blur" | "hide" | "show";
    setNsfwDisplay: React.Dispatch<React.SetStateAction<"blur" | "hide" | "show">>;
    bookmarkClickAction: "current" | "new";
    setBookmarkClickAction: React.Dispatch<React.SetStateAction<"current" | "new">>;
}

export function GeneralTab({ nsfwDisplay, setNsfwDisplay, bookmarkClickAction, setBookmarkClickAction }: GeneralTabProps) {
    const [savingNsfw, setSavingNsfw] = useState(false);
    const [savingClickAction, setSavingClickAction] = useState(false);
    const { theme, setTheme } = useTheme();

    const handleSaveNsfwDisplay = (value: string) => {
        setNsfwDisplay(value as any);
        setSavingNsfw(true);
        try {
            localStorage.setItem("nsfw-display-mode", value);
            toast.success("NSFW setting updated");
        } catch {
            toast.error("Failed to update NSFW setting");
        }
        setSavingNsfw(false);
    };

    const handleSaveClickAction = (value: "current" | "new") => {
        setBookmarkClickAction(value);
        setSavingClickAction(true);
        try {
            localStorage.setItem("bookmark-click-action", value);
            window.dispatchEvent(new Event("bookmark-click-action-changed"));
            toast.success("Click behavior updated");
        } catch {
            toast.error("Failed to update behavior");
        }
        setSavingClickAction(false);
    };

    return (
        <div className="space-y-6">
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold tracking-tight">
                        <Monitor className="h-5 w-5 text-primary" />
                        Appearance & Display
                    </CardTitle>
                    <CardDescription>Customize how PathFind looks and behaves for you.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/10">
                        {/* Left Side: Theme Setting */}
                        <div className="flex-1 p-6 space-y-6">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Theme Preference</Label>
                                <p className="text-sm text-muted-foreground">Select or customize your UI theme.</p>
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    { value: 'light', label: 'Light', icon: Sun },
                                    { value: 'dark', label: 'Dark', icon: Moon },
                                    { value: 'system', label: 'System', icon: Monitor },
                                ].map((t) => (
                                    <button
                                        key={t.value}
                                        onClick={() => setTheme(t.value)}
                                        className={cn(
                                            "flex flex-col items-center justify-center gap-3 p-4 rounded-xl border-2 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            theme === t.value
                                                ? "border-primary bg-primary/5 shadow-sm scale-[1.02]"
                                                : "border-border/40 bg-card hover:bg-muted/40 hover:border-border/80"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-3 rounded-full transition-colors",
                                            theme === t.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            <t.icon className="h-5 w-5" />
                                        </div>
                                        <span className={cn("text-xs font-semibold uppercase tracking-wider", theme === t.value ? "text-primary" : "text-muted-foreground")}>
                                            {t.label}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Right Side: NSFW Setting */}
                        <div className="flex-1 p-6 space-y-6 bg-muted/5">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold flex items-center gap-2">
                                    <EyeOff className="h-4 w-4 text-destructive" />
                                    Sensitive Content (NSFW)
                                </Label>
                                <p className="text-sm text-muted-foreground">Control visibility of potentially unsafe content.</p>
                            </div>

                            <div className="space-y-3">
                                {[
                                    { value: 'blur', title: 'Blur Thumbnails', desc: 'Click to reveal (Default)' },
                                    { value: 'hide', title: 'Hide Completely', desc: 'Do not show in any view' },
                                    { value: 'show', title: 'Show Normally', desc: 'No special treatment' },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleSaveNsfwDisplay(option.value)}
                                        className={cn(
                                            "w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            nsfwDisplay === option.value
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border/40 bg-card hover:bg-muted/40 hover:border-border/80"
                                        )}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className={cn("text-sm font-semibold", nsfwDisplay === option.value ? "text-foreground" : "text-muted-foreground")}>
                                                {option.title}
                                            </span>
                                            <span className="text-xs text-muted-foreground">{option.desc}</span>
                                        </div>
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                            nsfwDisplay === option.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                                        )}>
                                            {nsfwDisplay === option.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                                        </div>
                                    </button>
                                ))}
                                {savingNsfw && (
                                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground animate-pulse mt-4">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Saving preference...
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                <CardHeader className="pb-4 border-b border-border/10 bg-muted/5">
                    <CardTitle className="text-lg flex items-center gap-2 font-bold tracking-tight">
                        <MousePointerClick className="h-5 w-5 text-primary" />
                        Behavior
                    </CardTitle>
                    <CardDescription>Customize how you interact with PathFind.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/10">
                        {/* Bookmark Click Action Setting */}
                        <div className="flex-1 p-6 space-y-6">
                            <div className="space-y-1">
                                <Label className="text-base font-semibold">Bookmark Click Action</Label>
                                <p className="text-sm text-muted-foreground">Choose where to open bookmarks when you click them.</p>
                            </div>

                            <div className="space-y-3 max-w-sm">
                                {[
                                    { value: 'new' as const, title: 'Open in New Tab', desc: 'Opens the link in a separate tab (Default)', icon: ExternalLink },
                                    { value: 'current' as const, title: 'Open in Current Tab', desc: 'Navigates away from PathFind', icon: Link },
                                ].map((option) => (
                                    <button
                                        key={option.value}
                                        onClick={() => handleSaveClickAction(option.value)}
                                        className={cn(
                                            "w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                            bookmarkClickAction === option.value
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-border/40 bg-card hover:bg-muted/40 hover:border-border/80"
                                        )}
                                    >
                                        <div className={cn(
                                            "p-3 rounded-full transition-colors shrink-0",
                                            bookmarkClickAction === option.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                                        )}>
                                            <option.icon className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                                            <span className={cn("text-sm font-semibold", bookmarkClickAction === option.value ? "text-foreground" : "text-muted-foreground")}>
                                                {option.title}
                                            </span>
                                            <span className="text-xs text-muted-foreground truncate">{option.desc}</span>
                                        </div>
                                        <div className={cn(
                                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                            bookmarkClickAction === option.value ? "border-primary bg-primary" : "border-muted-foreground/30"
                                        )}>
                                            {bookmarkClickAction === option.value && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                                        </div>
                                    </button>
                                ))}
                                {savingClickAction && (
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse mt-4">
                                        <Loader2 className="h-3 w-3 animate-spin" /> Saving preference...
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Empty right side to keep two-column layout balanced for future settings */}
                        <div className="flex-1 p-6 space-y-6 bg-muted/5 hidden md:block">

                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
