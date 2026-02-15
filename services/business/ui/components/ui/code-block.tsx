"use client";

import React, { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/cjs/styles/prism";
import { IconCheck, IconCopy } from "@tabler/icons-react";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export type CodeBlockMarker = {
  line: number;
  message: string;
  severity?: "error" | "warning" | "info";
};

type CodeBlockProps = {
  language: string;
  filename: string;
  highlightLines?: number[];
  editable?: boolean;
  onChange?: (value: string) => void;
  markers?: CodeBlockMarker[];
} & (
  | {
      code: string;
      tabs?: never;
    }
  | {
      code?: never;
      tabs: Array<{
        name: string;
        code: string;
        language?: string;
        highlightLines?: number[];
      }>;
    }
);

function ensureYaraLanguage(monaco: any) {
  if (monaco.languages.getLanguages().some((l: any) => l.id === "yara")) return;
  monaco.languages.register({ id: "yara" });
  monaco.languages.setMonarchTokensProvider("yara", {
    tokenizer: {
      root: [
        [/\b(rule|private|global|meta|strings|condition|and|or|not|true|false|for|all|any|them|of)\b/, "keyword"],
        [/\$[A-Za-z0-9_]+/, "variable"],
        [/#[A-Za-z0-9_]+/, "number"],
        [/\b[0-9]+\b/, "number"],
        [/".*?"/, "string"],
        [/\/\/.*$/, "comment"],
        [/\/\*/, "comment", "@comment"],
        [/[{}()[\]]/, "@brackets"],
        [/[:=<>!+\-*/%]/, "operator"],
        [/[A-Za-z_][A-Za-z0-9_]*/, "identifier"],
      ],
      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],
    },
  });
}

export const CodeBlock = ({
  language,
  filename,
  code,
  highlightLines = [],
  tabs = [],
  editable = false,
  onChange,
  markers = [],
}: CodeBlockProps) => {
  const [copied, setCopied] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState(0);
  const monacoRef = useRef<any>(null);
  const modelRef = useRef<any>(null);

  const tabsExist = tabs.length > 0;

  const copyToClipboard = async () => {
    const textToCopy = tabsExist ? tabs[activeTab].code : code;
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const activeCode = tabsExist ? tabs[activeTab].code : code;
  const activeLanguage = tabsExist ? tabs[activeTab].language || language : language;
  const activeHighlightLines = tabsExist ? tabs[activeTab].highlightLines || [] : highlightLines;

  useEffect(() => {
    if (!monacoRef.current || !modelRef.current || !editable) return;
    const monaco = monacoRef.current;
    const sev = monaco.MarkerSeverity;
    const mapped = markers.map((m) => ({
      startLineNumber: Math.max(1, m.line),
      startColumn: 1,
      endLineNumber: Math.max(1, m.line),
      endColumn: Number.MAX_SAFE_INTEGER,
      message: m.message,
      severity: m.severity === "warning" ? sev.Warning : m.severity === "info" ? sev.Info : sev.Error,
    }));
    monaco.editor.setModelMarkers(modelRef.current, "yara-validation", mapped);
  }, [markers, editable]);

  return (
    <div className="relative w-full rounded-lg bg-slate-900 p-4 font-mono text-sm">
      <div className="flex flex-col gap-2">
        {tabsExist && (
          <div className="flex overflow-x-auto">
            {tabs.map((tab, index) => (
              <button
                key={tab.name}
                onClick={() => setActiveTab(index)}
                className={`px-3 py-2 text-xs font-sans transition-colors ${
                  activeTab === index ? "text-white" : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        )}
        {!tabsExist && filename && (
          <div className="flex items-center justify-between py-2">
            <div className="text-xs text-zinc-400">{filename}</div>
            <button
              onClick={copyToClipboard}
              className="flex items-center gap-1 font-sans text-xs text-zinc-400 transition-colors hover:text-zinc-200"
            >
              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
            </button>
          </div>
        )}
      </div>

      {editable ? (
        <div className="h-[540px] overflow-hidden rounded-md border border-slate-700/80">
          <MonacoEditor
            height="100%"
            language={activeLanguage === "yara" ? "yara" : activeLanguage}
            theme="vs-dark"
            value={String(activeCode || "")}
            onChange={(v) => onChange?.(v || "")}
            onMount={(editor, monaco) => {
              monacoRef.current = monaco;
              modelRef.current = editor.getModel();
              ensureYaraLanguage(monaco);
            }}
            options={{
              minimap: { enabled: false },
              wordWrap: "on",
              fontSize: 15,
              lineHeight: 24,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              quickSuggestions: true,
            }}
          />
        </div>
      ) : (
        <SyntaxHighlighter
          language={activeLanguage}
          style={atomDark}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "0.875rem",
          }}
          wrapLines={true}
          showLineNumbers={true}
          lineProps={(lineNumber) => ({
            style: {
              backgroundColor: activeHighlightLines.includes(lineNumber) ? "rgba(255,255,255,0.1)" : "transparent",
              display: "block",
              width: "100%",
            },
          })}
          PreTag="div"
        >
          {String(activeCode)}
        </SyntaxHighlighter>
      )}
    </div>
  );
};

