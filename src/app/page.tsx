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
import { Compass, LayoutGrid, List, SortAsc, Edit, Trash, CheckSquare, Square, Archive, Clock, Tag, FolderOpen, X } from "lucide-react";
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
  const [counts, setCounts] = useState({ all: 0, readLater: 0, archived: 0 });
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
  const [sharedData, setSharedData] = useState<{ url?: string; title?: string; description?: string } | null>(null);

  useEffect(() => {
    fetch("/api/collections")
      .then(res => res.json())
      .then(data => setCollections(data))
      .catch(() => { });
  }, [refreshTrigger]);

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
    if (targetPage === 1) setLoading(true);
    else setIsFetchingNextPage(true);

    const params = new URLSearchParams();

    const filter = searchParams.get("filter");
    const tag = searchParams.get("tag");
    const collection = searchParams.get("collection");
    const q = searchParams.get("q");

    if (filter) params.set("filter", filter);
    if (tag) params.set("tag", tag);
    if (collection) params.set("collection", collection);
    if (q) params.set("q", q);

    params.set("page", String(targetPage));
    params.set("sort", sortBy);

    try {
      const res = await fetch(`/api/bookmarks?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
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
    } catch {
      // Silent fail
    }
    setLoading(false);
    setIsFetchingNextPage(false);
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
    if (!open) setEditingBookmark(null);
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
        toast.success(`Bulk action "${action}" completed`);
        setSelectedIds(new Set());
        setIsInSelectionMode(false);
        handleRefresh();
      } else {
        toast.error("Bulk action failed");
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

  const pageTitle = currentCollectionId
    ? `Collection: ${currentCollectionName || "..."}`
    : currentTag
      ? `Tag: ${currentTag}`
      : currentQuery
        ? `Search: "${currentQuery}"`
        : currentFilter === "readlater"
          ? "Read Later"
          : currentFilter === "archived"
            ? "Archived"
            : "All Bookmarks";

  const itemsPerRow = viewMode === "grid" ? columns : 1;
  const rowCount = Math.ceil(bookmarks.length / itemsPerRow);

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
    <AppLayout bookmarkCounts={counts} refreshTrigger={refreshTrigger}>
      <Header onAddBookmark={() => setFormOpen(true)} />

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
                const newValue = !isInSelectionMode;
                setIsInSelectionMode(newValue);
                if (!newValue) setSelectedIds(new Set());
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
                ? "Try a different search term"
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
                const rowItems = bookmarks.slice(startIdx, startIdx + itemsPerRow);

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
                  onClick={() => {
                    handleSelectAll(false);
                    setIsInSelectionMode(false);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="text-sm font-medium">
                  {selectedIds.size} selected
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                  onClick={() => handleBulkAction("archive", { value: currentFilter !== "archived" })}
                  disabled={bulkActionLoading || selectedIds.size === 0}
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
                  disabled={bulkActionLoading || selectedIds.size === 0}
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
                      disabled={bulkActionLoading || selectedIds.size === 0}
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span className="hidden md:inline">Move to</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    {collections.map(c => (
                      <DropdownMenuItem
                        key={c.id}
                        onClick={() => handleBulkAction("addToCollection", { collectionIds: [c.id] })}
                        className="cursor-pointer"
                      >
                        {c.name}
                      </DropdownMenuItem>
                    ))}
                    {collections.length === 0 && (
                      <DropdownMenuItem disabled>No collections</DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-xs cursor-pointer hover:bg-muted"
                  onClick={() => setBulkTagDialogOpen(true)}
                  disabled={bulkActionLoading || selectedIds.size === 0}
                >
                  <Tag className="h-4 w-4" />
                  <span className="hidden md:inline">Add Tag</span>
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 text-xs cursor-pointer"
                  onClick={() => setBulkDeleteDialogOpen(true)}
                  disabled={bulkActionLoading || selectedIds.size === 0}
                >
                  <Trash className="h-4 w-4" />
                  <span className="hidden md:inline">Delete</span>
                </Button>
              </div>

              <div className="ml-auto pl-2 border-l border-border/20">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 text-primary hover:bg-primary/10 text-xs cursor-pointer"
                  onClick={() => handleSelectAll(selectedIds.size < bookmarks.length)}
                  disabled={bookmarks.length === 0}
                >
                  {selectedIds.size < bookmarks.length ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      <span className="hidden md:inline">Select All</span>
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
                    handleBulkAction("addTags", { tags: [newBulkTag.trim()] });
                    setBulkTagDialogOpen(false);
                    setNewBulkTag("");
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
                  handleBulkAction("addTags", { tags: [newBulkTag.trim()] });
                  setBulkTagDialogOpen(false);
                  setNewBulkTag("");
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

    </AppLayout>
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
