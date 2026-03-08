"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, Key, Trash2, Copy, Check, AtSign, RotateCw, MoreHorizontal } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface SecurityTabProps {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    username: string;
    setUsername: React.Dispatch<React.SetStateAction<string>>;
    apiTokens: any[];
    setApiTokens: React.Dispatch<React.SetStateAction<any[]>>;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export function SecurityTab({ email, setEmail, username, setUsername, apiTokens, setApiTokens }: SecurityTabProps) {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [savingUsername, setSavingUsername] = useState(false);
    const [newTokenName, setNewTokenName] = useState("");
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
    const [newlyCreatedTokenName, setNewlyCreatedTokenName] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const [rotatingTokenId, setRotatingTokenId] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        const doCopy = () => {
            setCopiedToken(text);
            toast.success("Token copied to clipboard");
            setTimeout(() => setCopiedToken(null), 2000);
        };

        if (navigator.clipboard) {
            navigator.clipboard.writeText(text).then(doCopy).catch(() => {
                fallbackCopy(text);
                doCopy();
            });
        } else {
            fallbackCopy(text);
            doCopy();
        }
    };

    const fallbackCopy = (text: string) => {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
    };

    const handleSaveEmail = async () => {
        if (!email.includes("@")) {
            toast.error("Invalid email address");
            return;
        }
        setSavingEmail(true);
        try {
            const res = await fetch("/api/settings/email", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });
            if (res.ok) {
                toast.success("Email updated");
                router.refresh();
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update email");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSavingEmail(false);
    };

    const handleSaveUsername = async () => {
        if (!USERNAME_RE.test(username)) {
            toast.error("Username must be 3–30 chars: letters, numbers, underscores only");
            return;
        }
        setSavingUsername(true);
        try {
            const res = await fetch("/api/settings/username", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username }),
            });
            if (res.ok) {
                toast.success("Username updated");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to update username");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setSavingUsername(false);
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
        if (newPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
        setChangingPassword(true);
        try {
            const res = await fetch("/api/settings/password", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            if (res.ok) {
                toast.success("Password updated");
                setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
            } else {
                const data = await res.json();
                toast.error(data.error || "Failed to change password");
            }
        } catch {
            toast.error("Something went wrong");
        }
        setChangingPassword(false);
    };

    const handleCreateToken = async () => {
        if (!newTokenName) return;
        setIsCreatingToken(true);
        try {
            const res = await fetch("/api/tokens", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newTokenName }),
            });
            if (res.ok) {
                const data = await res.json();
                setNewlyCreatedToken(data.token);
                setNewlyCreatedTokenName(data.name);
                setApiTokens([data, ...apiTokens]);
                setNewTokenName("");
                toast.success("API token created");
            }
        } catch {
            toast.error("Failed to create token");
        }
        setIsCreatingToken(false);
    };

    const handleRotateToken = async (token: { id: string; name: string }) => {
        setRotatingTokenId(token.id);
        try {
            const res = await fetch(`/api/tokens/${token.id}/rotate`, { method: "POST" });
            if (res.ok) {
                const data = await res.json();
                setNewlyCreatedToken(data.token);
                setNewlyCreatedTokenName(token.name);
                // Update masked token in list
                setApiTokens(prev => prev.map(t =>
                    t.id === token.id
                        ? { ...t, last_used_at: null, masked_token: `${data.token.slice(0, 6)}...${data.token.slice(-4)}` }
                        : t
                ));
                toast.success(`Token "${token.name}" rotated — copy the new value now`);
            } else {
                const d = await res.json();
                toast.error(d.error || "Failed to rotate token");
            }
        } catch {
            toast.error("Failed to rotate token");
        }
        setRotatingTokenId(null);
    };

    const handleDeleteToken = async (id: string) => {
        try {
            const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
            if (res.ok) {
                setApiTokens(apiTokens.filter(t => t.id !== id));
                toast.success("Token revoked");
            }
        } catch {
            toast.error("Failed to revoke token");
        }
    };

    return (
        <div className="space-y-6">
            {/* Top row: Account Info + Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                {/* Combined Username + Email card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center">
                                <AtSign className="h-4 w-4 text-violet-500" />
                            </div>
                            <CardTitle className="text-lg">Account Info</CardTitle>
                        </div>
                        <CardDescription>Update your username and email address.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <div className="flex gap-3">
                                <Input
                                    id="username"
                                    type="text"
                                    placeholder="your_username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="bg-background/50 h-10"
                                />
                                <Button onClick={handleSaveUsername} disabled={savingUsername} className="cursor-pointer px-6">
                                    {savingUsername ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">3–30 chars · letters, numbers, underscores</p>
                        </div>
                        <Separator className="bg-border/20" />
                        <div className="space-y-2">
                            <Label htmlFor="email">Email address</Label>
                            <div className="flex gap-3">
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-background/50 h-10"
                                />
                                <Button onClick={handleSaveEmail} disabled={savingEmail} className="cursor-pointer px-6">
                                    {savingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                                </Button>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Password card */}
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                                <Lock className="h-4 w-4 text-orange-500" />
                            </div>
                            <CardTitle className="text-lg">Change Password</CardTitle>
                        </div>
                        <CardDescription>Ensure your account is using a strong, unique password.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordChange} className="space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="current-password">Current Password</Label>
                                <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="bg-background/50" autoComplete="current-password" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="bg-background/50" autoComplete="new-password" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-background/50" autoComplete="new-password" />
                            </div>
                            <Button type="submit" disabled={changingPassword} className="w-full sm:w-auto px-10 cursor-pointer">
                                {changingPassword ? (
                                    <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Updating…</span>
                                ) : "Update Password"}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>{/* end top grid row */}

            {/* API Tokens — full width */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm">
                <CardHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Key className="h-4 w-4 text-emerald-500" />
                        </div>
                        <CardTitle className="text-lg">API Tokens</CardTitle>
                    </div>
                    <CardDescription>Generate tokens for programmatic access to your bookmarks.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <Label htmlFor="token-name">New Token Name</Label>
                        <div className="flex gap-3">
                            <Input
                                id="token-name"
                                placeholder="e.g. Mobile App, GitHub Action"
                                value={newTokenName}
                                onChange={(e) => setNewTokenName(e.target.value)}
                                className="bg-background/50 h-10"
                            />
                            <Button onClick={handleCreateToken} disabled={isCreatingToken || !newTokenName} className="cursor-pointer px-6">
                                {isCreatingToken ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                            </Button>
                        </div>
                    </div>

                    {newlyCreatedToken && (
                        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3 animate-in zoom-in-95 duration-300">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">
                                    {newlyCreatedTokenName ? `Token: ${newlyCreatedTokenName}` : "Token Created"}
                                </span>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:bg-emerald-500/20" onClick={() => { setNewlyCreatedToken(null); setNewlyCreatedTokenName(null); }}>Dismiss</Button>
                            </div>
                            <p className="text-[11px] text-emerald-400/80">Make sure to copy your token now. You won't be able to see it again!</p>
                            <div className="flex gap-2">
                                <Input readOnly value={newlyCreatedToken} className="font-mono text-xs bg-black/20 border-emerald-500/30" />
                                <Button size="icon" variant="outline" className="shrink-0 border-emerald-500/30 hover:bg-emerald-500/20" onClick={() => copyToClipboard(newlyCreatedToken)}>
                                    {copiedToken === newlyCreatedToken ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                                </Button>
                            </div>
                        </div>
                    )}

                    <Separator className="bg-border/20" />

                    <div className="space-y-3">
                        <h4 className="text-sm font-medium">Active Tokens</h4>
                        {apiTokens.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-4 text-center border border-dashed border-border/40 rounded-xl">No active tokens found.</p>
                        ) : (
                            <div className="space-y-2">
                                {apiTokens.map((token) => (
                                    <div key={token.id} className="flex items-center justify-between p-3 rounded-xl bg-card/60 border border-border/30">
                                        <div className="space-y-1 min-w-0">
                                            <div className="text-sm font-medium">{token.name}</div>
                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{token.masked_token || 'pf_****...****'}</code>
                                                <span className="text-[10px] text-muted-foreground">
                                                    Last used: {token.last_used_at ? new Date(token.last_used_at.endsWith('Z') ? token.last_used_at : token.last_used_at + 'Z').toLocaleDateString(undefined, { timeZone: process.env.TIMEZONE || undefined }) : 'Never'}
                                                </span>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer shrink-0" disabled={rotatingTokenId === token.id}>
                                                    {rotatingTokenId === token.id
                                                        ? <Loader2 className="h-4 w-4 animate-spin" />
                                                        : <MoreHorizontal className="h-4 w-4" />}
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem
                                                    className="cursor-pointer gap-2"
                                                    onClick={() => handleRotateToken(token)}
                                                >
                                                    <RotateCw className="h-4 w-4" /> Rotate Token
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                                                    onClick={() => handleDeleteToken(token.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" /> Delete
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
