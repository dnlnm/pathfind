"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { BookmarkCard } from "@/components/bookmark-card";
import { BookmarkForm } from "@/components/bookmark-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkWithTags } from "@/types";
import { Compass, ChevronLeft, ChevronRight, LayoutGrid, List, SortAsc } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

function BookmarkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkWithTags | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState("newest");

  // Load view mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("bookmark-view-mode");
    if (saved === "grid") setViewMode("grid");
  }, []);

  const toggleViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("bookmark-view-mode", mode);
  };

  const fetchBookmarks = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const params = new URLSearchParams();

    const filter = searchParams.get("filter");
    const tag = searchParams.get("tag");
    const q = searchParams.get("q");
    const p = searchParams.get("page");

    if (filter) params.set("filter", filter);
    if (tag) params.set("tag", tag);
    if (q) params.set("q", q);
    if (p) params.set("page", p);
    params.set("sort", sortBy);

    try {
      const res = await fetch(`/api/bookmarks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setBookmarks(data.bookmarks);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [searchParams, sortBy]);

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
    fetchBookmarks(false);
    fetchCounts();
  }, [fetchBookmarks, fetchCounts, sortBy]);

  const handleRefresh = () => {
    fetchBookmarks(true);
    fetchCounts();
    setRefreshTrigger(prev => prev + 1);
  };

  const handleEdit = (bookmark: BookmarkWithTags) => {
    setEditingBookmark(bookmark);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) setEditingBookmark(null);
  };

  const currentFilter = searchParams.get("filter") || "all";
  const currentTag = searchParams.get("tag") || "";
  const currentQuery = searchParams.get("q") || "";

  const pageTitle = currentTag
    ? `Tag: ${currentTag}`
    : currentQuery
      ? `Search: "${currentQuery}"`
      : currentFilter === "readlater"
        ? "Read Later"
        : currentFilter === "archived"
          ? "Archived"
          : "All Bookmarks";

  return (
    <SidebarProvider>
      <AppSidebar bookmarkCounts={counts} refreshTrigger={refreshTrigger} />
      <SidebarInset>
        <Header onAddBookmark={() => setFormOpen(true)} />

        <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
          {/* Page title */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{pageTitle}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total} bookmark{total !== 1 ? "s" : ""}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Sort Dropdown */}
              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="h-9 w-[140px] bg-background/50 border-border/40 text-xs cursor-pointer">
                    <SortAsc className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest" className="text-xs cursor-pointer">Newest First</SelectItem>
                    <SelectItem value="oldest" className="text-xs cursor-pointer">Oldest First</SelectItem>
                    <SelectItem value="title_asc" className="text-xs cursor-pointer">Title (A-Z)</SelectItem>
                    <SelectItem value="title_desc" className="text-xs cursor-pointer">Title (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* View Toggle */}
              <div className="flex items-center border border-border/40 rounded-lg p-0.5 bg-muted/30">
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => toggleViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="icon"
                  className="h-7 w-7 cursor-pointer"
                  onClick={() => toggleViewMode("grid")}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Bookmark list */}
          {loading ? (
            <div className={cn(
              "w-full",
              viewMode === "grid"
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                : "space-y-3"
            )}>
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className={cn(
                  "rounded-xl",
                  viewMode === "grid" ? "aspect-[4/5]" : "h-24 w-full"
                )} />
              ))}
            </div>
          ) : bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                <Compass className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-muted-foreground">
                {currentQuery ? "No bookmarks found" : "No bookmarks yet"}
              </h3>
              <p className="text-sm text-muted-foreground/70 mt-1 max-w-sm">
                {currentQuery
                  ? "Try a different search term"
                  : "Click the \"Add Bookmark\" button to save your first link"
                }
              </p>
            </div>
          ) : (
            <>
              <div className={cn(
                "w-full",
                viewMode === "grid"
                  ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                  : "space-y-2"
              )}>
                {bookmarks.map((bookmark) => (
                  <BookmarkCard
                    key={bookmark.id}
                    bookmark={bookmark}
                    onEdit={handleEdit}
                    onRefresh={handleRefresh}
                    layout={viewMode}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("page", String(page - 1));
                      router.push(`/?${params.toString()}`);
                    }}
                    className="cursor-pointer"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-3">
                    Page {page} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => {
                      const params = new URLSearchParams(searchParams.toString());
                      params.set("page", String(page + 1));
                      router.push(`/?${params.toString()}`);
                    }}
                    className="cursor-pointer"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </main>

        <BookmarkForm
          open={formOpen}
          onOpenChange={handleFormClose}
          bookmark={editingBookmark}
          onSuccess={handleRefresh}
        />
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    }>
      <BookmarkPageContent />
    </Suspense>
  );
}
