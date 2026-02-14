"use client";

import { createContext, useState, useContext, useCallback } from "react";

export interface Agent {
  id: string;
  status: "connected" | "stale" | "disconnected" | "error";
  tenantId: string | null;
  connectedAt: string | null;
  lastSeen: string | null;
  lastHeartbeat: string | null;
  capabilities: Record<string, unknown>;
  isEphemeral: boolean;
  instanceId: string | null;
  runtimeKind: string | null;
  leaseExpiresAt: string | null;
  findingsCount: number;
  assetProfile: Record<string, unknown>;
}

export interface AgentProfile {
  agentId: string;
  tenantId: string;
  connectedAt: string | null;
  lastSeen: string | null;
  lastHeartbeat: string | null;
  assetProfile: Record<string, unknown>;
  sbom: Array<Record<string, unknown>>;
  cves: Array<Record<string, unknown>>;
  findingsCount: number;
}

interface SetupSettings {
  org_name: string;
  environment: string;
  default_rule_namespace: string;
}

interface SetupStatus {
  initialized: boolean;
  setupTokenRequired: boolean;
}

interface AgentContextType {
  agents: Agent[];
  token: string | null;
  refreshAgents: () => Promise<void>;
  pushRule: (agentId: string, ruleText: string) => Promise<any>;
  getAgentProfile: (agentId: string) => Promise<AgentProfile>;
  checkSetupStatus: () => Promise<SetupStatus>;
  setupAdmin: (username: string, password: string, settings: SetupSettings, setupToken?: string) => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  error: string | null;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";
const TOKEN_STORAGE_KEY = "yaragent_access_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

function storeToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    document.cookie = `${TOKEN_STORAGE_KEY}=${token}; Path=/; Secure; SameSite=Lax`;
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    document.cookie = `${TOKEN_STORAGE_KEY}=; Path=/; Max-Age=0; Secure; SameSite=Lax`;
  }
}

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [token, setToken] = useState<string | null>(getStoredToken());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const withAuthHeaders = useCallback(
    (headers: Record<string, string> = {}) => {
      if (!token) return headers;
      return {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    },
    [token]
  );

  const checkSetupStatus = useCallback(async () => {
    const res = await fetch(`${API_BASE}/setup/status`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      initialized: Boolean(data.initialized),
      setupTokenRequired: Boolean(data.setup_token_required),
    };
  }, []);

  const setupAdmin = useCallback(async (username: string, password: string, settings: SetupSettings, setupToken?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          settings,
          setup_token: setupToken || "",
        }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const data = await res.json();
      setToken(data.access_token);
      storeToken(data.access_token);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const data = await res.json();
      setToken(data.access_token);
      storeToken(data.access_token);
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    storeToken(null);
    setAgents([]);
  }, []);

  const refreshAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/agents`, {
        headers: withAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      setAgents(
        data.map((a: any) => ({
          id: a.id,
          status: (a.status || "connected") as Agent["status"],
          tenantId: a.tenant_id || null,
          connectedAt: a.connected_at || null,
          lastSeen: a.last_seen || null,
          lastHeartbeat: a.last_heartbeat || null,
          capabilities: (a.capabilities || {}) as Record<string, unknown>,
          isEphemeral: Boolean(a.is_ephemeral),
          instanceId: a.instance_id || null,
          runtimeKind: a.runtime_kind || null,
          leaseExpiresAt: a.lease_expires_at || null,
          findingsCount: Number(a.findings_count || 0),
          assetProfile: (a.asset_profile || {}) as Record<string, unknown>,
        }))
      );
    } catch (err: any) {
      setError(err.message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [token, withAuthHeaders]);

  const pushRule = useCallback(
    async (agentId: string, ruleText: string) => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      try {
        const res = await fetch(`${API_BASE}/push_rule`, {
          method: "POST",
          headers: withAuthHeaders({ "Content-Type": "application/json" }),
          body: JSON.stringify({ agent_id: agentId, rule_text: ruleText }),
        });
        if (!res.ok) {
          if (res.status === 401) {
            logout();
          }
          throw new Error(`HTTP ${res.status}`);
        }
        return await res.json();
      } catch (err: any) {
        throw new Error(`Failed to push rule: ${err.message}`);
      }
    },
    [token, withAuthHeaders, logout]
  );

  const getAgentProfile = useCallback(
    async (agentId: string): Promise<AgentProfile> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/agents/${encodeURIComponent(agentId)}/profile`, {
        headers: withAuthHeaders(),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        agentId: data.agent_id,
        tenantId: data.tenant_id || "default",
        connectedAt: data.connected_at || null,
        lastSeen: data.last_seen || null,
        lastHeartbeat: data.last_heartbeat || null,
        assetProfile: (data.asset_profile || {}) as Record<string, unknown>,
        sbom: (data.sbom || []) as Array<Record<string, unknown>>,
        cves: (data.cves || []) as Array<Record<string, unknown>>,
        findingsCount: Number(data.findings_count || 0),
      };
    },
    [token, withAuthHeaders]
  );

  return (
    <AgentContext.Provider
      value={{
        agents,
        token,
        refreshAgents,
        pushRule,
        getAgentProfile,
        checkSetupStatus,
        setupAdmin,
        login,
        logout,
        loading,
        error,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgents() {
  const context = useContext(AgentContext);
  if (!context) throw new Error("useAgents must be used within AgentProvider");
  return context;
}
