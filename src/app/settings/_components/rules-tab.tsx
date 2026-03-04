"use client";

import { useState } from "react";
import { HexColorPicker } from "react-colorful";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Loader2, Plus, Trash2, Pencil, Zap, ChevronDown, ChevronUp, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Rule, RuleCondition, RuleAction, RuleEvent, ConditionField, ConditionOperator } from "@/types";

// ─── Field / Operator Metadata ───────────────────────────────────────────────

const CONDITION_FIELDS: { value: ConditionField; label: string; group: string }[] = [
    { value: "always_true", label: "Always (match all)", group: "Special" },
    { value: "url", label: "URL", group: "Content" },
    { value: "title", label: "Title", group: "Content" },
    { value: "description", label: "Description", group: "Content" },
    { value: "domain", label: "Domain", group: "Content" },
    { value: "tags", label: "Has Tag", group: "Organization" },
    { value: "collection", label: "In Collection", group: "Organization" },
    { value: "is_archived", label: "Is Archived", group: "Status" },
    { value: "is_read_later", label: "Is Read Later", group: "Status" },
    { value: "is_nsfw", label: "Is NSFW", group: "Status" },
];

// Fields that don't accept a free-text value (use boolean operators or tag/collection selectors)
const NO_VALUE_FIELDS: ConditionField[] = ["always_true", "is_archived", "is_read_later", "is_nsfw"];
const BOOL_FIELDS: ConditionField[] = ["is_archived", "is_read_later", "is_nsfw"];
const RELATIONAL_FIELDS: ConditionField[] = ["tags", "collection"];

type OperatorOption = { value: ConditionOperator; label: string };

function getOperatorsForField(field: ConditionField): OperatorOption[] {
    if (field === "always_true") return [{ value: "is_true", label: "matches all" }];
    if (BOOL_FIELDS.includes(field)) return [
        { value: "is_true", label: "is true" },
        { value: "is_false", label: "is false" },
    ];
    if (RELATIONAL_FIELDS.includes(field)) return [
        { value: "equals", label: "is (exact)" },
        { value: "contains", label: "contains" },
        { value: "not_equals", label: "is not" },
        { value: "not_contains", label: "does not contain" },
    ];
    // String fields
    return [
        { value: "contains", label: "contains" },
        { value: "not_contains", label: "does not contain" },
        { value: "starts_with", label: "starts with" },
        { value: "ends_with", label: "ends with" },
        { value: "equals", label: "equals" },
        { value: "not_equals", label: "does not equal" },
        { value: "matches_regex", label: "matches regex" },
        { value: "is_empty", label: "is empty" },
        { value: "is_not_empty", label: "is not empty" },
    ];
}

function defaultOperatorForField(field: ConditionField): ConditionOperator {
    if (field === "always_true") return "is_true";
    if (BOOL_FIELDS.includes(field)) return "is_true";
    return "contains";
}

// Whether the value input is needed for this field+operator combo
function needsValue(field: ConditionField, operator: ConditionOperator): boolean {
    if (NO_VALUE_FIELDS.includes(field)) return false;
    if (operator === "is_empty" || operator === "is_not_empty") return false;
    return true;
}

// ─── Action Metadata ──────────────────────────────────────────────────────────

const ACTION_OPTIONS = [
    { value: "add_tags", label: "Add Tags", group: "Tags" },
    { value: "remove_tags", label: "Remove Tags", group: "Tags" },
    { value: "add_to_collection", label: "Add to Collection", group: "Collections" },
    { value: "remove_from_collection", label: "Remove from Collection", group: "Collections" },
    { value: "mark_read_later", label: "Mark as Read Later", group: "Status" },
    { value: "unmark_read_later", label: "Unmark Read Later", group: "Status" },
    { value: "mark_archived", label: "Archive", group: "Status" },
    { value: "unmark_archived", label: "Unarchive", group: "Status" },
    { value: "mark_nsfw", label: "Mark as NSFW", group: "Status" },
    { value: "unmark_nsfw", label: "Unmark NSFW", group: "Status" },
];

// ─── Summary helpers ──────────────────────────────────────────────────────────

function getConditionSummary(c: RuleCondition): string {
    const fieldLabel = CONDITION_FIELDS.find(f => f.value === c.field)?.label ?? c.field;
    if (c.field === "always_true") return "Always applies";
    if (BOOL_FIELDS.includes(c.field as ConditionField)) {
        return `${fieldLabel} ${c.operator === "is_true" ? "is true" : "is false"}`;
    }
    const opLabel = getOperatorsForField(c.field as ConditionField).find(o => o.value === c.operator)?.label ?? c.operator;
    if (c.operator === "is_empty" || c.operator === "is_not_empty") return `${fieldLabel} ${opLabel}`;
    return `${fieldLabel} ${opLabel} "${c.value}"`;
}

function getActionSummary(action: RuleAction): string {
    switch (action.type) {
        case "add_tags": return `Add tags: ${(action.params?.tags || []).join(", ")}`;
        case "remove_tags": return `Remove tags: ${(action.params?.tags || []).join(", ")}`;
        case "add_to_collection": return `Add to collection: ${action.params?.collectionName || ""}`;
        case "remove_from_collection": return `Remove from collection: ${action.params?.collectionName || ""}`;
        case "mark_read_later": return "Mark as Read Later";
        case "unmark_read_later": return "Unmark Read Later";
        case "mark_archived": return "Archive bookmark";
        case "unmark_archived": return "Unarchive bookmark";
        case "mark_nsfw": return "Mark as NSFW";
        case "unmark_nsfw": return "Unmark NSFW";
        default: return (action as any).type;
    }
}

// ─── Color Picker Popover ────────────────────────────────────────────────────

function ColorPickerPopover({
    color,
    onChange,
    open,
    onOpenChange,
}: {
    color: string;
    onChange: (c: string) => void;
    open: boolean;
    onOpenChange: (o: boolean) => void;
}) {
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="flex items-center gap-2.5 h-10 px-3 rounded-md border border-border/50 bg-background/50 hover:bg-background/80 hover:border-border transition-colors cursor-pointer shrink-0"
                >
                    <span
                        className="w-5 h-5 rounded-full border border-white/10 shadow-sm shrink-0 transition-colors"
                        style={{ backgroundColor: color }}
                    />
                    <code className="text-[11px] font-mono uppercase text-muted-foreground">{color}</code>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-3" align="start">
                {/* react-colorful canvas picker */}
                <HexColorPicker color={color} onChange={onChange} style={{ width: "100%" }} />
                <Separator className="bg-border/30" />
                {/* Hex input */}
                <div className="flex items-center gap-2">
                    <span
                        className="w-7 h-7 rounded-md shrink-0 border border-white/10"
                        style={{ backgroundColor: color }}
                    />
                    <Input
                        value={color}
                        onChange={(e) => {
                            const val = e.target.value;
                            const cleaned = val.startsWith("#") ? val : `#${val}`;
                            onChange(cleaned);
                        }}
                        className="h-7 text-xs font-mono bg-background/50 flex-1"
                        placeholder="#6366f1"
                        maxLength={7}
                    />
                </div>
            </PopoverContent>
        </Popover>
    );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface RulesTabProps {
    rules: Rule[];
    setRules: React.Dispatch<React.SetStateAction<Rule[]>>;
    existingTags: { id: string; name: string }[];
    existingCollections: { id: string; name: string }[];
    domainColors: { domain: string; color: string }[];
    setDomainColors: React.Dispatch<React.SetStateAction<{ domain: string; color: string }[]>>;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RulesTab({ rules, setRules, existingTags, existingCollections, domainColors, setDomainColors }: RulesTabProps) {
    const [showRuleForm, setShowRuleForm] = useState(false);
    const [ruleName, setRuleName] = useState("");
    const [ruleEvent, setRuleEvent] = useState<RuleEvent>("bookmark.created");
    const [ruleConditionLogic, setRuleConditionLogic] = useState<"AND" | "OR">("AND");
    const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([{ field: "url", operator: "contains", value: "" }]);
    const [ruleActions, setRuleActions] = useState<RuleAction[]>([{ type: "add_tags", params: { tags: [""] } }]);
    const [savingRule, setSavingRule] = useState(false);
    const [expandedRuleId, setExpandedRuleId] = useState<string | null>(null);
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<Rule | null>(null);

    // Visual Rules (Domain Colors) State
    const [newDomain, setNewDomain] = useState("");
    const [newColor, setNewColor] = useState("#6366f1");
    const [addingColor, setAddingColor] = useState(false);
    const [colorPickerOpen, setColorPickerOpen] = useState(false);

    const handleAddDomainColor = async () => {
        if (!newDomain) return;
        setAddingColor(true);
        try {
            const res = await fetch("/api/settings/domain-colors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain: newDomain, color: newColor }),
            });
            if (res.ok) {
                toast.success(`Color set for ${newDomain}`);
                const updated = await fetch("/api/settings/domain-colors").then(r => r.json());
                setDomainColors(updated);
                setNewDomain("");
            }
        } catch { toast.error("Failed to add domain color"); }
        setAddingColor(false);
    };

    const handleDeleteDomainColor = async (domain: string) => {
        try {
            const res = await fetch("/api/settings/domain-colors", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain }),
            });
            if (res.ok) {
                setDomainColors(prev => prev.filter(dc => dc.domain !== domain));
                toast.success(`Removed color for ${domain}`);
            }
        } catch { toast.error("Failed to delete domain color"); }
    };

    const resetForm = () => {
        setRuleName("");
        setRuleConditions([{ field: "url", operator: "contains", value: "" }]);
        setRuleActions([{ type: "add_tags", params: { tags: [""] } }]);
        setEditingRuleId(null);
        setShowRuleForm(false);
    };

    const updateCondition = (idx: number, patch: Partial<RuleCondition>) => {
        setRuleConditions(prev => prev.map((c, i) => {
            if (i !== idx) return c;
            const next = { ...c, ...patch };
            // When field changes, reset operator to a valid one for the new field
            if (patch.field !== undefined && patch.field !== c.field) {
                next.operator = defaultOperatorForField(patch.field as ConditionField);
                next.value = "";
            }
            return next;
        }));
    };

    const updateAction = (idx: number, patch: Partial<RuleAction>) => {
        setRuleActions(prev => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
    };

    const handleOpenEditRule = (rule: Rule) => {
        setRuleName(rule.name);
        setRuleEvent(rule.event);
        setRuleConditionLogic(rule.conditionLogic);
        setRuleConditions([...rule.conditions]);
        setRuleActions([...rule.actions]);
        setEditingRuleId(rule.id);
        setShowRuleForm(true);
    };

    const handleToggleRule = async (ruleId: string, enabled: boolean) => {
        setRules(prev => prev.map(r => r.id === ruleId ? { ...r, enabled } : r));
        try {
            await fetch(`/api/rules/${ruleId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
        } catch { toast.error("Failed to toggle rule"); }
    };

    const handleDeleteRule = async () => {
        if (!ruleToDelete) return;
        try {
            const res = await fetch(`/api/rules/${ruleToDelete.id}`, { method: "DELETE" });
            if (res.ok) { setRules(prev => prev.filter(r => r.id !== ruleToDelete.id)); toast.success("Rule deleted"); setRuleToDelete(null); }
        } catch { toast.error("Failed to delete rule"); }
    };

    const handleSaveRule = async () => {
        if (!ruleName.trim()) { toast.error("Rule name is required"); return; }

        // Validate conditions
        for (const c of ruleConditions) {
            if (needsValue(c.field as ConditionField, c.operator as ConditionOperator) && !c.value.trim()) {
                toast.error("All condition values are required");
                return;
            }
        }
        // Validate actions
        for (const a of ruleActions) {
            if ((a.type === "add_tags" || a.type === "remove_tags") && (!a.params?.tags?.length || a.params.tags.some((t: string) => !t.trim()))) {
                toast.error("All tag values are required");
                return;
            }
            if ((a.type === "add_to_collection" || a.type === "remove_from_collection") && !a.params?.collectionName?.trim()) {
                toast.error("Collection name is required");
                return;
            }
        }

        setSavingRule(true);
        try {
            const url = editingRuleId ? `/api/rules/${editingRuleId}` : "/api/rules";
            const method = editingRuleId ? "PUT" : "POST";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: ruleName.trim(), event: ruleEvent, conditionLogic: ruleConditionLogic, conditions: ruleConditions, actions: ruleActions }),
            });
            if (res.ok) {
                const rule = await res.json();
                if (editingRuleId) { setRules(prev => prev.map(r => r.id === editingRuleId ? rule : r)); toast.success("Rule updated"); }
                else { setRules(prev => [...prev, rule]); toast.success("Rule created"); }
                resetForm();
            } else { const data = await res.json(); toast.error(data.error || "Failed to save rule"); }
        } catch { toast.error("Failed to save rule"); }
        setSavingRule(false);
    };

    return (
        <div className="space-y-6">
            {/* Visual Rules Card */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Zap className="h-4 w-4 text-emerald-500" />Visual Rules
                    </CardTitle>
                    <CardDescription>Assign specific accent colors to domains for visual grouping in your feed.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-2">
                            <Input
                                placeholder="example.com"
                                value={newDomain}
                                onChange={(e) => setNewDomain(e.target.value)}
                                className="bg-background/50 text-sm flex-1"
                            />
                            <ColorPickerPopover
                                color={newColor}
                                onChange={setNewColor}
                                open={colorPickerOpen}
                                onOpenChange={setColorPickerOpen}
                            />
                            <Button
                                onClick={handleAddDomainColor}
                                disabled={addingColor || !newDomain}
                                className="cursor-pointer shrink-0 w-full sm:w-auto"
                            >
                                {addingColor ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                Add Rule
                            </Button>
                        </div>

                        {domainColors?.length > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border border-border/20 rounded-xl p-3 bg-muted/10">
                                {domainColors.map((dc) => (
                                    <div key={dc.domain} className="flex items-center justify-between p-2.5 rounded-lg bg-card/60 border border-border/30 hover:border-border transition-colors group">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="w-3.5 h-3.5 rounded-full border border-white/10 shadow-sm shrink-0"
                                                style={{ backgroundColor: dc.color }}
                                            />
                                            <span className="text-sm font-medium tracking-tight truncate">{dc.domain}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDeleteDomainColor(dc.domain)}
                                            className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Automation Rules Card */}
            <Card className="border-border/40 bg-card/40 backdrop-blur-sm shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />Automation Rules
                        </CardTitle>
                        <CardDescription>Rules automatically run when bookmarks are created or updated.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingRuleId(null); setRuleName(""); setRuleConditions([{ field: "url", operator: "contains", value: "" }]); setRuleActions([{ type: "add_tags", params: { tags: [""] } }]); setShowRuleForm(true); }} size="sm" className="cursor-pointer gap-1.5">
                        <Plus className="h-4 w-4" />Add Rule
                    </Button>
                </CardHeader>
                <CardContent>
                    {rules.length === 0 && !showRuleForm ? (
                        <div className="py-8 text-center border border-dashed border-border/40 rounded-2xl bg-muted/5">
                            <Zap className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                            <p className="text-sm text-muted-foreground">No rules configured yet.</p>
                            <p className="text-xs text-muted-foreground mt-1">Create a rule to automate tagging, collections, and more.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rules.map((rule) => (
                                <div key={rule.id} className="rounded-xl border border-border/30 bg-card/60 overflow-hidden transition-colors hover:border-border/50">
                                    <div className="flex items-center justify-between p-3.5">
                                        <button className="flex items-center gap-3 min-w-0 flex-1 text-left cursor-pointer" onClick={() => setExpandedRuleId(expandedRuleId === rule.id ? null : rule.id)}>
                                            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors", rule.enabled ? "bg-primary/10" : "bg-muted/40")}>
                                                <Zap className={cn("h-4 w-4", rule.enabled ? "text-primary" : "text-muted-foreground")} />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-sm font-medium truncate">{rule.name}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {rule.event === "bookmark.created" ? "On bookmark created" : "On bookmark updated"}
                                                    {" · "}{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""}
                                                    {" · "}{rule.actions.length} action{rule.actions.length !== 1 ? "s" : ""}
                                                </p>
                                            </div>
                                            {expandedRuleId === rule.id ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                                        </button>
                                        <div className="flex items-center gap-2 ml-3 shrink-0">
                                            <Switch checked={rule.enabled} onCheckedChange={(checked) => handleToggleRule(rule.id, checked)} />
                                            <Button variant="ghost" size="sm" onClick={() => handleOpenEditRule(rule)} className="h-8 w-8 p-0 text-muted-foreground hover:text-primary hover:bg-primary/10 cursor-pointer"><Pencil className="h-4 w-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => setRuleToDelete(rule)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"><Trash2 className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    {expandedRuleId === rule.id && (
                                        <div className="px-3.5 pb-3.5 pt-0 space-y-2 border-t border-border/20">
                                            <div className="pt-3 space-y-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conditions ({rule.conditionLogic})</p>
                                                {rule.conditions.map((c, i) => (
                                                    <div key={i} className="text-xs text-muted-foreground bg-muted/20 rounded-lg px-3 py-1.5">
                                                        {getConditionSummary(c)}
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="space-y-1.5">
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
                                                {rule.actions.map((a, i) => (
                                                    <div key={i} className="text-xs bg-primary/5 text-primary rounded-lg px-3 py-1.5">{getActionSummary(a)}</div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Delete Confirm */}
            <AlertDialog open={!!ruleToDelete} onOpenChange={(open) => !open && setRuleToDelete(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Rule</AlertDialogTitle>
                        <AlertDialogDescription>Are you sure you want to delete <span className="font-semibold text-foreground">"{ruleToDelete?.name}"</span>? This action cannot be undone.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteRule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Add/Edit Dialog */}
            <Dialog open={showRuleForm} onOpenChange={(open) => { if (!open) resetForm(); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingRuleId ? "Edit Rule" : "New Rule"}</DialogTitle>
                        <DialogDescription>{editingRuleId ? "Update your rule configuration." : "Define when and what should happen automatically."}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {/* Name */}
                        <div className="space-y-2">
                            <Label>Rule Name</Label>
                            <Input placeholder="e.g. GitHub Auto-Tag" value={ruleName} onChange={(e) => setRuleName(e.target.value)} className="bg-background/50" />
                        </div>

                        {/* Trigger Event */}
                        <div className="space-y-2">
                            <Label>Trigger Event</Label>
                            <Select value={ruleEvent} onValueChange={(v) => setRuleEvent(v as RuleEvent)}>
                                <SelectTrigger className="bg-background/50"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="bookmark.created">Bookmark Created</SelectItem>
                                    <SelectItem value="bookmark.updated">Bookmark Updated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator className="bg-border/30" />

                        {/* Conditions */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <Label>Conditions</Label>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground uppercase">Match</span>
                                    <Button variant={ruleConditionLogic === "AND" ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-2 cursor-pointer" onClick={() => setRuleConditionLogic("AND")}>ALL</Button>
                                    <Button variant={ruleConditionLogic === "OR" ? "default" : "outline"} size="sm" className="h-6 text-[10px] px-2 cursor-pointer" onClick={() => setRuleConditionLogic("OR")}>ANY</Button>
                                </div>
                            </div>

                            {ruleConditions.map((cond, idx) => {
                                const ops = getOperatorsForField(cond.field as ConditionField);
                                const showValue = needsValue(cond.field as ConditionField, cond.operator as ConditionOperator);
                                const isTagField = cond.field === "tags";
                                const isCollField = cond.field === "collection";

                                return (
                                    <div key={idx} className="flex items-center gap-2 flex-wrap">
                                        {/* Field */}
                                        <Select value={cond.field} onValueChange={(v) => updateCondition(idx, { field: v as any })}>
                                            <SelectTrigger className="w-[150px] bg-background/50 h-9 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {CONDITION_FIELDS.map(f => (
                                                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>

                                        {/* Operator — hidden for always_true */}
                                        {cond.field !== "always_true" && (
                                            <Select value={cond.operator} onValueChange={(v) => updateCondition(idx, { operator: v as any })}>
                                                <SelectTrigger className="w-[145px] bg-background/50 h-9 text-xs"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {ops.map(op => (
                                                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {/* Value input — context-aware */}
                                        {showValue && (
                                            isTagField ? (
                                                <Input
                                                    placeholder="tag name..."
                                                    value={cond.value}
                                                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                                    list="existing-tags"
                                                    className="flex-1 bg-background/50 h-9 text-xs"
                                                />
                                            ) : isCollField ? (
                                                <Input
                                                    placeholder="collection name..."
                                                    value={cond.value}
                                                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                                    list="existing-collections"
                                                    className="flex-1 bg-background/50 h-9 text-xs"
                                                />
                                            ) : (
                                                <Input
                                                    placeholder="Value..."
                                                    value={cond.value}
                                                    onChange={(e) => updateCondition(idx, { value: e.target.value })}
                                                    className="flex-1 bg-background/50 h-9 text-xs"
                                                />
                                            )
                                        )}

                                        {ruleConditions.length > 1 && (
                                            <Button variant="ghost" size="sm" onClick={() => setRuleConditions(prev => prev.filter((_, i) => i !== idx))} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0"><X className="h-3.5 w-3.5" /></Button>
                                        )}
                                    </div>
                                );
                            })}

                            <Button variant="outline" size="sm" onClick={() => setRuleConditions(prev => [...prev, { field: "url", operator: "contains", value: "" }])} className="text-xs cursor-pointer gap-1">
                                <Plus className="h-3 w-3" /> Add Condition
                            </Button>
                        </div>

                        <Separator className="bg-border/30" />

                        {/* Actions */}
                        <div className="space-y-3">
                            <Label>Actions</Label>
                            {ruleActions.map((action, idx) => (
                                <div key={idx} className="space-y-2 p-3 rounded-lg border border-border/30 bg-muted/10">
                                    <div className="flex items-center gap-2">
                                        <Select value={action.type} onValueChange={(v) => {
                                            const newAction: RuleAction = { type: v as any, params: {} };
                                            if (v === "add_tags" || v === "remove_tags") newAction.params = { tags: [""] };
                                            if (v === "add_to_collection" || v === "remove_from_collection") newAction.params = { collectionName: "" };
                                            updateAction(idx, newAction);
                                        }}>
                                            <SelectTrigger className="w-[210px] bg-background/50 h-9 text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                {ACTION_OPTIONS.map(a => (
                                                    <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {ruleActions.length > 1 && (
                                            <Button variant="ghost" size="sm" onClick={() => setRuleActions(prev => prev.filter((_, i) => i !== idx))} className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive cursor-pointer shrink-0 ml-auto"><X className="h-3.5 w-3.5" /></Button>
                                        )}
                                    </div>

                                    {/* Tag list input */}
                                    {(action.type === "add_tags" || action.type === "remove_tags") && (
                                        <div className="space-y-2">
                                            {(action.params?.tags || [""]).map((tag: string, tIdx: number) => (
                                                <div key={tIdx} className="flex items-center gap-2">
                                                    <Input
                                                        placeholder="Tag name..."
                                                        value={tag}
                                                        list="existing-tags"
                                                        onChange={(e) => { const newTags = [...(action.params?.tags || [""])]; newTags[tIdx] = e.target.value; updateAction(idx, { params: { tags: newTags } }); }}
                                                        className="flex-1 bg-background/50 h-8 text-xs"
                                                    />
                                                    {(action.params?.tags || []).length > 1 && (
                                                        <Button variant="ghost" size="sm" onClick={() => { const newTags = (action.params?.tags || []).filter((_: string, i: number) => i !== tIdx); updateAction(idx, { params: { tags: newTags } }); }} className="h-8 w-8 p-0 text-muted-foreground cursor-pointer"><X className="h-3 w-3" /></Button>
                                                    )}
                                                </div>
                                            ))}
                                            <Button variant="ghost" size="sm" onClick={() => { const newTags = [...(action.params?.tags || [""]), ""]; updateAction(idx, { params: { tags: newTags } }); }} className="text-[10px] h-7 cursor-pointer gap-1">
                                                <Plus className="h-3 w-3" /> Add Tag
                                            </Button>
                                        </div>
                                    )}

                                    {/* Collection name input */}
                                    {(action.type === "add_to_collection" || action.type === "remove_from_collection") && (
                                        <Input
                                            placeholder="Collection name..."
                                            value={action.params?.collectionName || ""}
                                            list="existing-collections"
                                            onChange={(e) => updateAction(idx, { params: { collectionName: e.target.value } })}
                                            className="bg-background/50 h-8 text-xs"
                                        />
                                    )}
                                </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => setRuleActions(prev => [...prev, { type: "add_tags", params: { tags: [""] } }])} className="text-xs cursor-pointer gap-1">
                                <Plus className="h-3 w-3" /> Add Action
                            </Button>
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button variant="outline" onClick={resetForm} className="h-11 cursor-pointer">Cancel</Button>
                        <Button onClick={handleSaveRule} disabled={savingRule} className="h-11 px-8 cursor-pointer font-medium gap-2">
                            {savingRule ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                            {editingRuleId ? "Update Rule" : "Create Rule"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <datalist id="existing-tags">
                {[...new Set(existingTags.map(t => t.name))].map(name => <option key={name} value={name} />)}
            </datalist>
            <datalist id="existing-collections">
                {[...new Set(existingCollections.map(c => c.name))].map(name => <option key={name} value={name} />)}
            </datalist>
        </div>
    );
}
