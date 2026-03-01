"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Lock, Key, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface SecurityTabProps {
    email: string;
    setEmail: React.Dispatch<React.SetStateAction<string>>;
    apiTokens: any[];
    setApiTokens: React.Dispatch<React.SetStateAction<any[]>>;
}

export function SecurityTab({ email, setEmail, apiTokens, setApiTokens }: SecurityTabProps) {
    const router = useRouter();
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [changingPassword, setChangingPassword] = useState(false);
    const [savingEmail, setSavingEmail] = useState(false);
    const [newTokenName, setNewTokenName] = useState("");
    const [isCreatingToken, setIsCreatingToken] = useState(false);
    const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);
    const [copiedToken, setCopiedToken] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedToken(text);
        toast.success("Token copied to clipboard");
        setTimeout(() => setCopiedToken(null), 2000);
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

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
        if (newPassword.length < 4) { toast.error("Password must be at least 4 characters"); return; }
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
                setApiTokens([data, ...apiTokens]);
                setNewTokenName("");
                toast.success("API token created");
            }
        } catch {
            toast.error("Failed to create token");
        }
        setIsCreatingToken(false);
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
            {/* Top row: Email + Password side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
                <Card className="border-border/40 bg-card/40 backdrop-blur-sm h-full">
                    <CardHeader>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                                <Mail className="h-4 w-4 text-blue-500" />
                            </div>
                            <CardTitle className="text-lg">Email Address</CardTitle>
                        </div>
                        <CardDescription>Update the email associated with your account.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
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
                                <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required className="bg-background/50" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password">New Password</Label>
                                <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="bg-background/50" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirm-password">Confirm New Password</Label>
                                <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="bg-background/50" />
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
                                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Token Created</span>
                                <Button variant="ghost" size="sm" className="h-7 text-[10px] hover:bg-emerald-500/20" onClick={() => setNewlyCreatedToken(null)}>Dismiss</Button>
                            </div>
                            <p className="text-[11px] text-emerald-400/80">Make sure to copy your personal access token now. You won't be able to see it again!</p>
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
                                        <div className="space-y-1">
                                            <div className="text-sm font-medium">{token.name}</div>
                                            <div className="flex items-center gap-2">
                                                <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{token.masked_token || 'pf_****...****'}</code>
                                                <span className="text-[10px] text-muted-foreground">
                                                    Last used: {token.last_used_at ? new Date(token.last_used_at.endsWith('Z') ? token.last_used_at : token.last_used_at + 'Z').toLocaleDateString(undefined, { timeZone: process.env.NEXT_PUBLIC_APP_TIMEZONE || undefined }) : 'Never'}
                                                </span>
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => handleDeleteToken(token.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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
