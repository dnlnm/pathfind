"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Youtube, RefreshCw, Check, AlertCircle, PlayCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";

interface YoutubePlaylist {
    id: string;
    title: string;
    thumbnail?: string;
    itemCount: number;
    isSelected: boolean;
}

export function YoutubeTab() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [saving, setSaving] = useState(false);
    
    // Config state
    const [isConnected, setIsConnected] = useState(false);
    const [syncEnabled, setSyncEnabled] = useState(false);
    const [lastSync, setLastSync] = useState<string | null>(null);
    const [playlists, setPlaylists] = useState<YoutubePlaylist[]>([]);
    
    const fetchStatus = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/settings/youtube");
            if (res.ok) {
                const data = await res.json();
                setIsConnected(data.isConnected);
                setSyncEnabled(data.syncEnabled);
                setLastSync(data.lastSync);
                
                if (data.isConnected) {
                    const plRes = await fetch("/api/youtube/playlists");
                    if (plRes.ok) {
                        setPlaylists(await plRes.json());
                    }
                }
            }
        } catch (e) {
            console.error("Failed to fetch YouTube status", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatus();
        
        // Handle query params from callback
        if (searchParams.get("youtube_connected") === "true") {
            toast.success("YouTube account connected!");
            router.replace("/settings?tab=youtube");
        }
        if (searchParams.get("error")) {
            toast.error(`YouTube connection failed: ${searchParams.get("error")}`);
            router.replace("/settings?tab=youtube");
        }
    }, [fetchStatus, searchParams, router]);

    const handleConnect = () => {
        window.location.href = "/api/youtube/auth";
    };

    const handleDisconnect = async () => {
        if (!confirm("Are you sure you want to disconnect your YouTube account?")) return;
        try {
            const res = await fetch("/api/youtube/disconnect", { method: "POST" });
            if (res.ok) {
                setIsConnected(false);
                setPlaylists([]);
                toast.success("YouTube account disconnected");
            }
        } catch (e) {
            toast.error("Failed to disconnect");
        }
    };

    const handleTogglePlaylist = (id: string) => {
        setPlaylists(prev => prev.map(p => 
            p.id === id ? { ...p, isSelected: !p.isSelected } : p
        ));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const selectedIds = playlists.filter(p => p.isSelected).map(p => p.id);
            const res = await fetch("/api/youtube/playlists/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ playlistIds: selectedIds, syncEnabled })
            });
            if (res.ok) {
                toast.success("Settings saved");
            } else {
                toast.error("Failed to save settings");
            }
        } catch (e) {
            toast.error("An error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    const handleSyncNow = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/api/youtube/sync", { method: "POST" });
            const data = await res.json();
            if (res.ok) {
                toast.success("Sync job started in background");
            } else {
                toast.error(data.error || "Sync failed");
            }
        } catch (e) {
            toast.error("Sync failed");
        } finally {
            setSyncing(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {!isConnected ? (
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                        <div className="w-12 h-12 rounded-2xl bg-[#FF0000] flex items-center justify-center shadow-lg">
                            <Youtube className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <CardTitle>YouTube Integration</CardTitle>
                            <CardDescription>Sync your playlists and videos to Pathfind.</CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground italic">
                            Connect your YouTube account to automatically index your playlists. 
                            Supports private, unlisted, and public playlists.
                        </p>
                        <Button onClick={handleConnect} className="w-full gap-2 bg-[#FF0000] hover:bg-[#CC0000] text-white transition-all font-medium h-12 shadow-sm hover:shadow-md">
                            <ExternalLink className="h-4 w-4" />
                            Connect YouTube Account
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <Card className="border-border/40 bg-card/40 backdrop-blur-sm overflow-hidden">
                        <div className="absolute top-0 right-0 p-4">
                            <div className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider", syncEnabled ? "bg-red-500/10 text-red-500" : "bg-muted text-muted-foreground")}>
                                {syncEnabled ? "Active" : "Paused"}
                            </div>
                        </div>
                        <CardHeader className="flex flex-row items-center gap-4 space-y-0">
                            <div className="w-12 h-12 rounded-2xl bg-[#FF0000] flex items-center justify-center shadow-lg">
                                <Youtube className="h-6 w-6 text-white" />
                            </div>
                            <div>
                                <CardTitle>YouTube Connected</CardTitle>
                                <CardDescription>Connected to your Google Account.</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between py-2 border-b border-border/40">
                                <div className="space-y-0.5">
                                    <Label className="text-sm font-semibold">Background Sync</Label>
                                    <p className="text-[11px] text-muted-foreground">Automatically sync playlists every 6 hours</p>
                                </div>
                                <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-sm font-semibold flex items-center gap-2">
                                    Your Playlists 
                                    <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                        {playlists.length} found
                                    </span>
                                </Label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {playlists.map((playlist) => (
                                        <div 
                                            key={playlist.id}
                                            onClick={() => handleTogglePlaylist(playlist.id)}
                                            className={cn(
                                                "group flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer relative",
                                                playlist.isSelected 
                                                    ? "bg-primary/5 border-primary/40 shadow-sm" 
                                                    : "bg-muted/30 border-border/30 hover:bg-muted/50"
                                            )}
                                        >
                                            <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 shadow-sm border border-border/20">
                                                {playlist.thumbnail ? (
                                                    <img src={playlist.thumbnail} alt="" className="w-full h-full object-cover grayscale-[0.3] group-hover:grayscale-0 transition-all" />
                                                ) : (
                                                    <PlayCircle className="w-full h-full p-3 text-muted-foreground" />
                                                )}
                                                {playlist.isSelected && (
                                                    <div className="absolute inset-0 bg-primary/20 flex items-center justify-center backdrop-blur-[1px]">
                                                        <Check className="h-5 w-5 text-primary" strokeWidth={3} />
                                                    </div>
                                                )}
                                            </div>
                                            <div className="min-w-0 pr-2">
                                                <h4 className="text-xs font-bold truncate pr-3">{playlist.title}</h4>
                                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                    {playlist.itemCount} videos
                                                </p>
                                            </div>
                                            {playlist.isSelected && (
                                                <div className="absolute top-2 right-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                {playlists.length === 0 && (
                                    <div className="text-center py-6 bg-muted/20 rounded-xl border border-dashed border-border/40">
                                        <AlertCircle className="h-6 w-6 text-muted-foreground mx-auto mb-2 opacity-50" />
                                        <p className="text-xs text-muted-foreground">No playlists found on your account.</p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium">
                                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                                    Save Selection
                                </Button>
                                <Button variant="secondary" onClick={handleSyncNow} disabled={syncing} className="flex-1 h-11 gap-2 cursor-pointer shadow-sm hover:shadow-md transition-all font-medium">
                                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    Sync Now
                                </Button>
                            </div>

                            <div className="flex justify-between items-center pt-2 px-1">
                                <p className="text-[10px] text-muted-foreground">
                                    {lastSync ? `Last synced: ${new Date(lastSync + "Z").toLocaleString()}` : "Not synced yet"}
                                </p>
                                <button onClick={handleDisconnect} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors underline underline-offset-2">
                                    Disconnect account
                                </button>
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
