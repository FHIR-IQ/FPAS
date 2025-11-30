"use client";

import { useState, useEffect } from "react";
import { ResponseViewer } from "@/components/ResponseViewer";
import { fhirFetch, buildCurlCommand } from "@/lib/fhirClient";
import { parseNDJSON, getFirstNRows, countNDJSONRows } from "@/lib/ndjson";
import { Download, Clock, CheckCircle, Copy, Eye } from "lucide-react";

interface ExportJob {
  jobId: string;
  statusUrl: string;
  status: "in-progress" | "completed" | "error";
  output?: Array<{ type: string; url: string }>;
  error?: string;
  transactionTime?: string;
  request?: string;
}

export default function BulkPage() {
  const [groupId, setGroupId] = useState("Group/switching-members-2024");
  const [resourceTypes, setResourceTypes] = useState("Patient,Coverage,Claim,ClaimResponse");
  const [since, setSince] = useState("");
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [polling, setPolling] = useState(false);
  const [ndjsonPreview, setNdjsonPreview] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string>("");

  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    if (polling && exportJob && exportJob.status === "in-progress") {
      pollInterval = setInterval(async () => {
        await checkJobStatus(exportJob.statusUrl);
      }, 3000);
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [polling, exportJob]);

  const handleStartExport = async () => {
    setLoading(true);
    try {
      let exportUrl = `/${groupId}/$export`;
      const params = new URLSearchParams();

      if (resourceTypes) {
        params.append("_type", resourceTypes);
      }
      if (since) {
        params.append("_since", since);
      }

      if (params.toString()) {
        exportUrl += `?${params.toString()}`;
      }

      const curl = buildCurlCommand(exportUrl, {
        method: "GET",
        token: "mock-system-token",
        headers: {
          Prefer: "respond-async",
        },
      });
      setCurlCommand(curl);

      const result = await fhirFetch(exportUrl, {
        method: "GET",
        token: "mock-system-token",
        headers: {
          Prefer: "respond-async",
        },
      });

      if (result.status === 202) {
        // Export initiated
        const contentLocation = result.headers.get("Content-Location");
        if (contentLocation) {
          const job: ExportJob = {
            jobId: contentLocation.split("/").pop() || "unknown",
            statusUrl: contentLocation,
            status: "in-progress",
            request: exportUrl,
          };
          setExportJob(job);
          setPolling(true);
        } else {
          alert("Export initiated but no Content-Location header found");
        }
      } else if (result.status === 200) {
        // Synchronous response (shouldn't happen with Prefer: respond-async)
        setExportJob({
          jobId: "sync-response",
          statusUrl: "",
          status: "completed",
          output: result.json?.output || [],
          request: exportUrl,
        });
      } else {
        setExportJob({
          jobId: "error",
          statusUrl: "",
          status: "error",
          error: `Export failed with status ${result.status}`,
          request: exportUrl,
        });
      }
    } catch (error: any) {
      setExportJob({
        jobId: "error",
        statusUrl: "",
        status: "error",
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const checkJobStatus = async (statusUrl: string) => {
    try {
      const result = await fhirFetch(statusUrl, {
        method: "GET",
        token: "mock-system-token",
      });

      if (result.status === 200) {
        // Export complete
        const body = result.json;
        setExportJob((prev) => ({
          ...prev!,
          status: "completed",
          output: body.output || [],
          transactionTime: body.transactionTime,
        }));
        setPolling(false);
      } else if (result.status === 202) {
        // Still in progress
        const xProgress = result.headers.get("X-Progress");
        if (xProgress) {
          setExportJob((prev) => ({
            ...prev!,
            status: "in-progress",
          }));
        }
      } else {
        // Error
        setExportJob((prev) => ({
          ...prev!,
          status: "error",
          error: `Status check failed with ${result.status}`,
        }));
        setPolling(false);
      }
    } catch (error: any) {
      setExportJob((prev) => ({
        ...prev!,
        status: "error",
        error: error.message,
      }));
      setPolling(false);
    }
  };

  const handlePreviewFile = async (fileUrl: string) => {
    setLoading(true);
    try {
      const curl = buildCurlCommand(fileUrl, {
        method: "GET",
        token: "mock-system-token",
      });
      setCurlCommand(curl);

      const result = await fhirFetch(fileUrl, {
        method: "GET",
        token: "mock-system-token",
      });

      if (result.ok) {
        const ndjsonText = await result.json;
        const rows = getFirstNRows(ndjsonText, 10);
        const totalRows = countNDJSONRows(ndjsonText);

        setNdjsonPreview({
          url: fileUrl,
          totalRows,
          previewRows: rows,
          fullText: ndjsonText,
        });
      } else {
        alert(`Failed to fetch NDJSON file: ${result.status}`);
      }
    } catch (error: any) {
      alert(`Error previewing file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCurl = () => {
    if (curlCommand) {
      navigator.clipboard.writeText(curlCommand);
      alert("✅ cURL command copied to clipboard");
    }
  };

  const handleStopPolling = () => {
    setPolling(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Bulk Export Simulator</h1>
        <p className="text-gray-600 mt-2">
          Initiate FHIR Bulk Data export operations for payer-to-payer data exchange scenarios.
        </p>
      </div>

      {/* Export Parameters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Export Parameters</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Group ID</label>
            <input
              type="text"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Group/switching-members-2024"
            />
            <p className="text-xs text-gray-500 mt-1">
              The Group resource containing members for bulk export
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Resource Types (_type)
            </label>
            <input
              type="text"
              value={resourceTypes}
              onChange={(e) => setResourceTypes(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Patient,Coverage,Claim,ClaimResponse"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated list of resource types to export
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Since (_since) - Optional
            </label>
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Only include resources modified after this timestamp (incremental export)
            </p>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={handleStartExport}
            disabled={loading || polling}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {loading ? "Starting..." : "Start Export"}
          </button>
          {polling && (
            <button
              onClick={handleStopPolling}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Stop Polling
            </button>
          )}
          {curlCommand && (
            <button
              onClick={handleCopyCurl}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors ml-auto"
            >
              <Copy className="w-4 h-4" />
              Copy cURL
            </button>
          )}
        </div>
      </div>

      {/* Export Job Status */}
      {exportJob && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Export Job Status</h2>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {exportJob.status === "in-progress" && (
                <>
                  <Clock className="w-5 h-5 text-yellow-500 animate-spin" />
                  <span className="text-yellow-700 font-medium">In Progress...</span>
                </>
              )}
              {exportJob.status === "completed" && (
                <>
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span className="text-green-700 font-medium">Export Complete</span>
                </>
              )}
              {exportJob.status === "error" && (
                <>
                  <span className="text-red-500 font-medium">❌ Error</span>
                </>
              )}
            </div>

            <div className="text-sm text-gray-600">
              <p><span className="font-medium">Job ID:</span> {exportJob.jobId}</p>
              {exportJob.statusUrl && (
                <p><span className="font-medium">Status URL:</span> {exportJob.statusUrl}</p>
              )}
              {exportJob.transactionTime && (
                <p><span className="font-medium">Transaction Time:</span> {exportJob.transactionTime}</p>
              )}
            </div>

            {exportJob.error && (
              <div className="bg-red-50 border border-red-200 rounded p-3 text-red-800 text-sm">
                {exportJob.error}
              </div>
            )}

            {exportJob.output && exportJob.output.length > 0 && (
              <div className="mt-4">
                <h3 className="font-medium text-gray-900 mb-2">Output Files</h3>
                <div className="space-y-2">
                  {exportJob.output.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{file.type}</p>
                        <p className="text-xs text-gray-500">{file.url}</p>
                      </div>
                      <button
                        onClick={() => handlePreviewFile(file.url)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Preview
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NDJSON Preview */}
      {ndjsonPreview && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">NDJSON Preview</h2>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">File:</span> {ndjsonPreview.url}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Total Rows:</span> {ndjsonPreview.totalRows}
            </p>
            <p className="text-sm text-gray-600">
              <span className="font-medium">Showing:</span> First {Math.min(10, ndjsonPreview.totalRows)} rows
            </p>
          </div>

          <div className="space-y-3">
            {ndjsonPreview.previewRows.map((row: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded">
                <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                  <span className="text-xs font-medium text-gray-700">
                    Row {idx + 1} - {row.resourceType} {row.id && `(${row.id})`}
                  </span>
                </div>
                <div className="p-3">
                  <ResponseViewer response={row} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!exportJob && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p>Configure export parameters and click Start Export to begin</p>
        </div>
      )}
    </div>
  );
}