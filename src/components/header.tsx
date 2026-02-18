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
        <header className="sticky top-0 z-30 flex items-center border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 py-3">
            <div className="flex items-center w-10 sm:w-48">
                <SidebarTrigger className="text-muted-foreground hover:text-foreground cursor-pointer" />
            </div>

            <div className="flex-1 flex justify-center px-4 font-normal">
                <form
                    onSubmit={handleSearch}
                    className="relative w-full max-w-xl"
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search bookmarks..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="pl-9 pr-9 bg-muted/40 border-border/40 focus:bg-background transition-colors"
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
            </div>

            <div className="flex items-center justify-end w-10 sm:w-48">
                <Button onClick={onAddBookmark} size="sm" className="gap-2 cursor-pointer shadow-sm shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    <span className="hidden sm:inline">Add Bookmark</span>
                </Button>
            </div>
        </header>
    );
}
