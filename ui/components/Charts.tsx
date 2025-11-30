"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// Outcome Bar Chart
export interface OutcomeBarChartProps {
  approved: number;
  pended: number;
  denied: number;
}

export function OutcomeBarChart({
  approved,
  pended,
  denied,
}: OutcomeBarChartProps) {
  const data = [
    { name: "Approved", value: approved, fill: "#10b981" },
    { name: "Pended", value: pended, fill: "#f59e0b" },
    { name: "Denied", value: denied, fill: "#ef4444" },
  ];

  const total = approved + pended + denied;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Outcome Distribution</h3>
        <span className="text-sm text-gray-500">Total: {total}</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Bar dataKey="value" fill="#3b82f6" />
        </BarChart>
      </ResponsiveContainer>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {data.map((item) => (
          <div
            key={item.name}
            className="p-3 border rounded-lg"
            style={{ borderColor: item.fill }}
          >
            <div className="text-2xl font-bold" style={{ color: item.fill }}>
              {item.value}
            </div>
            <div className="text-sm text-gray-600">{item.name}</div>
            {total > 0 && (
              <div className="text-xs text-gray-500 mt-1">
                {((item.value / total) * 100).toFixed(1)}%
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Latency Line Chart
export interface LatencyDataPoint {
  ts: number; // timestamp
  ms: number; // milliseconds
}

export interface LatencyLineChartProps {
  data: LatencyDataPoint[];
}

export function LatencyLineChart({ data }: LatencyLineChartProps) {
  const chartData = data.map((point) => ({
    time: new Date(point.ts).toLocaleTimeString(),
    latency: point.ms,
  }));

  const avgLatency =
    data.length > 0
      ? Math.round(data.reduce((sum, p) => sum + p.ms, 0) / data.length)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Response Time</h3>
        <span className="text-sm text-gray-500">Avg: {avgLatency}ms</span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis label={{ value: "ms", angle: -90, position: "insideLeft" }} />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey="latency"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pie Chart for outcome distribution
export interface OutcomePieChartProps {
  approved: number;
  pended: number;
  denied: number;
}

export function OutcomePieChart({
  approved,
  pended,
  denied,
}: OutcomePieChartProps) {
  const data = [
    { name: "Approved", value: approved },
    { name: "Pended", value: pended },
    { name: "Denied", value: denied },
  ];

  const COLORS = ["#10b981", "#f59e0b", "#ef4444"];

  const total = approved + pended + denied;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Approval Rate</h3>
        <span className="text-sm text-gray-500">
          {total > 0 ? `${((approved / total) * 100).toFixed(1)}%` : "N/A"}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}