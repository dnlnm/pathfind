"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Search, Plus, X } from "lucide-react";

interface HeaderProps {
    onAddBookmark: () => void;
}

export function Header({ onAddBookmark }: HeaderProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [query, setQuery] = useState(searchParams.get("q") || "");

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (query) {
            params.set("q", query);
        } else {
            params.delete("q");
        }
        params.delete("page");
        router.push(`/?${params.toString()}`);
    };

    const clearSearch = () => {
        setQuery("");
        const params = new URLSearchParams(searchParams.toString());
        params.delete("q");
        router.push(`/?${params.toString()}`);
    };

    return (
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />

            <form
                onSubmit={handleSearch}
                className="flex-1 relative max-w-xl"
            >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search bookmarks..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="pl-9 pr-9 bg-muted/50 border-border/50"
                />
                {query && (
                    <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </form>

            <Button onClick={onAddBookmark} size="sm" className="gap-2 cursor-pointer">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add Bookmark</span>
            </Button>
        </header>
    );
}
