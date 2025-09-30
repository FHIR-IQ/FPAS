"use client";

import { useState } from "react";
import { ResponseViewer } from "@/components/ResponseViewer";
import { fhirFetch, buildCurlCommand } from "@/lib/fhirClient";
import { Search, Copy, User, Building, Server } from "lucide-react";

type ScopeType = "patient" | "provider" | "system";

const scopeConfig = {
  patient: {
    label: "Patient",
    icon: User,
    token: "mock-patient-token",
    scopes: ["patient/*.read"],
    description: "Patient Access API - View your own PA history",
  },
  provider: {
    label: "Provider",
    icon: Building,
    token: "mock-provider-token",
    scopes: ["user/Claim.read", "user/ClaimResponse.read", "user/Coverage.read"],
    description: "Provider Access API - Query PA data for attributed patients",
  },
  system: {
    label: "System",
    icon: Server,
    token: "mock-system-token",
    scopes: ["system/*.read", "system/*.write"],
    description: "System Access - Full API access for payer-to-payer exchange",
  },
};

export default function AccessPage() {
  const [scopeType, setScopeType] = useState<ScopeType>("patient");
  const [patientId, setPatientId] = useState("Patient/pat-001");
  const [serviceType, setServiceType] = useState("");
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string>("");

  const currentScope = scopeConfig[scopeType];

  const handlePatientEverything = async () => {
    setLoading(true);
    try {
      const curl = buildCurlCommand(`/${patientId}/$everything`, {
        method: "GET",
        token: currentScope.token,
      });
      setCurlCommand(curl);

      const result = await fhirFetch(`/${patientId}/$everything`, {
        method: "GET",
        token: currentScope.token,
      });

      if (result.ok) {
        setResults(result.json);
      } else {
        setResults({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              diagnostics: `Failed to fetch $everything: ${result.status}`,
            },
          ],
        });
      }
    } catch (error: any) {
      setResults({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchClaims = async () => {
    setLoading(true);
    try {
      let searchParams = `?patient=${patientId}&use=preauthorization`;
      if (serviceType) {
        searchParams += `&procedure=${serviceType}`;
      }

      const curl = buildCurlCommand(`/Claim${searchParams}`, {
        method: "GET",
        token: currentScope.token,
      });
      setCurlCommand(curl);

      const result = await fhirFetch(`/Claim${searchParams}`, {
        method: "GET",
        token: currentScope.token,
      });

      if (result.ok) {
        setResults(result.json);
      } else {
        setResults({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              diagnostics: `Failed to search Claims: ${result.status}`,
            },
          ],
        });
      }
    } catch (error: any) {
      setResults({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message,
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearchCoverage = async () => {
    setLoading(true);
    try {
      const curl = buildCurlCommand(`/Coverage?patient=${patientId}`, {
        method: "GET",
        token: currentScope.token,
      });
      setCurlCommand(curl);

      const result = await fhirFetch(`/Coverage?patient=${patientId}`, {
        method: "GET",
        token: currentScope.token,
      });

      if (result.ok) {
        setResults(result.json);
      } else {
        setResults({
          resourceType: "OperationOutcome",
          issue: [
            {
              severity: "error",
              code: "not-found",
              diagnostics: `Failed to search Coverage: ${result.status}`,
            },
          ],
        });
      }
    } catch (error: any) {
      setResults({
        resourceType: "OperationOutcome",
        issue: [
          {
            severity: "error",
            code: "exception",
            diagnostics: error.message,
          },
        ],
      });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Access Viewer</h1>
        <p className="text-gray-600 mt-2">
          Query FHIR resources with different access scopes: Patient, Provider, or System.
        </p>
      </div>

      {/* Scope Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Access Scope</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(["patient", "provider", "system"] as const).map((scope) => {
            const config = scopeConfig[scope];
            const Icon = config.icon;
            const isActive = scopeType === scope;

            return (
              <button
                key={scope}
                onClick={() => setScopeType(scope)}
                className={`p-4 rounded-lg border-2 transition-all text-left ${
                  isActive
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300 bg-white"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-6 h-6 ${isActive ? "text-blue-600" : "text-gray-600"}`} />
                  <span className={`font-semibold ${isActive ? "text-blue-900" : "text-gray-900"}`}>
                    {config.label}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{config.description}</p>
                <div className="flex flex-wrap gap-1">
                  {config.scopes.map((s) => (
                    <span
                      key={s}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 p-3 bg-gray-50 rounded border border-gray-200">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Active Token:</span>{" "}
            <code className="text-xs bg-white px-2 py-1 rounded border border-gray-300">
              {currentScope.token}
            </code>
          </p>
        </div>
      </div>

      {/* Query Parameters */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Query Parameters</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Patient ID</label>
            <input
              type="text"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Patient/pat-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type (CPT Code) - Optional
            </label>
            <input
              type="text"
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="72148"
            />
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handlePatientEverything}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "Loading..." : "$everything"}
          </button>
          <button
            onClick={handleSearchClaims}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "Loading..." : "Search Claims"}
          </button>
          <button
            onClick={handleSearchCoverage}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "Loading..." : "Search Coverage"}
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

      {/* Results */}
      {results && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Results</h2>
          <ResponseViewer response={results} />
        </div>
      )}

      {!results && (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          <p>Select an action to query FHIR resources</p>
        </div>
      )}
    </div>
  );
}