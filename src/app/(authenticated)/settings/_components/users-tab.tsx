"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { MoreHorizontal, Plus, Trash, Shield, ShieldOff, KeyRound, Loader2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface UserRecord {
    id: string;
    email: string;
    name: string | null;
    username: string | null;
    role: string;
    createdAt: string;
    bookmarkCount: number;
}

interface UsersTabProps {
    currentUserId: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export function UsersTab({ currentUserId }: UsersTabProps) {
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [createOpen, setCreateOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<UserRecord | null>(null);
    const [resetTarget, setResetTarget] = useState<UserRecord | null>(null);
    const [newResetPassword, setNewResetPassword] = useState("");

    // Create form
    const [newUsername, setNewUsername] = useState("");
    const [newEmail, setNewEmail] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [newRole, setNewRole] = useState<"user" | "admin">("user");
    const [creating, setCreating] = useState(false);
    const [createErrors, setCreateErrors] = useState<Record<string, string>>({});

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data);
            }
        } catch {
            // Network error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreateErrors({});
        if (!USERNAME_RE.test(newUsername)) {
            setCreateErrors({ username: "Invalid username (3–30 chars, letters/numbers/underscores)" });
            return;
        }
        setCreating(true);
        const res = await fetch("/api/admin/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: newUsername, email: newEmail, password: newPassword, role: newRole }),
        });
        const data = await res.json();
        setCreating(false);
        if (!res.ok) {
            if (data.field) setCreateErrors({ [data.field]: data.error });
            else toast.error(data.error || "Failed to create user");
            return;
        }
        toast.success(`User @${newUsername} created`);
        setCreateOpen(false);
        setNewUsername(""); setNewEmail(""); setNewPassword(""); setNewRole("user");
        fetchUsers();
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        const res = await fetch(`/api/admin/users/${deleteTarget.id}`, { method: "DELETE" });
        if (res.ok) {
            toast.success(`User @${deleteTarget.username || deleteTarget.email} deleted`);
            setDeleteTarget(null);
            fetchUsers();
        } else {
            const d = await res.json();
            toast.error(d.error || "Failed to delete user");
        }
    };

    const handleToggleRole = async (user: UserRecord) => {
        const newRole = user.role === "admin" ? "user" : "admin";
        const res = await fetch(`/api/admin/users/${user.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ role: newRole }),
        });
        if (res.ok) {
            toast.success(`@${user.username || user.email} is now ${newRole}`);
            fetchUsers();
        } else {
            const d = await res.json();
            toast.error(d.error || "Failed to update role");
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!resetTarget || newResetPassword.length < 6) return;
        const res = await fetch(`/api/admin/users/${resetTarget.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password: newResetPassword }),
        });
        if (res.ok) {
            toast.success("Password updated");
            setResetTarget(null);
            setNewResetPassword("");
        } else {
            const d = await res.json();
            toast.error(d.error || "Failed to reset password");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4" /> User Management
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{users.length} user{users.length !== 1 ? "s" : ""} total</p>
                </div>
                <Button size="sm" className="cursor-pointer gap-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" /> Add User
                </Button>
            </div>

            {/* User list */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
                {users.map((user, i) => (
                    <div
                        key={user.id}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3",
                            i !== 0 && "border-t border-border/30",
                            user.id === currentUserId && "bg-primary/3"
                        )}
                    >
                        {/* Avatar */}
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center text-sm font-bold text-primary flex-shrink-0">
                            {(user.username || user.email)[0].toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">
                                    @{user.username || "—"}
                                </span>
                                {user.role === "admin" && (
                                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20">Admin</Badge>
                                )}
                                {user.id === currentUserId && (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">You</Badge>
                                )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>

                        {/* Bookmark count */}
                        <span className="text-xs text-muted-foreground shrink-0">
                            {user.bookmarkCount} bookmark{user.bookmarkCount !== 1 ? "s" : ""}
                        </span>

                        {/* Actions */}
                        {user.id !== currentUserId && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer">
                                        <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                        className="cursor-pointer gap-2"
                                        onClick={() => handleToggleRole(user)}
                                    >
                                        {user.role === "admin"
                                            ? <><ShieldOff className="h-4 w-4" /> Remove Admin</>
                                            : <><Shield className="h-4 w-4" /> Make Admin</>
                                        }
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        className="cursor-pointer gap-2"
                                        onClick={() => { setResetTarget(user); setNewResetPassword(""); }}
                                    >
                                        <KeyRound className="h-4 w-4" /> Reset Password
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                        onClick={() => setDeleteTarget(user)}
                                    >
                                        <Trash className="h-4 w-4" /> Delete User
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                ))}
            </div>

            {/* Create user dialog */}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogContent className="sm:max-w-md bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Add User</DialogTitle>
                        <DialogDescription>Create a new account. The user can change their password after logging in.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreate} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Username</Label>
                            <Input
                                placeholder="username"
                                value={newUsername}
                                onChange={e => setNewUsername(e.target.value)}
                                className={cn(createErrors.username && "border-destructive")}
                                required
                            />
                            {createErrors.username && <p className="text-xs text-destructive">{createErrors.username}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Email</Label>
                            <Input
                                type="email"
                                placeholder="user@example.com"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                className={cn(createErrors.email && "border-destructive")}
                                required
                            />
                            {createErrors.email && <p className="text-xs text-destructive">{createErrors.email}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Password</Label>
                            <Input
                                type="password"
                                placeholder="Min. 6 characters"
                                value={newPassword}
                                onChange={e => setNewPassword(e.target.value)}
                                className={cn(createErrors.password && "border-destructive")}
                                required
                            />
                            {createErrors.password && <p className="text-xs text-destructive">{createErrors.password}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label>Role</Label>
                            <Select value={newRole} onValueChange={v => setNewRole(v as "user" | "admin")}>
                                <SelectTrigger className="cursor-pointer">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user" className="cursor-pointer">User</SelectItem>
                                    <SelectItem value="admin" className="cursor-pointer">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="cursor-pointer">Cancel</Button>
                            <Button type="submit" disabled={creating} className="cursor-pointer">
                                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create User"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Delete confirmation */}
            <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
                <DialogContent className="sm:max-w-md bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle className="text-destructive">Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete <strong>@{deleteTarget?.username || deleteTarget?.email}</strong>?
                            All their bookmarks, collections, tags, and rules will be permanently deleted. This cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)} className="cursor-pointer">Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} className="cursor-pointer">Delete User</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Reset password dialog */}
            <Dialog open={!!resetTarget} onOpenChange={open => !open && setResetTarget(null)}>
                <DialogContent className="sm:max-w-md bg-card border-border/50">
                    <DialogHeader>
                        <DialogTitle>Reset Password</DialogTitle>
                        <DialogDescription>Set a new password for @{resetTarget?.username || resetTarget?.email}.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleResetPassword} className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>New Password</Label>
                            <Input
                                type="password"
                                placeholder="Min. 6 characters"
                                value={newResetPassword}
                                onChange={e => setNewResetPassword(e.target.value)}
                                required
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setResetTarget(null)} className="cursor-pointer">Cancel</Button>
                            <Button type="submit" disabled={newResetPassword.length < 6} className="cursor-pointer">Reset Password</Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
