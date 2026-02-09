"use client";

import { useAgents } from "@/components/agent-context";
import { useEffect, useState } from "react";

export default function Page() {
  const { agents, refreshAgents, pushRule, loading, error } = useAgents();

  useEffect(() => {
    refreshAgents();
    const interval = setInterval(refreshAgents, 5000);
    return () => clearInterval(interval);
  }, [refreshAgents]);

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900 px-8 py-6">
        <h1 className="text-3xl font-bold">YARA Agent Control</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage scanning agents and push YARA rules
        </p>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {/* Status Bar */}
        <div className="mb-8 rounded-lg bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Connected Agents</p>
              <p className="text-2xl font-bold">{agents.length}</p>
            </div>
            <button
              onClick={refreshAgents}
              disabled={loading}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Refreshing..." : "Refresh"}
            </button>
          </div>
          {error && (
            <p className="mt-4 text-sm text-red-400">Error: {error}</p>
          )}
        </div>

        {/* Agents List */}
        {agents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">
              {loading ? "Loading agents..." : "No agents connected"}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onPushRule={pushRule}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function AgentCard({
  agent,
  onPushRule,
}: {
  agent: any;
  onPushRule: (id: string, rule: string) => Promise<any>;
}) {
  const [rule, setRule] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handlePush = async () => {
    if (!rule.trim()) return;
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
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4">
        <h3 className="font-mono text-sm text-slate-300">{agent.id}</h3>
        <div className="mt-2 inline-block rounded-full bg-green-900 px-3 py-1 text-xs text-green-300">
          {agent.status}
        </div>
      </div>

      <div className="space-y-3">
        <textarea
          value={rule}
          onChange={(e) => setRule(e.target.value)}
          placeholder="rule test { condition: true }"
          className="h-32 w-full rounded bg-slate-800 p-2 font-mono text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handlePush}
          disabled={pushing || !rule.trim()}
          className="w-full rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {pushing ? "Pushing..." : "Push Rule"}
        </button>
      </div>

      {result && (
        <div
          className={`mt-4 rounded p-3 text-sm ${
            result.error
              ? "bg-red-900 text-red-100"
              : "bg-green-900 text-green-100"
          }`}
        >
          {result.error || JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}
