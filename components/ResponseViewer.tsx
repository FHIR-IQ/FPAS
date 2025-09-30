"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Download } from "lucide-react";
import { clsx } from "clsx";

export interface ResponseViewerProps {
  response: any;
  loading?: boolean;
  error?: string | null;
  title?: string;
}

export function ResponseViewer({
  response,
  loading,
  error,
  title = "Response",
}: ResponseViewerProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(response, null, 2));
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(response, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="border border-gray-300 rounded-lg p-6">
        <div className="flex items-center gap-3">
          <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-300 bg-red-50 rounded-lg p-6">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 text-red-600">⚠️</div>
          <div>
            <h4 className="font-semibold text-red-900 mb-1">Error</h4>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="border border-gray-300 rounded-lg p-6 text-center text-gray-500">
        No response yet
      </div>
    );
  }

  // Check if it's an OperationOutcome
  const isOperationOutcome = response.resourceType === "OperationOutcome";

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-300">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-600 hover:text-gray-900"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {response.resourceType && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
              {response.resourceType}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title="Copy JSON"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-200 rounded"
            title="Download JSON"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {!collapsed && (
        <div className="p-4">
          {isOperationOutcome ? (
            <OperationOutcomeCard outcome={response} />
          ) : (
            <pre className="text-xs font-mono overflow-x-auto max-h-96 overflow-y-auto">
              {JSON.stringify(response, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function OperationOutcomeCard({ outcome }: { outcome: any }) {
  return (
    <div className="space-y-3">
      {outcome.issue?.map((issue: any, idx: number) => {
        const severityColors = {
          fatal: "border-red-500 bg-red-50",
          error: "border-red-400 bg-red-50",
          warning: "border-yellow-400 bg-yellow-50",
          information: "border-blue-400 bg-blue-50",
        };

        const severityTextColors = {
          fatal: "text-red-900",
          error: "text-red-800",
          warning: "text-yellow-800",
          information: "text-blue-800",
        };

        const severity = issue.severity || "error";

        return (
          <div
            key={idx}
            className={clsx(
              "border-l-4 p-4 rounded",
              severityColors[severity as keyof typeof severityColors] ||
                severityColors.error
            )}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={clsx(
                      "text-xs font-semibold uppercase",
                      severityTextColors[
                        severity as keyof typeof severityTextColors
                      ] || severityTextColors.error
                    )}
                  >
                    {severity}
                  </span>
                  {issue.code && (
                    <span className="text-xs px-2 py-0.5 bg-gray-200 text-gray-700 rounded">
                      {issue.code}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800">{issue.diagnostics}</p>
                {issue.expression && (
                  <p className="text-xs text-gray-600 mt-1">
                    Location: {issue.expression.join(", ")}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}