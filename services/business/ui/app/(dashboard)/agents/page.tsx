"use client";

import { useAgents } from "@/components/agent-context";
import { AgentCard } from "@/components/agent-card";
import { DashboardPageHeader } from "@/components/dashboard-page-header";

export default function AgentsPage() {
  const { agents, refreshAgents, pushRule, loading, error } = useAgents();

  return (
    <>
      <DashboardPageHeader
        title="Agents"
        subtitle="Connectivity, heartbeat, and policy push controls"
        action={
          <button
            onClick={refreshAgents}
            disabled={loading}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        }
      />

      <main className="flex-1 overflow-y-auto p-4 md:p-8">
        {error && (
          <div className="mb-4 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
            Control plane error: {error}
          </div>
        )}

        {agents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="text-slate-500">{loading ? "Loading agents..." : "No agents registered yet"}</p>
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
