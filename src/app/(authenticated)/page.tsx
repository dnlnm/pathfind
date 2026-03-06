"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AppLayout } from "@/components/app-layout";
import { Header } from "@/components/header";
import { BookmarkCard } from "@/components/bookmark-card";
import { BookmarkForm } from "@/components/bookmark-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookmarkWithTags } from "@/types";
import { Compass, LayoutGrid, List, SortAsc, Edit, Trash, CheckSquare, Square, Archive, Clock, Tag, FolderOpen, X, AlertTriangle, Image as ImageIcon, Brain, Loader2 } from "lucide-react";
import { CollectionForm } from "@/components/collection-form";
import { toast } from "sonner";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function BookmarkPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [bookmarks, setBookmarks] = useState<BookmarkWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
  const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0, nsfw: 0 });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingBookmark, setEditingBookmark] = useState<BookmarkWithTags | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState("newest");
  const [collectionFormOpen, setCollectionFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCollectionId, setEditingCollectionId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([]);
  const [isInSelectionMode, setIsInSelectionMode] = useState(false);
  const [bulkTagDialogOpen, setBulkTagDialogOpen] = useState(false);
  const [newBulkTag, setNewBulkTag] = useState("");
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const exitSelectionMode = useCallback(() => {
    setIsInSelectionMode(false);
    setSelectedIds(new Set());
  }, []);
  const [sharedData, setSharedData] = useState<{ url?: string; title?: string; description?: string } | null>(null);
  const [nsfwDisplayMode, setNsfwDisplayMode] = useState<"blur" | "hide" | "show">("blur");
  const [maintenanceStats, setMaintenanceStats] = useState<{ missingThumbnails: number; missingEmbeddings: number } | null>(null);
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then(res => res.json())
      .then(data => setCollections(data))
      .catch(() => { });

    // Load NSFW display mode from localStorage (client-side preference)
    const saved = localStorage.getItem("nsfw-display-mode") as "blur" | "hide" | "show" | null;
    if (saved && ["blur", "hide", "show"].includes(saved)) {
      setNsfwDisplayMode(saved);
    }
  }, [refreshTrigger]);

  // Escape key exits selection mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isInSelectionMode) {
        exitSelectionMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isInSelectionMode, exitSelectionMode]);

  // Maintenance stats polling — runs on its own 5-minute schedule, independent
  // of refreshTrigger. We intentionally do NOT re-check on every bookmark change
  // because a newly added bookmark won't have an embedding yet (the worker needs
  // time to process it), which would cause a spurious "missing data" banner.
  useEffect(() => {
    const fetchMaintenance = () =>
      fetch("/api/maintenance")
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMaintenanceStats(d); })
        .catch(() => { });
    fetchMaintenance();
    const interval = setInterval(fetchMaintenance, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [columns, setColumns] = useState(1);

  // Load view mode from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("bookmark-view-mode");
    if (saved === "grid") setViewMode("grid");

    const updateCols = () => {
      // These match tailwind breakpoints (sm = 640px, lg = 1024px)
      if (window.innerWidth >= 1024) setColumns(3);
      else if (window.innerWidth >= 640) setColumns(2);
      else setColumns(1);
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, []);

  const toggleViewMode = (mode: "list" | "grid") => {
    setViewMode(mode);
    localStorage.setItem("bookmark-view-mode", mode);
  };

  const fetchBookmarks = useCallback(async (targetPage: number) => {
    if (targetPage === 1) {
      abortControllerRef.current?.abort();
      setLoading(true);
    } else {
      setIsFetchingNextPage(true);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const params = new URLSearchParams();

    const filter = searchParams.get("filter");
    const tag = searchParams.get("tag");
    const collection = searchParams.get("collection");
    const q = searchParams.get("q");
    const nsfw = searchParams.get("nsfw");

    if (filter) params.set("filter", filter);
    if (tag) params.set("tag", tag);
    if (collection) params.set("collection", collection);
    if (q) params.set("q", q);
    if (nsfw) params.set("nsfw", nsfw);

    params.set("page", String(targetPage));
    params.set("sort", sortBy);

    const isAiSearch = searchParams.get("ai") === "true";
    const useSemantic = isAiSearch && q;

    try {
      const endpoint = useSemantic ? `/api/search/semantic` : `/api/bookmarks`;
      const res = await fetch(`${endpoint}?${params.toString()}`, { signal: controller.signal });
      if (controller.signal.aborted) return;
      if (res.ok) {
        const data = await res.json();
        if (controller.signal.aborted) return;
        if (targetPage === 1) {
          setBookmarks(data.bookmarks);
        } else {
          setBookmarks(prev => {
            const existingIds = new Set(prev.map(b => b.id));
            const newUnique = data.bookmarks.filter((b: BookmarkWithTags) => !existingIds.has(b.id));
            return [...prev, ...newUnique];
          });
        }
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      }
    } catch (e: any) {
      if (e.name === "AbortError") return;
    }
    setLoading(false);
    setIsFetchingNextPage(false);
  }, [searchParams, sortBy]);

  const fetchCounts = useCallback(async () => {
    try {
      const [allRes, readLaterRes, archivedRes, nsfwRes] = await Promise.all([
        fetch("/api/bookmarks?limit=0"),
        fetch("/api/bookmarks?filter=readlater&limit=0"),
        fetch("/api/bookmarks?filter=archived&limit=0"),
        fetch("/api/bookmarks?nsfw=only&limit=0"),
      ]);

      const [allData, readLaterData, archivedData, nsfwData] = await Promise.all([
        allRes.json(),
        readLaterRes.json(),
        archivedRes.json(),
        nsfwRes.json(),
      ]);

      setCounts({
        all: allData.total || 0,
        readLater: readLaterData.total || 0,
        archived: archivedData.total || 0,
        nsfw: nsfwData.total || 0,
      });
    } catch {
      // Silent fail
    }
  }, []);

  useEffect(() => {
    fetchBookmarks(1);
    fetchCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, sortBy, refreshTrigger]);

  useEffect(() => {
    const title = searchParams.get("title");
    const text = searchParams.get("text");
    const url = searchParams.get("url");

    if (title || text || url) {
      // Find URL in text if url parameter is missing
      let extractedUrl = url || "";
      if (!extractedUrl && text) {
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        if (urlMatch) extractedUrl = urlMatch[0];
      }

      setSharedData({
        url: extractedUrl,
        title: title || (text && text !== extractedUrl ? text : ""),
      });
      setFormOpen(true);

      // Clean up the URL
      const params = new URLSearchParams(searchParams.toString());
      params.delete("title");
      params.delete("text");
      params.delete("url");
      const query = params.toString();
      router.replace(query ? `?${query}` : "/");
    }
  }, [searchParams, router]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    window.dispatchEvent(new CustomEvent("refresh-sidebar"));
  };

  const handleEdit = (bookmark: BookmarkWithTags) => {
    setEditingBookmark(bookmark);
    setFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setFormOpen(open);
    if (!open) {
      setEditingBookmark(null);
      setSharedData(null);
    }
  };

  const handleDeleteCollection = async () => {
    if (!currentCollectionId) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/collections/${currentCollectionId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Collection deleted");
        setDeleteDialogOpen(false);
        router.push("/");
        handleRefresh();
      }
    } catch {
      toast.error("Failed to delete collection");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedIds(new Set(bookmarks.map(b => b.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBulkAction = async (action: string, data?: any) => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);

    try {
      const ids = Array.from(selectedIds);
      let method = "PUT";
      let payload: any = { ids, action, data };

      if (action === "delete") {
        method = "DELETE";
        payload = { ids };
      }

      const res = await fetch("/api/bookmarks/bulk", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const result = await res.json();
        const n = result.affected ?? ids.length;
        const label = n === 1 ? "1 bookmark" : `${n} bookmarks`;
        if (action === "delete") toast.success(`Deleted ${label}`);
        else if (action === "archive") toast.success(data?.value ? `Archived ${label}` : `Unarchived ${label}`);
        else if (action === "readLater") toast.success(data?.value ? `Added ${label} to Read Later` : `Removed ${label} from Read Later`);
        else if (action === "addTags") toast.success(`Tag "${data?.tags?.[0]}" added to ${label}`);
        else if (action === "addToCollection") toast.success(`Moved ${label} to collection`);
        else if (action === "removeFromCollection") toast.success(`Removed ${label} from collection`);
        else toast.success(`Action completed for ${label}`);
        setSelectedIds(new Set());
        setIsInSelectionMode(false);
        handleRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Bulk action failed");
      }
    } catch {
      toast.error("An error occurred during bulk action");
    } finally {
      setBulkActionLoading(false);
    }
  };

  const currentFilter = searchParams.get("filter") || "all";
  const currentTag = searchParams.get("tag") || "";
  const currentCollectionId = searchParams.get("collection") || "";
  const currentQuery = searchParams.get("q") || "";

  const [currentCollectionName, setCurrentCollectionName] = useState("");

  useEffect(() => {
    if (currentCollectionId) {
      fetch(`/api/collections/${currentCollectionId}`)
        .then(res => res.json())
        .then(data => setCurrentCollectionName(data.name))
        .catch(() => setCurrentCollectionName("Collection"));
    } else {
      setCurrentCollectionName("");
    }
  }, [currentCollectionId, refreshTrigger]);

  const isAiSearch = searchParams.get("ai") === "true";

  const currentNsfw = searchParams.get("nsfw") || "";

  const pageTitle = currentCollectionId
    ? `Collection: ${currentCollectionName || "..."}`
    : currentTag
      ? `Tag: #${currentTag}`
      : currentQuery
        ? `${isAiSearch ? "✨ AI Search" : "Search"}: "${currentQuery}"`
        : currentFilter === "readlater"
          ? "Read Later"
          : currentFilter === "archived"
            ? "Archived"
            : currentNsfw === "only"
              ? "Sensitive Content"
              : "All Bookmarks";

  // Apply 'hide' mode client-side — filter out NSFW bookmarks when preference is 'hide'
  const visibleBookmarks = nsfwDisplayMode === "hide"
    ? bookmarks.filter(b => !b.isNsfw)
    : bookmarks;

  const itemsPerRow = viewMode === "grid" ? columns : 1;
  const rowCount = Math.ceil(visibleBookmarks.length / itemsPerRow);

  const virtualizer = useWindowVirtualizer({
    count: rowCount,
    estimateSize: () => (viewMode === "grid" ? 340 + 16 : 110 + 8),
    overscan: 2,
  });

  const virtualItems = virtualizer.getVirtualItems();

  useEffect(() => {
    if (!virtualItems.length) return;

    const lastRenderedRow = virtualItems[virtualItems.length - 1];
    if (
      lastRenderedRow.index >= rowCount - 1 &&
      !isFetchingNextPage &&
      !loading &&
      page < totalPages
    ) {
      fetchBookmarks(page + 1);
    }
  }, [virtualItems, isFetchingNextPage, loading, page, totalPages, rowCount, fetchBookmarks]);

  return (
    <>
      <Header onAddBookmark={() => setFormOpen(true)} />

      {/* Maintenance notification banner */}
      {!maintenanceDismissed && maintenanceStats && (maintenanceStats.missingThumbnails > 0 || maintenanceStats.missingEmbeddings > 0) && (
        <div className="mx-4 md:mx-6 mt-4 flex items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/8 px-4 py-2.5 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
          <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
            <span className="font-medium text-foreground">Some bookmarks are missing data:</span>
            <div className="flex items-center gap-3 text-muted-foreground">
              {maintenanceStats.missingThumbnails > 0 && (
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span><strong className="text-foreground">{maintenanceStats.missingThumbnails}</strong> thumbnails</span>
                </span>
              )}
              {maintenanceStats.missingEmbeddings > 0 && (
                <span className="flex items-center gap-1">
                  <Brain className="h-3.5 w-3.5" />
                  <span><strong className="text-foreground">{maintenanceStats.missingEmbeddings}</strong> embeddings</span>
                </span>
              )}
            </div>
          </div>
          <a
            href="/settings?tab=tasks"
            className="shrink-0 text-xs font-medium text-amber-500 hover:text-amber-400 underline-offset-2 hover:underline transition-colors"
          >
            Fix in Settings →
          </a>
          <button
            onClick={() => setMaintenanceDismissed(true)}
            className="shrink-0 p-1 rounded-md text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
            aria-label="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 max-w-5xl mx-auto w-full">
        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{pageTitle}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {total} bookmark{total !== 1 ? "s" : ""}
              </p>
            </div>
            {currentCollectionId && (
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer"
                  onClick={() => {
                    setEditingCollectionId(currentCollectionId);
                    setCollectionFormOpen(true);
                  }}
                >
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit collection</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                  onClick={() => setDeleteDialogOpen(true)}
                >
                  <Trash className="h-4 w-4" />
                  <span className="sr-only">Delete collection</span>
                </Button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Bulk Selection Toggle */}
            <Button
              variant={isInSelectionMode ? "secondary" : "outline"}
              size="sm"
              className={cn(
                "h-9 gap-2 text-xs cursor-pointer",
                isInSelectionMode ? "border-primary/50 text-primary" : "text-muted-foreground"
              )}
              onClick={() => {
                if (isInSelectionMode) {
                  exitSelectionMode();
                } else {
                  setIsInSelectionMode(true);
                }
              }}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Bulk Action</span>
            </Button>

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
        {loading && bookmarks.length === 0 ? (
          <div className={cn(
            "w-full",
            viewMode === "grid"
              ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              : "space-y-3"
          )}>
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className={cn(
                "rounded-xl",
                viewMode === "grid" ? "h-[400px]" : "h-[110px] w-full"
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
                ? isAiSearch ? "Try a different semantic search term" : "Try a different search term"
                : "Click the \"Add Bookmark\" button to save your first link"
              }
            </p>
          </div>
        ) : (
          <>
            <div
              className="w-full relative transition-opacity duration-300"
              style={{
                height: `${virtualizer.getTotalSize()}px`,
                opacity: loading && page === 1 ? 0.5 : 1,
                pointerEvents: loading && page === 1 ? "none" : "auto",
              }}
            >
              {virtualItems.map((virtualRow) => {
                const startIdx = virtualRow.index * itemsPerRow;
                const rowItems = visibleBookmarks.slice(startIdx, startIdx + itemsPerRow);

                return (
                  <div
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={cn(
                      "absolute top-0 left-0 w-full",
                      viewMode === "grid"
                        ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pb-4"
                        : "flex flex-col pb-2"
                    )}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {rowItems.map((bookmark) => (
                      <BookmarkCard
                        key={bookmark.id}
                        bookmark={bookmark}
                        onEdit={handleEdit}
                        onRefresh={handleRefresh}
                        layout={viewMode}
                        isSelected={selectedIds.has(bookmark.id)}
                        onSelect={handleSelect}
                        selectionMode={isInSelectionMode || selectedIds.size > 0}
                        nsfwDisplayMode={nsfwDisplayMode}
                      />
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Infinite loading indicator */}
            {isFetchingNextPage && (
              <div className="w-full flex items-center justify-center py-6 mt-4">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            )}
          </>
        )}

        {/* Bulk Actions Toolbar */}
        {(isInSelectionMode || selectedIds.size > 0) && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="bg-card/95 backdrop-blur-md border border-border/50 shadow-2xl rounded-2xl px-4 py-3 flex items-center gap-4 min-w-[320px] md:min-w-[450px]">
              <div className="flex items-center gap-2 pr-4 border-r border-border/20">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg cursor-pointer hover:bg-muted"
                  onClick={exitSelectionMode}
                  disabled={bulkActionLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium whitespace-nowrap">
                  {selectedIds.size} selected
                </div>
              </div>

              {bulkActionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing…</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                    onClick={() => handleBulkAction("archive", { value: currentFilter !== "archived" })}
                    disabled={selectedIds.size === 0}
                  >
                    <Archive className="h-4 w-4" />
                    <span className="hidden md:inline">
                      {currentFilter === "archived" ? "Unarchive" : "Archive"}
                    </span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                    onClick={() => handleBulkAction("readLater", { value: currentFilter !== "readlater" })}
                    disabled={selectedIds.size === 0}
                  >
                    <Clock className="h-4 w-4" />
                    <span className="hidden md:inline">
                      {currentFilter === "readlater" ? "Remove Read Later" : "Read Later"}
                    </span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                        disabled={selectedIds.size === 0}
                      >
                        <FolderOpen className="h-4 w-4" />
                        <span className="hidden md:inline">Move to</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      {currentCollectionId && (
                        <>
                          <DropdownMenuItem
                            onClick={() => handleBulkAction("removeFromCollection", { collectionIds: [currentCollectionId] })}
                            className="cursor-pointer text-destructive/80 focus:text-destructive"
                          >
                            <X className="h-3.5 w-3.5 mr-2" />
                            Remove from this collection
                          </DropdownMenuItem>
                          {collections.length > 0 && <DropdownMenuSeparator />}
                        </>
                      )}
                      {collections.map(c => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() => handleBulkAction("addToCollection", { collectionIds: [c.id] })}
                          className="cursor-pointer"
                        >
                          {c.name}
                        </DropdownMenuItem>
                      ))}
                      {collections.length === 0 && !currentCollectionId && (
                        <DropdownMenuItem disabled>No collections</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                    onClick={() => setBulkTagDialogOpen(true)}
                    disabled={selectedIds.size === 0}
                  >
                    <Tag className="h-4 w-4" />
                    <span className="hidden md:inline">Add Tag</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 text-xs cursor-pointer"
                    onClick={() => setBulkDeleteDialogOpen(true)}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash className="h-4 w-4" />
                    <span className="hidden md:inline">Delete</span>
                  </Button>
                </div>
              )}

              <div className="ml-auto pl-2 border-l border-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-primary hover:bg-primary/10 text-xs cursor-pointer"
                  onClick={() => handleSelectAll(selectedIds.size < bookmarks.length)}
                  disabled={bookmarks.length === 0 || bulkActionLoading}
                >
                  {selectedIds.size < bookmarks.length ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      <span className="hidden md:inline">Select All ({bookmarks.length})</span>
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      <span className="hidden md:inline">Deselect All</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={bulkTagDialogOpen} onOpenChange={setBulkTagDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Add Tag to {selectedIds.size} items</DialogTitle>
            <DialogDescription>
              This tag will be added to all selected bookmarks.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-tag">Tag Name</Label>
              <Input
                id="bulk-tag"
                placeholder="e.g. engineering"
                value={newBulkTag}
                onChange={(e) => setNewBulkTag(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newBulkTag.trim()) {
                    const tag = newBulkTag.trim();
                    setBulkTagDialogOpen(false);
                    handleBulkAction("addTags", { tags: [tag] }).then(() => setNewBulkTag(""));
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkTagDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (newBulkTag.trim()) {
                  const tag = newBulkTag.trim();
                  setBulkTagDialogOpen(false);
                  handleBulkAction("addTags", { tags: [tag] }).then(() => setNewBulkTag(""));
                }
              }}
              disabled={!newBulkTag.trim() || bulkActionLoading}
              className="cursor-pointer"
            >
              Add Tag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete {selectedIds.size} Bookmarks</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete <span className="font-semibold text-foreground">{selectedIds.size}</span> bookmarks?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                handleBulkAction("delete");
                setBulkDeleteDialogOpen(false);
              }}
              disabled={bulkActionLoading}
              className="cursor-pointer"
            >
              {bulkActionLoading ? "Deleting..." : "Delete All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BookmarkForm
        open={formOpen}
        onOpenChange={handleFormClose}
        bookmark={editingBookmark}
        onSuccess={handleRefresh}
        initialValues={sharedData}
      />

      <CollectionForm
        open={collectionFormOpen}
        onOpenChange={setCollectionFormOpen}
        collectionId={editingCollectionId}
        onSuccess={handleRefresh}
      />

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border/50">
          <DialogHeader>
            <DialogTitle>Delete Collection</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the collection <span className="font-semibold text-foreground">"{currentCollectionName}"</span>?
              This will not delete the bookmarks within it, but they will no longer be part of this collection.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteCollection}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete Collection"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
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
