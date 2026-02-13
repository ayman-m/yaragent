"use client";

import { useAgents } from "@/components/agent-context";
import { AgentCard } from "@/components/agent-card";

export default function AgentsPage() {
  const { agents, refreshAgents, pushRule, loading, error } = useAgents();

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 md:px-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold md:text-3xl">Agents</h1>
            <p className="mt-1 text-sm text-slate-400">Connectivity, heartbeat, and policy push controls</p>
          </div>
          <button
            onClick={refreshAgents}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            Control plane error: {error}
          </div>
        )}

        {agents.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">{loading ? "Loading agents..." : "No agents registered yet"}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onPushRule={pushRule} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
