"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { editor } from "monaco-editor";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-50">
      <div className="text-gray-500">Loading editor...</div>
    </div>
  ),
});

export interface JsonEditorProps {
  value: string;
  onChange?: (value: string) => void;
  height?: string;
  readOnly?: boolean;
  language?: string;
}

export function JsonEditor({
  value,
  onChange,
  height = "400px",
  readOnly = false,
  language = "json",
}: JsonEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: string | undefined) => {
    if (newValue === undefined) return;

    setLocalValue(newValue);

    // Validate JSON
    if (language === "json") {
      try {
        JSON.parse(newValue);
        setError(null);
      } catch (e) {
        setError((e as Error).message);
      }
    }

    onChange?.(newValue);
  };

  const handleFormat = () => {
    try {
      const formatted = JSON.stringify(JSON.parse(localValue), null, 2);
      setLocalValue(formatted);
      onChange?.(formatted);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleMinify = () => {
    try {
      const minified = JSON.stringify(JSON.parse(localValue));
      setLocalValue(minified);
      onChange?.(minified);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(localValue);
      // Could add toast notification here
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-300">
          <button
            onClick={handleFormat}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Format
          </button>
          <button
            onClick={handleMinify}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Minify
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50"
          >
            Copy
          </button>
          {error && (
            <span className="ml-auto text-xs text-red-600">
              Invalid JSON: {error}
            </span>
          )}
        </div>
      )}

      {/* Editor */}
      <MonacoEditor
        height={height}
        language={language}
        value={localValue}
        onChange={handleChange}
        theme="vs-light"
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          formatOnType: true,
        }}
      />
    </div>
  );
}
