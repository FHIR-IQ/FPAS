"use client";

import { useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { ResponseViewer } from "@/components/ResponseViewer";
import { Timeline, TimelineEvent } from "@/components/Timeline";
import { fhirFetch, buildCurlCommand } from "@/lib/fhirClient";
import { Copy, Send, Search, X, RotateCcw, CheckCircle } from "lucide-react";

const examples = {
  approve: require("@/lib/examples/pas-approve.json"),
  pend: require("@/lib/examples/pas-pend.json"),
  deny: require("@/lib/examples/pas-deny.json"),
};

export default function PASPage() {
  const [selectedExample, setSelectedExample] = useState<"approve" | "pend" | "deny">("approve");
  const [requestJson, setRequestJson] = useState<string>(JSON.stringify(examples.approve, null, 2));
  const [response, setResponse] = useState<any>(null);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string>("");
  const [lastClaimId, setLastClaimId] = useState<string | null>(null);

  const addTimelineEvent = (stage: string, status: TimelineEvent["status"], details?: string) => {
    setTimeline((prev) => [
      ...prev,
      { stage, timestamp: new Date(), status, details },
    ]);
  };

  const handleExampleChange = (example: "approve" | "pend" | "deny") => {
    setSelectedExample(example);
    setRequestJson(JSON.stringify(examples[example], null, 2));
    setResponse(null);
    setTimeline([]);
    setCurlCommand("");
    setLastClaimId(null);
  };

  const handleReset = () => {
    setRequestJson(JSON.stringify(examples[selectedExample], null, 2));
    setResponse(null);
    setTimeline([]);
    setCurlCommand("");
    setLastClaimId(null);
  };

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(requestJson);
      if (!parsed.resourceType) {
        throw new Error("Missing resourceType");
      }
      addTimelineEvent("Validation", "completed", "JSON is valid FHIR resource");
      alert("✅ Valid JSON structure");
    } catch (error: any) {
      addTimelineEvent("Validation", "error", error.message);
      alert(`❌ Invalid JSON: ${error.message}`);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    addTimelineEvent("Request Prepared", "completed", "Sending to /Claim/$submit");

    try {
      const parsed = JSON.parse(requestJson);

      // Extract claim ID if present
      const claimId = parsed.entry?.find((e: any) => e.resource?.resourceType === "Claim")?.resource?.id;
      if (claimId) {
        setLastClaimId(claimId);
      }

      const curl = buildCurlCommand("/Claim/$submit", {
        method: "POST",
        body: parsed,
        token: "mock-provider-token",
      });
      setCurlCommand(curl);

      addTimelineEvent("Submitting to PAS", "in_progress", "Awaiting response...");

      const result = await fhirFetch("/Claim/$submit", {
        method: "POST",
        body: parsed,
        token: "mock-provider-token",
      });

      if (result.ok) {
        addTimelineEvent("PAS Response Received", "completed", `Status: ${result.status}`);
        setResponse(result.json);

        // Check for OperationOutcome
        if (result.json?.resourceType === "OperationOutcome") {
          const hasFatal = result.json.issue?.some((i: any) => i.severity === "fatal" || i.severity === "error");
          if (hasFatal) {
            addTimelineEvent("Processing Error", "error", "See OperationOutcome for details");
          } else {
            addTimelineEvent("Processing Warning", "completed", "Request processed with warnings");
          }
        } else if (result.json?.resourceType === "Bundle") {
          // Check ClaimResponse outcome
          const claimResponse = result.json.entry?.find((e: any) => e.resource?.resourceType === "ClaimResponse")?.resource;
          if (claimResponse?.outcome) {
            const outcome = claimResponse.outcome.toLowerCase();
            if (outcome.includes("complete")) {
              addTimelineEvent("Authorization Decision", "completed", `Decision: ${claimResponse.outcome}`);
            } else if (outcome.includes("queued") || outcome.includes("partial")) {
              addTimelineEvent("Authorization Decision", "in_progress", `Decision: ${claimResponse.outcome}`);
            } else {
              addTimelineEvent("Authorization Decision", "error", `Decision: ${claimResponse.outcome}`);
            }
          }
        }
      } else {
        addTimelineEvent("Request Failed", "error", `HTTP ${result.status}`);
        setResponse(result.json || { error: "Request failed", status: result.status });
      }
    } catch (error: any) {
      addTimelineEvent("Error", "error", error.message);
      setResponse({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "exception", diagnostics: error.message }] });
    } finally {
      setLoading(false);
    }
  };

  const handleInquire = async () => {
    if (!lastClaimId) {
      alert("No claim ID available. Submit a request first.");
      return;
    }

    setLoading(true);
    addTimelineEvent("Status Inquiry", "in_progress", `Checking status of ${lastClaimId}`);

    try {
      const inquireBundle = {
        resourceType: "Bundle",
        type: "collection",
        entry: [
          {
            resource: {
              resourceType: "Claim",
              id: lastClaimId,
              status: "active",
              type: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/claim-type",
                    code: "professional",
                  },
                ],
              },
              use: "preauthorization",
              patient: { reference: "Patient/pat-001" },
              created: new Date().toISOString(),
              provider: { reference: "Practitioner/pract-001" },
              priority: {
                coding: [
                  {
                    system: "http://terminology.hl7.org/CodeSystem/processpriority",
                    code: "stat",
                  },
                ],
              },
              insurance: [
                {
                  sequence: 1,
                  focal: true,
                  coverage: { reference: "Coverage/cov-001" },
                },
              ],
            },
          },
        ],
      };

      const curl = buildCurlCommand("/Claim/$inquire", {
        method: "POST",
        body: inquireBundle,
        token: "mock-provider-token",
      });
      setCurlCommand(curl);

      const result = await fhirFetch("/Claim/$inquire", {
        method: "POST",
        body: inquireBundle,
        token: "mock-provider-token",
      });

      if (result.ok) {
        addTimelineEvent("Inquiry Response", "completed", `Status: ${result.status}`);
        setResponse(result.json);
      } else {
        addTimelineEvent("Inquiry Failed", "error", `HTTP ${result.status}`);
        setResponse(result.json || { error: "Inquiry failed", status: result.status });
      }
    } catch (error: any) {
      addTimelineEvent("Inquiry Error", "error", error.message);
      setResponse({ resourceType: "OperationOutcome", issue: [{ severity: "error", code: "exception", diagnostics: error.message }] });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setResponse(null);
    setTimeline([]);
    setCurlCommand("");
    setLoading(false);
  };

  const handleCopyCurl = () => {
    if (curlCommand) {
      navigator.clipboard.writeText(curlCommand);
      alert("✅ cURL command copied to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">PAS Tester</h1>
        <p className="text-gray-600 mt-2">
          Submit Prior Authorization requests and check their status using FHIR PAS operations.
        </p>
      </div>

      {/* Example Selector */}
      <div className="flex gap-2">
        <span className="text-sm font-medium text-gray-700 py-2">Example:</span>
        {(["approve", "pend", "deny"] as const).map((ex) => (
          <button
            key={ex}
            onClick={() => handleExampleChange(ex)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedExample === ex
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {ex.charAt(0).toUpperCase() + ex.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Request Editor */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Request Body</h2>
            <JsonEditor
              value={requestJson}
              onChange={(val) => setRequestJson(val || "")}
              height="500px"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleValidate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
              disabled={loading}
            >
              <CheckCircle className="w-4 h-4" />
              Validate
            </button>
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              <Send className="w-4 h-4" />
              {loading ? "Submitting..." : "Submit"}
            </button>
            <button
              onClick={handleInquire}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading || !lastClaimId}
            >
              <Search className="w-4 h-4" />
              Inquire
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              disabled={loading}
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
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

        {/* Right Panel - Response & Timeline */}
        <div className="space-y-4">
          {timeline.length > 0 && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Workflow Timeline</h2>
              <Timeline events={timeline} />
            </div>
          )}

          {response && (
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold mb-4">Response</h2>
              <ResponseViewer response={response} />
            </div>
          )}

          {!response && timeline.length === 0 && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <p>Select an example and click Submit to see the response</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}