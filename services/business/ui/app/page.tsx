"use client";

import { useAgents } from "@/components/agent-context";
import { FormEvent, useEffect, useMemo, useState } from "react";

export default function Page() {
  const {
    agents,
    token,
    refreshAgents,
    pushRule,
    checkSetupStatus,
    setupAdmin,
    login,
    logout,
    loading,
    error,
  } = useAgents();

  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");

  useEffect(() => {
    checkSetupStatus()
      .then(setInitialized)
      .catch(() => setInitialized(false));
  }, [checkSetupStatus]);

  useEffect(() => {
    if (!token) return;
    refreshAgents();
    const interval = setInterval(refreshAgents, 5000);
    return () => clearInterval(interval);
  }, [token, refreshAgents]);

  const mode = useMemo(() => {
    if (initialized === null) return "loading";
    if (!initialized) return "setup";
    if (!token) return "login";
    return "dashboard";
  }, [initialized, token]);

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setupAdmin(username, password, setupToken);
      setInitialized(true);
    } catch {
      // Error state is handled in context.
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
    } catch {
      // Error state is handled in context.
    }
  };

  if (mode === "loading") {
    return <Shell title="Loading">Checking setup status...</Shell>;
  }

  if (mode === "setup") {
    return (
      <Shell title="Initial Setup" subtitle="Create the first administrator account">
        <AuthForm
          onSubmit={handleSetup}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          setupToken={setupToken}
          setSetupToken={setSetupToken}
          submitLabel={loading ? "Creating..." : "Create Admin"}
          error={error}
          includeSetupToken
        />
      </Shell>
    );
  }

  if (mode === "login") {
    return (
      <Shell title="Sign In" subtitle="Authenticate to manage agents">
        <AuthForm
          onSubmit={handleLogin}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          setupToken={setupToken}
          setSetupToken={setSetupToken}
          submitLabel={loading ? "Signing In..." : "Sign In"}
          error={error}
        />
      </Shell>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 px-8 py-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold">YARA Agent Control</h1>
            <p className="mt-2 text-sm text-slate-400">Manage scanning agents and push YARA rules</p>
          </div>
          <button
            onClick={logout}
            className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-8">
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
          {error && <p className="mt-4 text-sm text-red-400">Error: {error}</p>}
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <p className="text-slate-400">{loading ? "Loading agents..." : "No agents connected"}</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} onPushRule={pushRule} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-slate-400">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </div>
  );
}

function AuthForm({
  onSubmit,
  username,
  setUsername,
  password,
  setPassword,
  setupToken,
  setSetupToken,
  submitLabel,
  error,
  includeSetupToken = false,
}: {
  onSubmit: (e: FormEvent) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  setupToken: string;
  setSetupToken: (v: string) => void;
  submitLabel: string;
  error: string | null;
  includeSetupToken?: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-slate-300">Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          required
          minLength={3}
        />
      </div>
      <div>
        <label className="mb-1 block text-sm text-slate-300">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          required
          minLength={8}
        />
      </div>
      {includeSetupToken ? (
        <div>
          <label className="mb-1 block text-sm text-slate-300">Setup Token (optional)</label>
          <input
            type="password"
            value={setupToken}
            onChange={(e) => setSetupToken(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          />
        </div>
      ) : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      <button type="submit" className="w-full rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700">
        {submitLabel}
      </button>
    </form>
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
        <div className="mt-2 inline-block rounded-full bg-green-900 px-3 py-1 text-xs text-green-300">{agent.status}</div>
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
        <div className={`mt-4 rounded p-3 text-sm ${result.error ? "bg-red-900 text-red-100" : "bg-green-900 text-green-100"}`}>
          {result.error || JSON.stringify(result)}
        </div>
      )}
    </div>
  );
}
