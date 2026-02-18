"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
} from "@/components/ui/sidebar";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Compass, Bookmark, Clock, Archive, Tag, LogOut, ChevronUp } from "lucide-react";

interface SidebarTag {
    id: string;
    name: string;
    _count: { bookmarks: number };
}

interface AppSidebarProps {
    bookmarkCounts: { all: number; readLater: number; archived: number };
    userName?: string;
    refreshTrigger?: number;
}

export function AppSidebar({ bookmarkCounts, userName, refreshTrigger }: AppSidebarProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentFilter = searchParams.get("filter") || "all";
    const currentTag = searchParams.get("tag") || "";
    const [tags, setTags] = useState<SidebarTag[]>([]);

    const fetchTags = useCallback(async () => {
        const res = await fetch("/api/tags");
        if (res.ok) {
            const data = await res.json();
            setTags(data);
        }
    }, []);

    useEffect(() => {
        fetchTags();
    }, [fetchTags, refreshTrigger]);

    const navigate = (filter: string, tag?: string) => {
        const params = new URLSearchParams();
        if (filter !== "all") params.set("filter", filter);
        if (tag) params.set("tag", tag);
        router.push(`/?${params.toString()}`);
    };

    const navItems = [
        { label: "All Bookmarks", icon: Bookmark, filter: "all", count: bookmarkCounts.all },
        { label: "Read Later", icon: Clock, filter: "readlater", count: bookmarkCounts.readLater },
        { label: "Archived", icon: Archive, filter: "archived", count: bookmarkCounts.archived },
    ];

    return (
        <Sidebar>
            <SidebarHeader className="border-b border-border/50 px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                        <Compass className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold tracking-tight">PathFind</h1>
                        <p className="text-xs text-muted-foreground">Bookmark Manager</p>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
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
                    <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground/70">
                        Tags
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {tags.length === 0 ? (
                                <SidebarMenuItem>
                                    <SidebarMenuButton disabled className="text-muted-foreground/50">
                                        <Tag className="h-4 w-4" />
                                        <span className="italic">No tags yet</span>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ) : (
                                tags.map((tag) => (
                                    <SidebarMenuItem key={tag.id}>
                                        <SidebarMenuButton
                                            onClick={() => navigate("all", tag.name)}
                                            isActive={currentTag === tag.name}
                                            className="cursor-pointer"
                                        >
                                            <Tag className="h-4 w-4" />
                                            <span>{tag.name}</span>
                                        </SidebarMenuButton>
                                        <SidebarMenuBadge className="text-xs text-muted-foreground">
                                            {tag._count.bookmarks}
                                        </SidebarMenuBadge>
                                    </SidebarMenuItem>
                                ))
                            )}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-border/50">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <SidebarMenuButton className="cursor-pointer">
                                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                        {(userName || "A")[0].toUpperCase()}
                                    </div>
                                    <span className="truncate">{userName || "Admin"}</span>
                                    <ChevronUp className="ml-auto h-4 w-4" />
                                </SidebarMenuButton>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="top"
                                className="w-[--radix-popper-anchor-width]"
                            >
                                <DropdownMenuItem
                                    onClick={() => router.push("/settings")}
                                    className="cursor-pointer"
                                >
                                    Settings
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onClick={() => signOut({ callbackUrl: "/login" })}
                                    className="cursor-pointer text-destructive focus:text-destructive"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Sign out
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
