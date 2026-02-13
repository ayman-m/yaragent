"use client";

import { useAgents } from "@/components/agent-context";
import { WavyBackground } from "@/components/ui/wavy-background";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const { checkSetupStatus, setupAdmin, login, loading, error, token } = useAgents();
  const router = useRouter();

  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [setupTokenRequired, setSetupTokenRequired] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [orgName, setOrgName] = useState("YARAgent");
  const [environment, setEnvironment] = useState("production");
  const [defaultRuleNamespace, setDefaultRuleNamespace] = useState("default");

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
    if (token) {
      router.replace("/overview");
    }
  }, [token, router]);

  const mode = useMemo(() => {
    if (initialized === null) return "loading";
    if (!initialized) return "setup";
    return "login";
  }, [initialized]);

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
      router.replace("/overview");
    } catch {
      // Error displayed from context.
    }
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      router.replace("/overview");
    } catch {
      // Error displayed from context.
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

function Shell({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <WavyBackground
      containerClassName="h-full min-h-screen w-full"
      className="flex h-full items-center justify-center px-4 py-8 text-slate-100"
      colors={["#2563eb", "#0ea5e9", "#14b8a6", "#1d4ed8"]}
      backgroundFill="#020617"
      blur={14}
      speed="slow"
      waveOpacity={0.25}
      waveWidth={42}
    >
      <div className="w-full max-w-md rounded-xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.55)] backdrop-blur">
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-slate-300">{subtitle}</p> : null}
        {children ? <div className="mt-6">{children}</div> : null}
      </div>
    </WavyBackground>
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
