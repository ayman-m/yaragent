"use client";

import { Agent, useAgents } from "@/components/agent-context";
import { FormEvent, useEffect, useMemo, useState } from "react";

type NavSection = "overview" | "agents" | "telemetry" | "alerts";

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
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [orgName, setOrgName] = useState("YARAgent");
  const [environment, setEnvironment] = useState("production");
  const [defaultRuleNamespace, setDefaultRuleNamespace] = useState("default");
  const [activeSection, setActiveSection] = useState<NavSection>("overview");

  useEffect(() => {
    checkSetupStatus()
      .then((status) => {
        setInitialized(status.initialized);
        setSetupTokenRequired(status.setupTokenRequired);
      })
      .catch(() => {
        setInitialized(false);
        setSetupTokenRequired(false);
      });
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
  const grafanaDashboardUrl =
    process.env.NEXT_PUBLIC_GRAFANA_DASHBOARD_URL || "/grafana/d/yaragent-telemetry-overview?orgId=1&kiosk";

  const connectedCount = useMemo(() => agents.filter((a) => a.status === "connected").length, [agents]);
  const staleCount = useMemo(() => agents.filter((a) => a.status === "stale").length, [agents]);
  const disconnectedCount = useMemo(() => agents.filter((a) => a.status === "disconnected").length, [agents]);

  const navigateToSection = (section: NavSection) => {
    setActiveSection(section);
    const node = document.getElementById(`section-${section}`);
    if (node) {
      node.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSetup = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await setupAdmin(
        username,
        password,
        {
          org_name: orgName,
          environment,
          default_rule_namespace: defaultRuleNamespace,
        },
        setupToken
      );
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
      <Shell title="Initial Setup" subtitle="Create the first administrator account and base settings">
        <AuthForm
          onSubmit={handleSetup}
          username={username}
          setUsername={setUsername}
          password={password}
          setPassword={setPassword}
          setupToken={setupToken}
          setSetupToken={setSetupToken}
          orgName={orgName}
          setOrgName={setOrgName}
          environment={environment}
          setEnvironment={setEnvironment}
          defaultRuleNamespace={defaultRuleNamespace}
          setDefaultRuleNamespace={setDefaultRuleNamespace}
          submitLabel={loading ? "Creating..." : "Create Admin"}
          error={error}
          includeSetupToken={setupTokenRequired}
          includeSettings
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
          orgName={orgName}
          setOrgName={setOrgName}
          environment={environment}
          setEnvironment={setEnvironment}
          defaultRuleNamespace={defaultRuleNamespace}
          setDefaultRuleNamespace={setDefaultRuleNamespace}
          submitLabel={loading ? "Signing In..." : "Sign In"}
          error={error}
        />
      </Shell>
    );
  }

  return (
    <div className="h-screen bg-slate-950 text-slate-100">
      <div className="flex h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900/80 p-4 backdrop-blur md:flex md:flex-col">
          <div className="mb-8 rounded-xl border border-slate-800 bg-slate-900 px-4 py-5">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">YARAgent</p>
            <h2 className="mt-2 text-lg font-semibold">Control Center</h2>
            <p className="mt-1 text-xs text-slate-400">Control plane + telemetry operations</p>
          </div>

          <nav className="space-y-2">
            <SidebarItem
              title="Overview"
              subtitle="Fleet posture"
              active={activeSection === "overview"}
              onClick={() => navigateToSection("overview")}
            />
            <SidebarItem
              title="Agents"
              subtitle="Connectivity and control"
              active={activeSection === "agents"}
              onClick={() => navigateToSection("agents")}
            />
            <SidebarItem
              title="Telemetry"
              subtitle="Logs and observability"
              active={activeSection === "telemetry"}
              onClick={() => navigateToSection("telemetry")}
            />
            <SidebarItem
              title="Alerts"
              subtitle="Finding and error spikes"
              active={activeSection === "alerts"}
              onClick={() => navigateToSection("alerts")}
            />
          </nav>

          <div className="mt-auto rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs uppercase tracking-widest text-slate-500">Session</p>
            <p className="mt-2 text-sm text-slate-300">Authenticated operator</p>
            <button
              onClick={logout}
              className="mt-4 w-full rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
            >
              Sign Out
            </button>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-4 backdrop-blur md:px-8">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-2xl font-bold md:text-3xl">YARA Agent Control</h1>
                <p className="mt-1 text-sm text-slate-400">Manage endpoint state, policy push, and telemetry flow</p>
              </div>
              <div className="md:hidden">
                <button
                  onClick={logout}
                  className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium hover:bg-slate-800"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <div id="section-overview" className="grid scroll-mt-6 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Total Agents" value={agents.length} tone="slate" />
              <MetricCard label="Connected" value={connectedCount} tone="green" />
              <MetricCard label="Stale" value={staleCount} tone="amber" />
              <MetricCard label="Disconnected" value={disconnectedCount} tone="zinc" />
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-900 bg-red-950/60 px-4 py-3 text-sm text-red-200">
                Control plane error: {error}
              </div>
            )}

            <div id="section-agents" className="mt-6 grid scroll-mt-6 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-semibold">Agent Registry</h2>
                    <p className="text-sm text-slate-400">Live control-plane view with heartbeat and capability state</p>
                  </div>
                  <button
                    onClick={refreshAgents}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                  >
                    {loading ? "Refreshing..." : "Refresh"}
                  </button>
                </div>

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
              </section>

              <aside className="space-y-4">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="text-lg font-semibold">Telemetry Plane</h3>
                  <p className="mt-2 text-sm text-slate-400">
                    Embedded full dashboard is loaded from Grafana through nginx (`/grafana`).
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                  <h3 className="text-lg font-semibold">Control Notes</h3>
                  <ul className="mt-3 space-y-2 text-sm text-slate-400">
                    <li>Only connected agents accept policy push.</li>
                    <li>Stale status indicates heartbeat delay.</li>
                    <li>Tenant mismatch is blocked server-side.</li>
                  </ul>
                </div>
              </aside>
            </div>

            <section id="section-telemetry" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">Telemetry Dashboard</h2>
                  <p className="text-sm text-slate-400">Grafana dashboard embedded in-app for operational monitoring.</p>
                </div>
                <a
                  href={grafanaDashboardUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium hover:bg-slate-800"
                >
                  Open in New Tab
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
                <iframe
                  title="YARAgent Grafana Dashboard"
                  src={grafanaDashboardUrl}
                  className="h-[920px] w-full"
                  loading="lazy"
                />
              </div>
            </section>

            <section id="section-alerts" className="mt-6 scroll-mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 md:p-6">
              <h2 className="text-xl font-semibold">Alert Summary</h2>
              <p className="mt-2 text-sm text-slate-400">
                Alerting is fed by Grafana rules. Use the telemetry dashboard to configure thresholds and notification routes.
              </p>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function SidebarItem({
  title,
  subtitle,
  active = false,
  onClick,
}: {
  title: string;
  subtitle: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-3 py-3 text-left transition ${
        active
          ? "border-slate-600 bg-slate-800 text-slate-100"
          : "border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-700 hover:bg-slate-800/80"
      }`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
    </button>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "zinc" | "slate";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-900/70 bg-green-950/40 text-green-200"
      : tone === "amber"
      ? "border-amber-900/70 bg-amber-950/40 text-amber-200"
      : tone === "zinc"
      ? "border-slate-800 bg-slate-900 text-slate-300"
      : "border-blue-900/70 bg-blue-950/40 text-blue-200";
  return (
    <div className={`rounded-xl border px-4 py-4 ${toneClass}`}>
      <p className="text-xs uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-3 text-3xl font-bold">{value}</p>
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
  orgName,
  setOrgName,
  environment,
  setEnvironment,
  defaultRuleNamespace,
  setDefaultRuleNamespace,
  submitLabel,
  error,
  includeSetupToken = false,
  includeSettings = false,
}: {
  onSubmit: (e: FormEvent) => void;
  username: string;
  setUsername: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  setupToken: string;
  setSetupToken: (v: string) => void;
  orgName: string;
  setOrgName: (v: string) => void;
  environment: string;
  setEnvironment: (v: string) => void;
  defaultRuleNamespace: string;
  setDefaultRuleNamespace: (v: string) => void;
  submitLabel: string;
  error: string | null;
  includeSetupToken?: boolean;
  includeSettings?: boolean;
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
      {includeSettings ? (
        <>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Organization Name</label>
            <input
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Environment</label>
            <input
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-slate-300">Default Rule Namespace</label>
            <input
              value={defaultRuleNamespace}
              onChange={(e) => setDefaultRuleNamespace(e.target.value)}
              className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
              required
            />
          </div>
        </>
      ) : null}
      {includeSetupToken ? (
        <div>
          <label className="mb-1 block text-sm text-slate-300">Setup Token</label>
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
  agent: Agent;
  onPushRule: (id: string, rule: string) => Promise<any>;
}) {
  const [rule, setRule] = useState("");
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const statusClass = (() => {
    if (agent.status === "stale") return "bg-amber-900 text-amber-300";
    if (agent.status === "disconnected") return "bg-slate-700 text-slate-300";
    if (agent.status === "error") return "bg-red-900 text-red-300";
    return "bg-green-900 text-green-300";
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
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <div className="mb-4">
        <h3 className="font-mono text-sm text-slate-300">{agent.id}</h3>
        <div className={`mt-2 inline-block rounded-full px-3 py-1 text-xs ${statusClass}`}>{agent.status}</div>
        <div className="mt-3 space-y-1 text-xs text-slate-400">
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
          className="h-32 w-full rounded bg-slate-800 p-2 font-mono text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handlePush}
          disabled={pushing || !rule.trim() || !isPushAllowed}
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
