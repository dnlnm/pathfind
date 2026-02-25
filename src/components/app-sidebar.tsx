"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { signOut } from "next-auth/react";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Compass, Bookmark, Clock, Archive, Tag, LogOut, ChevronDown, Plus, MoreHorizontal, Settings2, Share2, ShieldCheck, Database, RefreshCw, ArrowLeft } from "lucide-react";
import { CollectionForm } from "./collection-form";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SidebarTag {
    id: string;
    name: string;
    _count: { bookmarks: number };
}

interface SidebarCollection {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    _count: { bookmarks: number };
}

interface AppSidebarProps {
    bookmarkCounts?: { all: number; readLater: number; archived: number };
    userName?: string;
    refreshTrigger?: number;
}

export function AppSidebar({ bookmarkCounts: initialCounts, userName, refreshTrigger }: AppSidebarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { setOpenMobile } = useSidebar();
    const searchParams = useSearchParams();
    const currentFilter = searchParams.get("filter") || "all";
    const currentTag = searchParams.get("tag") || "";
    const currentCollectionId = searchParams.get("collection") || "";
    const currentTab = searchParams.get("tab") || "general";
    const isSettingsPage = pathname === "/settings";

    const [tags, setTags] = useState<SidebarTag[]>([]);
    const [collections, setCollections] = useState<SidebarCollection[]>([]);
    const [counts, setCounts] = useState(initialCounts || { all: 0, readLater: 0, archived: 0 });
    const [collectionFormOpen, setCollectionFormOpen] = useState(false);
    const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);

    const settingsTabs = [
        { id: "general", label: "General", icon: Settings2 },
        { id: "integrations", label: "Integrations", icon: Share2 },
        { id: "security", label: "Security", icon: ShieldCheck },
        { id: "data", label: "Data Management", icon: Database },
        { id: "tasks", label: "Background Tasks", icon: RefreshCw },
    ];

    const fetchTags = useCallback(async () => {
        const res = await fetch("/api/tags");
        if (res.ok) {
            const data = await res.json();
            setTags(data);
        }
    }, []);

    const fetchCollections = useCallback(async () => {
        const res = await fetch("/api/collections");
        if (res.ok) {
            const data = await res.json();
            setCollections(data);
        }
    }, []);

    const fetchCounts = useCallback(async () => {
        try {
            const [allRes, readLaterRes, archivedRes] = await Promise.all([
                fetch("/api/bookmarks?limit=0"),
                fetch("/api/bookmarks?filter=readlater&limit=0"),
                fetch("/api/bookmarks?filter=archived&limit=0"),
            ]);

            const [allData, readLaterData, archivedData] = await Promise.all([
                allRes.json(),
                readLaterRes.json(),
                archivedRes.json(),
            ]);

            setCounts({
                all: allData.total || 0,
                readLater: readLaterData.total || 0,
                archived: archivedData.total || 0,
            });
        } catch {
            // Silent fail
        }
    }, []);

    useEffect(() => {
        fetchTags();
        fetchCollections();
        fetchCounts();
    }, [fetchTags, fetchCollections, fetchCounts, refreshTrigger]);

    useEffect(() => {
        const handleGlobalRefresh = () => {
            fetchTags();
            fetchCollections();
            fetchCounts();
        };

        window.addEventListener("refresh-sidebar", handleGlobalRefresh);
        return () => window.removeEventListener("refresh-sidebar", handleGlobalRefresh);
    }, [fetchTags, fetchCollections, fetchCounts]);

    const navigate = (filter: string, tag?: string, collectionId?: string) => {
        setOpenMobile(false);
        const params = new URLSearchParams();
        if (filter !== "all") params.set("filter", filter);
        if (tag) params.set("tag", tag);
        if (collectionId) params.set("collection", collectionId);
        router.push(`/?${params.toString()}`);
    };

    const navItems = [
        { label: "All Bookmarks", icon: Bookmark, filter: "all", count: counts.all },
        { label: "Read Later", icon: Clock, filter: "readlater", count: counts.readLater },
        { label: "Archived", icon: Archive, filter: "archived", count: counts.archived },
    ];

    const normalTags = tags.filter(tag => !tag.name.startsWith("r/"));
    const redditTags = tags.filter(tag => tag.name.startsWith("r/"));

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-border/50 px-4 py-4">
                <div
                    className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => {
                        setOpenMobile(false);
                        router.push("/");
                    }}
                >
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                        <div
                            className="h-5 w-5 bg-primary"
                            style={{
                                maskImage: 'url(/icon.svg)',
                                WebkitMaskImage: 'url(/icon.svg)',
                                maskSize: 'contain',
                                WebkitMaskSize: 'contain',
                                maskRepeat: 'no-repeat',
                                WebkitMaskRepeat: 'no-repeat'
                            }}
                        />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">PathFind</h1>
                        <p className="text-xs text-muted-foreground">Bookmark Manager</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                {isSettingsPage ? (
                    <SidebarGroup>
                        <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
                            Settings
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <SidebarMenuItem>
                                    <SidebarMenuButton
                                        onClick={() => {
                                            setOpenMobile(false);
                                            router.push("/");
                                        }}
                                        className="cursor-pointer text-muted-foreground hover:text-foreground mb-2"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        <span>Back to Library</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                                {settingsTabs.map((tab) => (
                                    <SidebarMenuItem key={tab.id}>
                                        <SidebarMenuButton
                                            onClick={() => {
                                                setOpenMobile(false);
                                                router.push(`/settings?tab=${tab.id}`);
                                            }}
                                            isActive={currentTab === tab.id}
                                            className="cursor-pointer"
                                        >
                                            <tab.icon className="h-4 w-4" />
                                            <span>{tab.label}</span>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ) : (
                    <>
                        <SidebarGroup>
                            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
                                Library
                            </SidebarGroupLabel>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {navItems.map((item) => (
                                        <SidebarMenuItem key={item.filter}>
                                            <SidebarMenuButton
                                                onClick={() => navigate(item.filter)}
                                                isActive={currentFilter === item.filter && !currentTag}
                                                className="cursor-pointer"
                                            >
                                                <item.icon className="h-4 w-4" />
                                                <span>{item.label}</span>
                                            </SidebarMenuButton>
                                            <SidebarMenuBadge className="text-xs text-muted-foreground">
                                                {item.count}
                                            </SidebarMenuBadge>
                                        </SidebarMenuItem>
                                    ))}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>

                        <SidebarGroup>
                            <div className="flex items-center justify-between px-2 pr-4">
                                <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
                                    Collections
                                </SidebarGroupLabel>
                                <button
                                    onClick={() => {
                                        setEditingCollectionId(null);
                                        setCollectionFormOpen(true);
                                    }}
                                    className="p-1 rounded-md hover:bg-muted/50 text-muted-foreground/70 hover:text-foreground transition-colors cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                </button>
                            </div>
                            <SidebarGroupContent>
                                <SidebarMenu>
                                    {collections.length === 0 ? (
                                        <SidebarMenuItem>
                                            <SidebarMenuButton disabled className="text-muted-foreground/50">
                                                <Compass className="h-4 w-4" />
                                                <span className="italic">No collections yet</span>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    ) : (
                                        collections.map((collection) => (
                                            <SidebarMenuItem key={collection.id}>
                                                <SidebarMenuButton
                                                    onClick={() => navigate("all", undefined, collection.id)}
                                                    isActive={currentCollectionId === collection.id}
                                                    className="cursor-pointer pr-14"
                                                >
                                                    <div
                                                        className="w-2 h-2 rounded-full mr-2"
                                                        style={{ backgroundColor: collection.color || "var(--primary)" }}
                                                    />
                                                    <span>{collection.name}</span>
                                                </SidebarMenuButton>

                                                <SidebarMenuBadge className="text-xs text-muted-foreground group-hover/menu-item:hidden">
                                                    {collection._count.bookmarks}
                                                </SidebarMenuBadge>
                                            </SidebarMenuItem>
                                        ))
                                    )}
                                </SidebarMenu>
                            </SidebarGroupContent>
                        </SidebarGroup>

                        <Collapsible defaultOpen className="group/collapsible">
                            <SidebarGroup>
                                <SidebarGroupLabel asChild className="text-xs uppercase tracking-wider text-muted-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer w-full flex items-center pr-2">
                                    <CollapsibleTrigger>
                                        Tags
                                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                    </CollapsibleTrigger>
                                </SidebarGroupLabel>
                                <CollapsibleContent>
                                    <SidebarGroupContent className="px-4 py-2">
                                        {normalTags.length === 0 ? (
                                            <div className="flex items-center gap-2 text-muted-foreground/50 text-sm italic">
                                                <Tag className="h-4 w-4" />
                                                <span>No tags yet</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-wrap gap-1.5">
                                                {normalTags.map((tag) => (
                                                    <Badge
                                                        key={tag.id}
                                                        variant={currentTag === tag.name ? "default" : "secondary"}
                                                        className={cn(
                                                            "cursor-pointer px-2.5 py-0.5 text-[11px] transition-all",
                                                            currentTag === tag.name
                                                                ? "hover:bg-primary/90"
                                                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        )}
                                                        onClick={() => navigate("all", tag.name)}
                                                    >
                                                        {tag.name}
                                                        <span className="ml-1.5 opacity-50 text-[10px] font-normal">
                                                            {tag._count.bookmarks}
                                                        </span>
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </SidebarGroupContent>
                                </CollapsibleContent>
                            </SidebarGroup>
                        </Collapsible>

                        {redditTags.length > 0 && (
                            <Collapsible defaultOpen className="group/collapsible">
                                <SidebarGroup>
                                    <SidebarGroupLabel asChild className="text-xs uppercase tracking-wider text-muted-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer w-full flex items-center pr-2">
                                        <CollapsibleTrigger>
                                            Reddit Tags
                                            <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                                        </CollapsibleTrigger>
                                    </SidebarGroupLabel>
                                    <CollapsibleContent>
                                        <SidebarGroupContent className="px-4 py-2">
                                            <div className="flex flex-wrap gap-1.5">
                                                {redditTags.map((tag) => (
                                                    <Badge
                                                        key={tag.id}
                                                        variant={currentTag === tag.name ? "default" : "secondary"}
                                                        className={cn(
                                                            "cursor-pointer px-2.5 py-0.5 text-[11px] transition-all",
                                                            currentTag === tag.name
                                                                ? "hover:bg-primary/90"
                                                                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                                                        )}
                                                        onClick={() => navigate("all", tag.name)}
                                                    >
                                                        {tag.name}
                                                        <span className="ml-1.5 opacity-50 text-[10px] font-normal">
                                                            {tag._count.bookmarks}
                                                        </span>
                                                    </Badge>
                                                ))}
                                            </div>
                                        </SidebarGroupContent>
                                    </CollapsibleContent>
                                </SidebarGroup>
                            </Collapsible>
                        )}
                    </>
                )}
            </SidebarContent>

            <SidebarFooter className="border-t border-border/50 p-2">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => {
                                setOpenMobile(false);
                                router.push("/settings");
                            }}
                            isActive={pathname === "/settings"}
                            className="cursor-pointer"
                        >
                            <Settings2 className="h-4 w-4" />
                            <span>Settings</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={() => signOut({ callbackUrl: "/login" })}
                            className="cursor-pointer text-destructive hover:text-destructive focus:text-destructive hover:bg-destructive/10"
                        >
                            <LogOut className="h-4 w-4" />
                            <span>Sign out</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-2 px-2 py-1.5 grayscale opacity-70">
                            <div
                                className="w-6 h-6 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-[10px] font-bold text-primary flex-shrink-0"
                                suppressHydrationWarning
                            >
                                {(userName || "A")[0].toUpperCase()}
                            </div>
                            <span className="text-xs font-medium truncate" suppressHydrationWarning>
                                {userName || "Admin"}
                            </span>
                        </div>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>

            <CollectionForm
                open={collectionFormOpen}
                onOpenChange={setCollectionFormOpen}
                collectionId={editingCollectionId}
                onSuccess={() => {
                    fetchCollections();
                    if (refreshTrigger !== undefined) {
                        // This is a hacky way to trigger a refresh in the parent
                        // but since we can't easily trigger a refresh of the bookmarks
                        // from here without a prop, it's better than nothing.
                    }
                }}
            />
        </Sidebar>
    );
}
