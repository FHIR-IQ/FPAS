"use client";

import { useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { ResponseViewer } from "@/components/ResponseViewer";
import { cdsFetch, buildCdsCurlCommand } from "@/lib/cdsClient";
import {
  Search,
  Send,
  Copy,
  ExternalLink,
  AlertCircle,
  Info,
  CheckCircle,
  XCircle
} from "lucide-react";

const examples = {
  "order-select": require("@/lib/examples/cds-order-select.json"),
  "order-sign": require("@/lib/examples/cds-order-sign.json"),
};

interface CdsCard {
  uuid?: string;
  summary: string;
  detail?: string;
  indicator: "info" | "warning" | "critical";
  source: { label: string };
  suggestions?: Array<{
    label: string;
    actions?: Array<{ type: string; description: string; resource?: any }>;
  }>;
  links?: Array<{
    label: string;
    url: string;
    type: string;
  }>;
}

export default function CdsPage() {
  const [discoveryResponse, setDiscoveryResponse] = useState<any>(null);
  const [selectedHook, setSelectedHook] = useState<"order-select" | "order-sign">("order-select");
  const [hookRequest, setHookRequest] = useState<string>(JSON.stringify(examples["order-select"], null, 2));
  const [hookResponse, setHookResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [curlCommand, setCurlCommand] = useState<string>("");

  const handleDiscovery = async () => {
    setLoading(true);
    try {
      const curl = buildCdsCurlCommand("/cds-services", {
        method: "GET",
      });
      setCurlCommand(curl);

      const result = await cdsFetch("/cds-services", {
        method: "GET",
      });

      if (result.ok) {
        setDiscoveryResponse(result.json);
      } else {
        setDiscoveryResponse({
          error: "Discovery failed",
          status: result.status,
          body: result.json,
        });
      }
    } catch (error: any) {
      setDiscoveryResponse({
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExampleChange = (hook: "order-select" | "order-sign") => {
    setSelectedHook(hook);
    setHookRequest(JSON.stringify(examples[hook], null, 2));
    setHookResponse(null);
  };

  const handleCallHook = async () => {
    setLoading(true);
    try {
      const parsed = JSON.parse(hookRequest);
      const hookName = parsed.hook;

      if (!hookName) {
        alert("Request must include a 'hook' field");
        setLoading(false);
        return;
      }

      const curl = buildCdsCurlCommand(`/cds-services/${hookName}`, {
        method: "POST",
        body: parsed,
      });
      setCurlCommand(curl);

      const result = await cdsFetch(`/cds-services/${hookName}`, {
        method: "POST",
        body: parsed,
      });

      if (result.ok) {
        setHookResponse(result.json);
      } else {
        setHookResponse({
          error: "Hook call failed",
          status: result.status,
          body: result.json,
        });
      }
    } catch (error: any) {
      setHookResponse({
        error: error.message,
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

  const renderCard = (card: CdsCard, index: number) => {
    const indicatorConfig = {
      info: { icon: Info, color: "bg-blue-500", bgColor: "bg-blue-50", borderColor: "border-blue-200" },
      warning: { icon: AlertCircle, color: "bg-yellow-500", bgColor: "bg-yellow-50", borderColor: "border-yellow-200" },
      critical: { icon: XCircle, color: "bg-red-500", bgColor: "bg-red-50", borderColor: "border-red-200" },
    };

    const config = indicatorConfig[card.indicator];
    const Icon = config.icon;

    return (
      <div
        key={card.uuid || index}
        className={`border-l-4 ${config.borderColor} ${config.bgColor} rounded-lg p-4 mb-4`}
      >
        <div className="flex items-start gap-3">
          <div className={`${config.color} rounded-full p-2 text-white`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 mb-1">{card.summary}</h3>
            {card.detail && <p className="text-sm text-gray-700 mb-3">{card.detail}</p>}

            <p className="text-xs text-gray-500 mb-3">Source: {card.source.label}</p>

            {/* Suggestions */}
            {card.suggestions && card.suggestions.length > 0 && (
              <div className="mb-3">
                <p className="text-sm font-medium text-gray-700 mb-2">Suggestions:</p>
                {card.suggestions.map((suggestion, idx) => (
                  <div key={idx} className="bg-white rounded border border-gray-200 p-3 mb-2">
                    <p className="text-sm font-medium text-gray-900 mb-2">{suggestion.label}</p>
                    {suggestion.actions && suggestion.actions.length > 0 && (
                      <div className="space-y-1">
                        {suggestion.actions.map((action, actionIdx) => (
                          <div key={actionIdx} className="text-xs text-gray-600 flex items-center gap-2">
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span>{action.type}: {action.description}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Links */}
            {card.links && card.links.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {card.links.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-white px-2 py-1 rounded border border-blue-200 hover:border-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">CDS Hooks Playground</h1>
        <p className="text-gray-600 mt-2">
          Discover available CDS services and test hook invocations with order-select and order-sign workflows.
        </p>
      </div>

      {/* Discovery Section */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Service Discovery</h2>
        <p className="text-sm text-gray-600 mb-4">
          Call the /cds-services endpoint to discover available CDS Hooks services.
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDiscovery}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
            {loading ? "Discovering..." : "Discover Services"}
          </button>
          {curlCommand && (
            <button
              onClick={handleCopyCurl}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors"
            >
              <Copy className="w-4 h-4" />
              Copy cURL
            </button>
          )}
        </div>

        {discoveryResponse && (
          <div className="mt-4">
            <ResponseViewer response={discoveryResponse} />
          </div>
        )}
      </div>

      {/* Hook Invocation Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Request */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Hook Request</h2>

            {/* Example Selector */}
            <div className="flex gap-2 mb-4">
              <span className="text-sm font-medium text-gray-700 py-2">Example:</span>
              {(["order-select", "order-sign"] as const).map((hook) => (
                <button
                  key={hook}
                  onClick={() => handleExampleChange(hook)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedHook === hook
                      ? "bg-purple-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {hook}
                </button>
              ))}
            </div>

            <JsonEditor
              value={hookRequest}
              onChange={(val) => setHookRequest(val || "")}
              height="500px"
            />

            <button
              onClick={handleCallHook}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 mt-4"
            >
              <Send className="w-4 h-4" />
              {loading ? "Calling Hook..." : "Call Hook"}
            </button>
          </div>
        </div>

        {/* Right Panel - Response */}
        <div className="space-y-4">
          {hookResponse && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Hook Response</h2>

              {/* Render Cards if present */}
              {hookResponse.cards && Array.isArray(hookResponse.cards) && hookResponse.cards.length > 0 ? (
                <div className="space-y-4">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      {hookResponse.cards.length} card{hookResponse.cards.length !== 1 ? "s" : ""} returned
                    </p>
                  </div>
                  {hookResponse.cards.map((card: CdsCard, index: number) => renderCard(card, index))}
                </div>
              ) : hookResponse.error ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-medium">Error: {hookResponse.error}</p>
                  {hookResponse.status && <p className="text-red-600 text-sm mt-1">Status: {hookResponse.status}</p>}
                </div>
              ) : (
                <ResponseViewer response={hookResponse} />
              )}
            </div>
          )}

          {!hookResponse && (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <p>Select an example and call the hook to see the response</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}