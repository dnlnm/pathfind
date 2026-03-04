"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

export default function LoginPage() {
    const [mode, setMode] = useState<Mode>("login");
    const [registrationEnabled, setRegistrationEnabled] = useState(true);

    // Login state
    const [loginUsername, setLoginUsername] = useState("");
    const [password, setPassword] = useState("");

    // Register state
    const [regUsername, setRegUsername] = useState("");
    const [regEmail, setRegEmail] = useState("");
    const [regPassword, setRegPassword] = useState("");
    const [regConfirm, setRegConfirm] = useState("");

    const [error, setError] = useState<string | Record<string, string>>("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    useEffect(() => {
        fetch("/api/settings/registration")
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d) setRegistrationEnabled(d.registrationEnabled); })
            .catch(() => { });
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        const result = await signIn("credentials", { username: loginUsername, password, redirect: false });
        if (result?.error) {
            setError("Invalid username or password");
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (!USERNAME_RE.test(regUsername)) {
            setError({ username: "Username must be 3–30 characters: letters, numbers, underscores only" });
            return;
        }
        if (regPassword !== regConfirm) {
            setError({ confirm: "Passwords don't match" });
            return;
        }
        if (regPassword.length < 6) {
            setError({ password: "Password must be at least 6 characters" });
            return;
        }

        setLoading(true);
        const res = await fetch("/api/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username: regUsername, email: regEmail, password: regPassword }),
        });
        const data = await res.json();

        if (!res.ok) {
            setError(data.field ? { [data.field]: data.error } : data.error || "Registration failed");
            setLoading(false);
            return;
        }

        // Auto sign-in after registration — sign in with the new username
        const signInResult = await signIn("credentials", { username: regUsername, password: regPassword, redirect: false });
        if (signInResult?.error) {
            setMode("login");
            setLoginUsername(regUsername);
            setLoading(false);
        } else {
            router.push("/");
            router.refresh();
        }
    };

    const fieldError = (field: string) =>
        typeof error === "object" ? error[field] : undefined;
    const globalError = typeof error === "string" ? error : undefined;

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
            {/* Flickering Grid background */}
            <div className="absolute inset-0 z-0 overflow-hidden">
                <FlickeringGrid
                    className="h-full w-full"
                    squareSize={4}
                    gridGap={6}
                    color="#ffffff"
                    maxOpacity={0.15}
                    flickerChance={0.1}
                />
            </div>

            {/* Gradient glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />

            <Card className="w-full max-w-md relative z-10 border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl">
                <CardHeader className="text-center space-y-4 pb-2">
                    <div className="mx-auto w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10 flex items-center justify-center">
                        <div
                            className="h-7 w-7 bg-primary"
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
                        <CardTitle className="text-2xl font-bold tracking-tight">PathFind</CardTitle>
                        <CardDescription className="text-muted-foreground mt-1">
                            {mode === "login" ? "Sign in to your bookmark manager" : "Create a new account"}
                        </CardDescription>
                    </div>

                    {/* Tab switcher */}
                    {registrationEnabled && (
                        <div className="flex rounded-lg border border-border/40 bg-muted/30 p-0.5">
                            <button
                                type="button"
                                onClick={() => { setMode("login"); setError(""); }}
                                className={cn(
                                    "flex-1 rounded-md py-1.5 text-sm font-medium transition-all cursor-pointer",
                                    mode === "login"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Sign In
                            </button>
                            <button
                                type="button"
                                onClick={() => { setMode("register"); setError(""); }}
                                className={cn(
                                    "flex-1 rounded-md py-1.5 text-sm font-medium transition-all cursor-pointer",
                                    mode === "register"
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Create Account
                            </button>
                        </div>
                    )}
                </CardHeader>

                <CardContent>
                    {/* ── LOGIN ── */}
                    {mode === "login" && (
                        <form onSubmit={handleLogin} className="space-y-4">
                            {globalError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                                    {globalError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="login-username">Username</Label>
                                <Input
                                    id="login-username"
                                    type="text"
                                    placeholder="your_username"
                                    value={loginUsername}
                                    onChange={(e) => setLoginUsername(e.target.value)}
                                    required
                                    className="bg-background/50"
                                    autoComplete="username"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    className="bg-background/50"
                                />
                            </div>
                            <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Signing in…
                                    </span>
                                ) : "Sign In"}
                            </Button>
                        </form>
                    )}

                    {/* ── REGISTER ── */}
                    {mode === "register" && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            {globalError && (
                                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
                                    {globalError}
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label htmlFor="reg-username">Username</Label>
                                <Input
                                    id="reg-username"
                                    type="text"
                                    placeholder="your_username"
                                    value={regUsername}
                                    onChange={(e) => setRegUsername(e.target.value)}
                                    required
                                    className={cn("bg-background/50", fieldError("username") && "border-destructive")}
                                />
                                {fieldError("username") && (
                                    <p className="text-xs text-destructive">{fieldError("username")}</p>
                                )}
                                <p className="text-xs text-muted-foreground">Letters, numbers, and underscores · 3–30 chars</p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-email">Email</Label>
                                <Input
                                    id="reg-email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={regEmail}
                                    onChange={(e) => setRegEmail(e.target.value)}
                                    required
                                    className={cn("bg-background/50", fieldError("email") && "border-destructive")}
                                />
                                {fieldError("email") && (
                                    <p className="text-xs text-destructive">{fieldError("email")}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-password">Password</Label>
                                <Input
                                    id="reg-password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={regPassword}
                                    onChange={(e) => setRegPassword(e.target.value)}
                                    required
                                    className={cn("bg-background/50", fieldError("password") && "border-destructive")}
                                />
                                {fieldError("password") && (
                                    <p className="text-xs text-destructive">{fieldError("password")}</p>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="reg-confirm">Confirm Password</Label>
                                <Input
                                    id="reg-confirm"
                                    type="password"
                                    placeholder="••••••••"
                                    value={regConfirm}
                                    onChange={(e) => setRegConfirm(e.target.value)}
                                    required
                                    className={cn("bg-background/50", fieldError("confirm") && "border-destructive")}
                                />
                                {fieldError("confirm") && (
                                    <p className="text-xs text-destructive">{fieldError("confirm")}</p>
                                )}
                            </div>
                            <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                                {loading ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Creating account…
                                    </span>
                                ) : "Create Account"}
                            </Button>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
