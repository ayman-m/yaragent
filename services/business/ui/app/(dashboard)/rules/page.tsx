"use client";

import { useAgents, YaraRuleFile } from "@/components/agent-context";
import { DashboardPageHeader } from "@/components/dashboard-page-header";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
});

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
  const { listYaraRules, getYaraRule, createYaraRule, updateYaraRule, deleteYaraRule } = useAgents();
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
      await loadRules();
    } catch (err: any) {
      setError(err.message || "Failed to save rule");
    } finally {
      setSaving(false);
    }
  };

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
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={loadRules}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            <button onClick={handleNew} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              New Rule
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loadingRule}
              className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleDelete}
              disabled={!selectedName || deleting}
              className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </div>
        }
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

          <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
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
              <MonacoEditor
                height="100%"
                defaultLanguage="cpp"
                language="cpp"
                value={editorValue}
                onChange={(value) => setEditorValue(value || "")}
                theme="vs"
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  wordWrap: "on",
                  scrollBeyondLastLine: false,
                  lineNumbersMinChars: 3,
                  automaticLayout: true,
                }}
              />
            </div>

            <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
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

