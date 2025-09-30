"use client";

import { useState, useEffect } from "react";
import {
  OutcomeBarChart,
  LatencyLineChart,
  OutcomePieChart,
} from "@/components/Charts";
import { TrendingUp, Clock, CheckCircle, AlertCircle, XCircle } from "lucide-react";

interface MetricEvent {
  timestamp: Date;
  outcome: "approved" | "pended" | "denied";
  latencyMs: number;
  patientId: string;
  claimId: string;
}

// Mock event store (in-memory)
const mockEvents: MetricEvent[] = [
  {
    timestamp: new Date(Date.now() - 3600000 * 24),
    outcome: "approved",
    latencyMs: 1200,
    patientId: "Patient/pat-001",
    claimId: "Claim/claim-001",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 20),
    outcome: "approved",
    latencyMs: 950,
    patientId: "Patient/pat-002",
    claimId: "Claim/claim-002",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 18),
    outcome: "pended",
    latencyMs: 1800,
    patientId: "Patient/pat-003",
    claimId: "Claim/claim-003",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 15),
    outcome: "denied",
    latencyMs: 1100,
    patientId: "Patient/pat-004",
    claimId: "Claim/claim-004",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 12),
    outcome: "approved",
    latencyMs: 1050,
    patientId: "Patient/pat-005",
    claimId: "Claim/claim-005",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 10),
    outcome: "approved",
    latencyMs: 1300,
    patientId: "Patient/pat-006",
    claimId: "Claim/claim-006",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 8),
    outcome: "pended",
    latencyMs: 2100,
    patientId: "Patient/pat-007",
    claimId: "Claim/claim-007",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 6),
    outcome: "approved",
    latencyMs: 980,
    patientId: "Patient/pat-008",
    claimId: "Claim/claim-008",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 4),
    outcome: "denied",
    latencyMs: 1450,
    patientId: "Patient/pat-009",
    claimId: "Claim/claim-009",
  },
  {
    timestamp: new Date(Date.now() - 3600000 * 2),
    outcome: "approved",
    latencyMs: 1150,
    patientId: "Patient/pat-010",
    claimId: "Claim/claim-010",
  },
];

export default function MetricsPage() {
  const [events, setEvents] = useState<MetricEvent[]>(mockEvents);
  const [approved, setApproved] = useState(0);
  const [pended, setPended] = useState(0);
  const [denied, setDenied] = useState(0);
  const [avgLatency, setAvgLatency] = useState(0);
  const [latencyData, setLatencyData] = useState<Array<{ ts: number; ms: number }>>([]);

  useEffect(() => {
    calculateMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const calculateMetrics = () => {
    const approvedCount = events.filter((e) => e.outcome === "approved").length;
    const pendedCount = events.filter((e) => e.outcome === "pended").length;
    const deniedCount = events.filter((e) => e.outcome === "denied").length;

    setApproved(approvedCount);
    setPended(pendedCount);
    setDenied(deniedCount);

    const totalLatency = events.reduce((sum, e) => sum + e.latencyMs, 0);
    const avg = events.length > 0 ? Math.round(totalLatency / events.length) : 0;
    setAvgLatency(avg);

    // Latency over time (last 10 events)
    const recentEvents = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime()).slice(-10);
    const latencyTimeSeries = recentEvents.map((e) => ({
      ts: e.timestamp.getTime(),
      ms: e.latencyMs,
    }));
    setLatencyData(latencyTimeSeries);
  };

  const handleAddMockEvent = () => {
    const outcomes: Array<"approved" | "pended" | "denied"> = ["approved", "pended", "denied"];
    const randomOutcome = outcomes[Math.floor(Math.random() * outcomes.length)];
    const randomLatency = Math.floor(Math.random() * 1500) + 800;

    const newEvent: MetricEvent = {
      timestamp: new Date(),
      outcome: randomOutcome,
      latencyMs: randomLatency,
      patientId: `Patient/pat-${Math.floor(Math.random() * 1000)}`,
      claimId: `Claim/claim-${Math.floor(Math.random() * 1000)}`,
    };

    setEvents((prev) => [...prev, newEvent]);
  };

  const handleClearEvents = () => {
    setEvents([]);
  };

  const totalRequests = approved + pended + denied;
  const approvalRate = totalRequests > 0 ? Math.round((approved / totalRequests) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Metrics Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Track prior authorization outcomes, latency, and approval rates in real-time.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Total Requests</h3>
            <TrendingUp className="w-5 h-5 text-blue-500" />
          </div>
          <p className="text-3xl font-bold text-gray-900">{totalRequests}</p>
          <p className="text-xs text-gray-500 mt-1">All PA submissions</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Approved</h3>
            <CheckCircle className="w-5 h-5 text-green-500" />
          </div>
          <p className="text-3xl font-bold text-green-600">{approved}</p>
          <p className="text-xs text-gray-500 mt-1">{approvalRate}% approval rate</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Pended</h3>
            <AlertCircle className="w-5 h-5 text-yellow-500" />
          </div>
          <p className="text-3xl font-bold text-yellow-600">{pended}</p>
          <p className="text-xs text-gray-500 mt-1">Require review</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-600">Denied</h3>
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <p className="text-3xl font-bold text-red-600">{denied}</p>
          <p className="text-xs text-gray-500 mt-1">Not authorized</p>
        </div>
      </div>

      {/* Latency Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-purple-500" />
            <h2 className="text-xl font-semibold">Average Latency</h2>
          </div>
          <p className="text-2xl font-bold text-purple-600">{avgLatency}ms</p>
        </div>
        <p className="text-sm text-gray-600">Mean response time for PA submissions</p>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Outcomes Distribution (Bar)</h2>
          <OutcomeBarChart approved={approved} pended={pended} denied={denied} />
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Outcomes Distribution (Pie)</h2>
          <OutcomePieChart approved={approved} pended={pended} denied={denied} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Latency Over Time</h2>
        <LatencyLineChart data={latencyData} />
      </div>

      {/* Event Log */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Event Log</h2>
          <div className="flex gap-2">
            <button
              onClick={handleAddMockEvent}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Mock Event
            </button>
            <button
              onClick={handleClearEvents}
              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors"
            >
              Clear All
            </button>
          </div>
        </div>

        {events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No events recorded. Add mock events to see them here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Claim ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Patient ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outcome
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Latency
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {[...events].reverse().map((event, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {event.timestamp.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {event.claimId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                      {event.patientId}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          event.outcome === "approved"
                            ? "bg-green-100 text-green-800"
                            : event.outcome === "pended"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {event.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {event.latencyMs}ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}