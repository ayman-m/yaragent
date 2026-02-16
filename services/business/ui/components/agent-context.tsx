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

export interface YaraRuleFile {
  name: string;
  tenantId: string;
  objectKey: string;
  etag: string;
  sha256: string;
  sizeBytes: number;
  createdAt: string | null;
  updatedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
}

export interface YaraRuleContent extends YaraRuleFile {
  content: string;
}

export interface YaraValidationError {
  line: number | null;
  message: string;
}

export interface YaraValidationResult {
  valid: boolean;
  message: string;
  errors: YaraValidationError[];
}

export interface YaraAssistantMessage {
  role: "user" | "model";
  content: string;
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
  listYaraRules: () => Promise<YaraRuleFile[]>;
  getYaraRule: (name: string) => Promise<YaraRuleContent>;
  createYaraRule: (name: string, content: string) => Promise<YaraRuleContent>;
  updateYaraRule: (name: string, content: string) => Promise<YaraRuleContent>;
  deleteYaraRule: (name: string) => Promise<void>;
  validateYaraRule: (name: string, content: string) => Promise<YaraValidationResult>;
  askYaraAssistant: (params: {
    ruleName: string;
    ruleContent: string;
    message: string;
    history: YaraAssistantMessage[];
  }) => Promise<string>;
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

function ensureRecordArray(input: unknown): Array<Record<string, unknown>> {
  const normalized = parseMaybeJSON(input);
  if (Array.isArray(normalized)) {
    return normalized.filter((x) => x && typeof x === "object") as Array<Record<string, unknown>>;
  }
  if (normalized && typeof normalized === "object") {
    return [normalized as Record<string, unknown>];
  }
  return [];
}

function ensureRecordObject(input: unknown): Record<string, unknown> {
  const normalized = parseMaybeJSON(input);
  if (normalized && typeof normalized === "object" && !Array.isArray(normalized)) {
    return normalized as Record<string, unknown>;
  }
  return {};
}

function parseMaybeJSON(input: unknown): unknown {
  if (typeof input !== "string") return input;
  const trimmed = input.trim();
  if (!trimmed) return input;
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return input;
  try {
    return JSON.parse(trimmed);
  } catch {
    return input;
  }
}

function mapYaraRuleFile(input: any): YaraRuleFile {
  return {
    name: String(input?.name || ""),
    tenantId: String(input?.tenant_id || input?.tenantId || "default"),
    objectKey: String(input?.object_key || input?.objectKey || ""),
    etag: String(input?.etag || ""),
    sha256: String(input?.sha256 || ""),
    sizeBytes: Number(input?.size_bytes || input?.sizeBytes || 0),
    createdAt: input?.created_at || input?.createdAt || null,
    updatedAt: input?.updated_at || input?.updatedAt || null,
    createdBy: input?.created_by || input?.createdBy || null,
    updatedBy: input?.updated_by || input?.updatedBy || null,
  };
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

  const handleUnauthorized = useCallback(() => {
    logout();
  }, [logout]);

  const refreshAgents = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/agents`, {
        headers: withAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
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
          capabilities: ensureRecordObject(a.capabilities),
          isEphemeral: Boolean(a.is_ephemeral),
          instanceId: a.instance_id || null,
          runtimeKind: a.runtime_kind || null,
          leaseExpiresAt: a.lease_expires_at || null,
          findingsCount: Number(a.findings_count || 0),
          assetProfile: ensureRecordObject(a.asset_profile),
        }))
      );
    } catch (err: any) {
      setError(err.message);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, [token, withAuthHeaders, handleUnauthorized]);

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
        if (res.status === 401) {
          handleUnauthorized();
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      return {
        agentId: data.agent_id,
        tenantId: data.tenant_id || "default",
        connectedAt: data.connected_at || null,
        lastSeen: data.last_seen || null,
        lastHeartbeat: data.last_heartbeat || null,
        assetProfile: ensureRecordObject(data.asset_profile),
        sbom: ensureRecordArray(data.sbom),
        cves: ensureRecordArray(data.cves),
        findingsCount: Number(data.findings_count || 0),
      };
    },
    [token, withAuthHeaders, handleUnauthorized]
  );

  const listYaraRules = useCallback(async (): Promise<YaraRuleFile[]> => {
    if (!token) {
      throw new Error("Not authenticated");
    }
    const res = await fetch(`${API_BASE}/yara/rules`, {
      headers: withAuthHeaders(),
    });
    if (!res.ok) {
      if (res.status === 401) {
        handleUnauthorized();
      }
      const msg = await res.text();
      throw new Error(`HTTP ${res.status} ${msg}`);
    }
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data.map(mapYaraRuleFile);
  }, [token, withAuthHeaders, handleUnauthorized]);

  const getYaraRule = useCallback(
    async (name: string): Promise<YaraRuleContent> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/rules/${encodeURIComponent(name)}`, {
        headers: withAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const data = await res.json();
      return {
        ...mapYaraRuleFile(data),
        content: String(data?.content || ""),
      };
    },
    [token, withAuthHeaders, handleUnauthorized]
  );

  const createYaraRule = useCallback(
    async (name: string, content: string): Promise<YaraRuleContent> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/rules`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, content }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const base = await res.json();
      const full = await getYaraRule(base.name || name);
      return full;
    },
    [token, withAuthHeaders, handleUnauthorized, getYaraRule]
  );

  const updateYaraRule = useCallback(
    async (name: string, content: string): Promise<YaraRuleContent> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/rules/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const base = await res.json();
      const full = await getYaraRule(base.name || name);
      return full;
    },
    [token, withAuthHeaders, handleUnauthorized, getYaraRule]
  );

  const deleteYaraRule = useCallback(
    async (name: string): Promise<void> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/rules/${encodeURIComponent(name)}`, {
        method: "DELETE",
        headers: withAuthHeaders(),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
    },
    [token, withAuthHeaders, handleUnauthorized]
  );

  const validateYaraRule = useCallback(
    async (name: string, content: string): Promise<YaraValidationResult> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/validate`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ name, content }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const data = await res.json();
      return {
        valid: Boolean(data?.valid),
        message: String(data?.message || ""),
        errors: Array.isArray(data?.errors)
          ? data.errors.map((e: any) => ({
              line: typeof e?.line === "number" ? e.line : null,
              message: String(e?.message || "Validation error"),
            }))
          : [],
      };
    },
    [token, withAuthHeaders, handleUnauthorized]
  );

  const askYaraAssistant = useCallback(
    async (params: {
      ruleName: string;
      ruleContent: string;
      message: string;
      history: YaraAssistantMessage[];
    }): Promise<string> => {
      if (!token) {
        throw new Error("Not authenticated");
      }
      const res = await fetch(`${API_BASE}/yara/assistant`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          rule_name: params.ruleName,
          rule_content: params.ruleContent,
          message: params.message,
          history: params.history,
        }),
      });
      if (!res.ok) {
        if (res.status === 401) {
          handleUnauthorized();
        }
        const msg = await res.text();
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      const data = await res.json();
      return String(data?.reply || "");
    },
    [token, withAuthHeaders, handleUnauthorized]
  );

  return (
    <AgentContext.Provider
      value={{
        agents,
        token,
        refreshAgents,
        pushRule,
        getAgentProfile,
        listYaraRules,
        getYaraRule,
        createYaraRule,
        updateYaraRule,
        deleteYaraRule,
        validateYaraRule,
        askYaraAssistant,
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
