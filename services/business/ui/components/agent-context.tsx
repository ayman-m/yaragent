"use client";

import { createContext, useState, useContext, useCallback } from "react";

interface Agent {
  id: string;
  status: "connected" | "disconnected" | "error";
}

interface AgentContextType {
  agents: Agent[];
  refreshAgents: () => Promise<void>;
  pushRule: (agentId: string, ruleText: string) => Promise<any>;
  loading: boolean;
  error: string | null;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshAgents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/agents`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAgents(
        data.map((a: any) => ({
          id: a.id,
          status: "connected" as const,
        }))
      );
    } catch (err: any) {
      setError(err.message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const pushRule = useCallback(
    async (agentId: string, ruleText: string) => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000"}/push_rule`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ agent_id: agentId, rule_text: ruleText }),
          }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err: any) {
        throw new Error(`Failed to push rule: ${err.message}`);
      }
    },
    []
  );

  return (
    <AgentContext.Provider value={{ agents, refreshAgents, pushRule, loading, error }}>
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (!context)
    throw new Error("useAgents must be used within AgentProvider");
  return context;
}
