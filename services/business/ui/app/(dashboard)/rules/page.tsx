"use client";

import { useAgents, YaraRuleFile } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import { CodeBlock } from "@/components/ui/code-block";
import { FloatingDock } from "@/components/ui/floating-dock";
import { MovingBorder } from "@/components/ui/moving-border";
import {
  IconDeviceFloppy,
  IconFilePlus,
  IconCircleCheck,
  IconShieldCheck,
  IconRefresh,
  IconTrash,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { CodeBlockMarker } from "@/components/ui/code-block";

const DEFAULT_TEMPLATE = `rule example_rule {
  meta:
    description = "Example YARA rule"
    author = "yaragent"
  strings:
    $a = "suspicious"
  condition:
    $a
}
`;

type SortField = "name" | "updatedAt" | "size";

export default function RulesPage() {
  const { listYaraRules, getYaraRule, createYaraRule, updateYaraRule, deleteYaraRule, validateYaraRule } = useAgents();
  const [rules, setRules] = useState<YaraRuleFile[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("new_rule.yar");
  const [editorValue, setEditorValue] = useState(DEFAULT_TEMPLATE);
  const [savedValue, setSavedValue] = useState(DEFAULT_TEMPLATE);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [loadingList, setLoadingList] = useState(true);
  const [loadingRule, setLoadingRule] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [validationMarkers, setValidationMarkers] = useState<CodeBlockMarker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = editorValue !== savedValue || (!selectedName && draftName.trim() !== "");

  const loadRules = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const data = await listYaraRules();
      setRules(data);
    } catch (err: any) {
      setError(err.message || "Failed to load rules");
    } finally {
      setLoadingList(false);
    }
  }, [listYaraRules]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  const openRule = useCallback(
    async (name: string) => {
      if (dirty && !confirm("You have unsaved changes. Discard them and open another rule?")) {
        return;
      }
      setLoadingRule(true);
      setError(null);
      setNotice(null);
      try {
        const rule = await getYaraRule(name);
        setSelectedName(rule.name);
        setDraftName(rule.name);
        setEditorValue(rule.content);
        setSavedValue(rule.content);
      } catch (err: any) {
        setError(err.message || "Failed to open rule");
      } finally {
        setLoadingRule(false);
      }
    },
    [getYaraRule, dirty]
  );

  const handleNew = () => {
    if (dirty && !confirm("You have unsaved changes. Discard and create a new rule?")) {
      return;
    }
    setSelectedName(null);
    setDraftName("new_rule.yar");
    setEditorValue(DEFAULT_TEMPLATE);
    setSavedValue("");
    setNotice(null);
    setError(null);
  };

  const handleSave = async () => {
    const name = draftName.trim();
    if (!name) {
      setError("Rule name is required");
      return;
    }
    if (!name.endsWith(".yar")) {
      setError("Rule name must end with .yar");
      return;
    }
    if (!editorValue.trim()) {
      setError("Rule content must not be empty");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = selectedName ? await updateYaraRule(selectedName, editorValue) : await createYaraRule(name, editorValue);
      setSelectedName(response.name);
      setDraftName(response.name);
      setEditorValue(response.content);
      setSavedValue(response.content);
      setNotice(selectedName ? "Rule updated successfully" : "Rule created successfully");
      setValidationMessage("YARA rule compiled successfully");
      setValidationMarkers([]);
      await loadRules();
    } catch (err: any) {
      setError(err.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

  const runValidation = useCallback(
    async (showSuccessMessage: boolean) => {
      const name = draftName.trim() || "rule.yar";
      if (!editorValue.trim()) {
        setValidationMessage("Rule content is empty");
        setValidationMarkers([]);
        return;
      }
      setValidating(true);
      try {
        const result = await validateYaraRule(name, editorValue);
        if (result.valid) {
          setValidationMarkers([]);
          if (showSuccessMessage) {
            setValidationMessage(result.message || "YARA rule compiled successfully");
          } else {
            setValidationMessage(null);
          }
        } else {
          setValidationMarkers(
            result.errors
              .filter((e) => typeof e.line === "number")
              .map((e) => ({
                line: Math.max(1, Number(e.line)),
                message: e.message,
                severity: "error",
              }))
          );
          setValidationMessage(result.errors[0]?.message || result.message || "Validation failed");
        }
      } catch (err: any) {
        setValidationMessage(err.message || "Validation request failed");
        setValidationMarkers([]);
      } finally {
        setValidating(false);
      }
    },
    [draftName, editorValue, validateYaraRule]
  );

  const handleDelete = async () => {
    if (!selectedName) return;
    if (!confirm(`Delete rule "${selectedName}"? This cannot be undone.`)) return;
    setDeleting(true);
    setError(null);
    setNotice(null);
    try {
      await deleteYaraRule(selectedName);
      setNotice(`Deleted ${selectedName}`);
      setSelectedName(null);
      setDraftName("new_rule.yar");
      setEditorValue(DEFAULT_TEMPLATE);
      setSavedValue("");
      await loadRules();
    } catch (err: any) {
      setError(err.message || "Failed to delete rule");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!editorValue.trim()) {
      setValidationMarkers([]);
      setValidationMessage(null);
      return;
    }
    const timer = window.setTimeout(() => {
      runValidation(false);
    }, 700);
    return () => window.clearTimeout(timer);
  }, [editorValue, draftName, runValidation]);

  const filteredRules = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = rules.filter((r) => {
      if (!needle) return true;
      return r.name.toLowerCase().includes(needle) || r.sha256.toLowerCase().includes(needle);
    });
    const sorted = [...base].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") {
        cmp = a.name.localeCompare(b.name);
      } else if (sortField === "size") {
        cmp = a.sizeBytes - b.sizeBytes;
      } else {
        cmp = (Date.parse(a.updatedAt || "") || 0) - (Date.parse(b.updatedAt || "") || 0);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [rules, search, sortField, sortDir]);

  const activeRule = useMemo(() => rules.find((r) => r.name === selectedName) || null, [rules, selectedName]);

  return (
    <>
      <DashboardPageHeader
        title="Rules"
        subtitle="Create, edit, and manage YARA files in MinIO object storage"
        flipSubtitle
        flipWords={["Rules", "Policies", "Editor", "Storage", "Versioning"]}
      />

      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-4 md:p-8">
        {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[320px_1fr]">
          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-200 p-3">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search rules..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value as SortField)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                >
                  <option value="updatedAt">Updated</option>
                  <option value="name">Name</option>
                  <option value="size">Size</option>
                </select>
                <select
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-400 focus:outline-none"
                >
                  <option value="desc">Desc</option>
                  <option value="asc">Asc</option>
                </select>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {loadingList ? (
                <p className="px-2 py-4 text-sm text-slate-500">Loading rules...</p>
              ) : filteredRules.length === 0 ? (
                <p className="px-2 py-4 text-sm text-slate-500">No rules found</p>
              ) : (
                <ul className="space-y-1">
                  {filteredRules.map((rule) => {
                    const active = selectedName === rule.name;
                    return (
                      <li key={rule.name}>
                        <button
                          onClick={() => openRule(rule.name)}
                          className={`w-full rounded-lg border px-3 py-2 text-left transition ${
                            active
                              ? "border-blue-200 bg-blue-50"
                              : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <p className="truncate text-sm font-medium text-slate-800">{rule.name}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{humanSize(rule.sizeBytes)} • {formatTs(rule.updatedAt)}</p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
            <div className="grid gap-3 border-b border-slate-200 p-3 md:grid-cols-[1fr_auto]">
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                placeholder="rule_name.yar"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:border-slate-400 focus:outline-none"
              />
              <div className="text-xs text-slate-500">
                <p>Mode: {selectedName ? "Update existing rule" : "Create new rule"}</p>
                <p>{dirty ? "Unsaved changes" : "Saved"}</p>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <div className="relative overflow-hidden rounded-xl p-[1px]">
                <div className="absolute inset-0">
                  <MovingBorder duration={3500} rx="20%" ry="20%">
                    <div className="h-14 w-14 bg-[radial-gradient(#1A73E8_40%,transparent_60%)] opacity-80" />
                  </MovingBorder>
                </div>
                <div className="relative rounded-xl border border-slate-200 bg-slate-900/95">
                  <CodeBlock
                    language="yara"
                    filename={draftName || "rule.yar"}
                    code={editorValue}
                    editable
                    onChange={setEditorValue}
                    markers={validationMarkers}
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-600">
                {validating ? (
                  <>
                    <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                    Validating...
                  </>
                ) : validationMarkers.length > 0 ? (
                  <>
                    <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
                    {validationMessage || "Validation error"}
                  </>
                ) : validationMessage ? (
                  <>
                    <IconCircleCheck className="h-4 w-4 text-emerald-600" />
                    <span className="text-emerald-700">{validationMessage}</span>
                  </>
                ) : (
                  <span className="text-slate-500">Editor ready</span>
                )}
              </div>
              <FloatingDock
                desktopClassName="mx-0 w-fit bg-slate-100"
                mobileClassName=""
                items={[
                  {
                    title: "Refresh",
                    icon: <IconRefresh className="h-full w-full text-slate-600" />,
                    onClick: loadRules,
                  },
                  {
                    title: "New Rule",
                    icon: <IconFilePlus className="h-full w-full text-slate-600" />,
                    onClick: handleNew,
                  },
                  {
                    title: saving ? "Saving..." : "Save",
                    icon: <IconDeviceFloppy className="h-full w-full text-slate-600" />,
                    onClick: handleSave,
                    disabled: saving || loadingRule,
                  },
                  {
                    title: validating ? "Validating..." : "Validate",
                    icon: <IconShieldCheck className="h-full w-full text-blue-600" />,
                    onClick: () => runValidation(true),
                    disabled: validating,
                  },
                  {
                    title: deleting ? "Deleting..." : "Delete",
                    icon: <IconTrash className="h-full w-full text-rose-600" />,
                    onClick: handleDelete,
                    disabled: !selectedName || deleting,
                  },
                ]}
              />
            </div>

            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <p>Selected: {selectedName || "New file"}</p>
                <p>Length: {editorValue.length} chars</p>
                <p>ETag: {activeRule?.etag || "n/a"}</p>
                <p>SHA256: {activeRule?.sha256 || "n/a"}</p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function formatTs(value: string | null) {
  if (!value) return "n/a";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function humanSize(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}
