"use client";

import { useAgents } from "@/components/agent-context";
import { LoaderThree } from "@/components/ui/loader";
import { ToolsStackCard } from "@/components/ui/tools-stack-card";
import { WavyBackground } from "@/components/ui/wavy-background";
import { motion } from "motion/react";
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
    return (
      <Shell title="Loading">
        <div className="flex flex-col items-center gap-3 py-4">
          <LoaderThree />
          <p className="text-sm text-slate-300">Checking setup status...</p>
        </div>
      </Shell>
    );
  }

  if (mode === "setup") {
    return (
      <Shell title="Initial Setup">
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
    <Shell title="Sign In" showToolsCard>
      <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <div>
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
        </div>

        <div className="relative hidden h-52 w-px overflow-hidden md:block">
          <motion.div
            className="absolute inset-x-0 h-20 bg-gradient-to-b from-transparent via-cyan-300/90 to-transparent"
            animate={{ y: ["-35%", "120%"], opacity: [0, 1, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-0 bg-slate-600/30" />
        </div>

        <div className="md:pl-2 md:pt-1">
          <p className="text-lg font-semibold text-slate-200">
            Powered by{" "}
            <FlippingText
              words={["Next.js", "Grafana", "Gemini", "GraphQL", "Loki", "Keycloak", "MCP"]}
              className="text-cyan-300"
            />
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Unified control plane and telemetry for endpoint operations.
            <br />
            Secure workflows and real-time policy distribution.
            <br />
            Deep observability across control and telemetry planes.
            <br />
            Built for resilient operations at enterprise scale.
          </p>
        </div>
      </div>
    </Shell>
  );
}

function FlippingText({
  words,
  className,
}: {
  words: string[];
  className?: string;
}) {
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const currentWord = words[currentWordIndex];

  useEffect(() => {
    const typingSpeed = 45;
    const deletingSpeed = 45;
    const pauseBeforeDelete = 900;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    if (!isDeleting && visibleCharacters < currentWord.length) {
      timeout = setTimeout(() => setVisibleCharacters((prev) => prev + 1), typingSpeed);
    } else if (!isDeleting && visibleCharacters === currentWord.length) {
      timeout = setTimeout(() => setIsDeleting(true), pauseBeforeDelete);
    } else if (isDeleting && visibleCharacters > 0) {
      timeout = setTimeout(() => setVisibleCharacters((prev) => prev - 1), deletingSpeed);
    } else if (isDeleting && visibleCharacters === 0) {
      setIsDeleting(false);
      setCurrentWordIndex((prev) => (prev + 1) % words.length);
    }

    return () => {
      if (timeout) clearTimeout(timeout);
    };
  }, [currentWord, isDeleting, visibleCharacters, words.length]);

  return (
    <span className={className}>
      {currentWord
        .substring(0, visibleCharacters)
        .split("")
        .map((char, index) => (
          <motion.span
            key={`${index}-${char}`}
            initial={{ opacity: 0, rotateY: 90, y: 8, filter: "blur(8px)" }}
            animate={{ opacity: 1, rotateY: 0, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.25 }}
            className="inline-block"
          >
            {char}
          </motion.span>
        ))}
      <motion.span
        className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
        animate={{
          opacity: [1, 0.25, 1],
          backgroundColor: isDeleting ? "#ef4444" : "#60a5fa",
        }}
        transition={{ duration: 0.7, repeat: Infinity }}
      />
    </span>
  );
}

function Shell({
  title,
  children,
  showToolsCard = false,
}: {
  title: string;
  children?: React.ReactNode;
  showToolsCard?: boolean;
}) {
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
      <div className="w-full max-w-2xl space-y-4">
        <div className="rounded-xl border border-slate-700/70 bg-slate-900/80 p-8 shadow-[0_20px_80px_rgba(15,23,42,0.55)] backdrop-blur">
          <h1 className="text-2xl font-bold">{title}</h1>
          {children ? <div className="mt-6">{children}</div> : null}
        </div>
        {showToolsCard ? <div className="mt-6"><ToolsStackCard /></div> : null}
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
