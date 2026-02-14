"use client";

import { Agent } from "@/components/agent-context";
import { useState } from "react";

export function AgentCard({
  agent,
  onPushRule,
}: {
  agent: Agent;
  onPushRule: (id: string, rule: string) => Promise<any>;
}) {
  const [rule, setRule] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const statusClass = (() => {
    if (agent.status === "stale") return "bg-amber-100 text-amber-700";
    if (agent.status === "disconnected") return "bg-slate-100 text-slate-700";
    if (agent.status === "error") return "bg-red-100 text-red-700";
    return "bg-green-100 text-green-700";
  })();

  const isPushAllowed = agent.status === "connected";

  const formatTs = (value: string | null) => {
    if (!value) return "n/a";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const handlePush = async () => {
    if (!rule.trim() || !isPushAllowed) return;
    setPushing(true);
    try {
      const res = await onPushRule(agent.id, rule);
      setResult(res);
    } catch (err: any) {
      setResult({ error: err.message });
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="font-mono text-sm text-slate-700">{agent.id}</h3>
        <div className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${statusClass}`}>{agent.status}</div>
        <div className="mt-3 space-y-1 text-xs text-slate-500">
          <p>Tenant: {agent.tenantId || "default"}</p>
          <p>Connected: {formatTs(agent.connectedAt)}</p>
          <p>Last Seen: {formatTs(agent.lastSeen)}</p>
          <p>Last Heartbeat: {formatTs(agent.lastHeartbeat)}</p>
          <p className="break-all">Capabilities: {Object.keys(agent.capabilities || {}).join(", ") || "none"}</p>
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder="rule test { condition: true }"
          className="h-32 w-full rounded border border-slate-200 bg-slate-50 p-2 font-mono text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
        />
        <button
          onClick={handlePush}
          disabled={pushing || !rule.trim() || !isPushAllowed}
          className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {pushing ? "Pushing..." : "Push Rule"}
        </button>
      </div>

      {result && (
        <div className={`mt-4 rounded p-3 text-sm ${result.error ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
          {result.error || JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}
