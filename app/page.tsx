import Link from "next/link";
import {
  FileText,
  ClipboardList,
  Zap,
  Users,
  Database,
  BarChart3,
} from "lucide-react";

const features = [
  {
    title: "PAS Submission",
    description: "Submit prior authorization requests and track status",
    href: "/pas",
    icon: FileText,
    color: "text-blue-500",
  },
  {
    title: "DTR Workflow",
    description: "Complete questionnaires and attach to PA requests",
    href: "/dtr",
    icon: ClipboardList,
    color: "text-green-500",
  },
  {
    title: "CDS Hooks",
    description: "Test coverage requirements discovery hooks",
    href: "/cds",
    icon: Zap,
    color: "text-yellow-500",
  },
  {
    title: "Patient/Provider Access",
    description: "Query historical authorization data",
    href: "/access",
    icon: Users,
    color: "text-purple-500",
  },
  {
    title: "Bulk Export",
    description: "Export FHIR data for member switching",
    href: "/bulk",
    icon: Database,
    color: "text-cyan-500",
  },
  {
    title: "Metrics Dashboard",
    description: "Visualize PA submission and approval metrics",
    href: "/metrics",
    icon: BarChart3,
    color: "text-orange-500",
  },
];

export default function Home() {
  return (
    <div className="mx-auto max-w-7xl">
      <div className="mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
          FHIR IQ Prior Authorization System
        </h1>
        <p className="text-xl text-gray-600">
          Interactive API Tester & Demo
        </p>
        <p className="mt-4 text-gray-500">
          Test and demonstrate FPAS capabilities including PAS, DTR, CDS Hooks,
          Patient Access, Bulk Export, and Metrics visualization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.href}
              href={feature.href}
              className="block p-6 bg-white rounded-lg border border-gray-200 hover:border-primary hover:shadow-lg transition-all"
            >
              <div className="flex items-start gap-4">
                <div className={`flex-shrink-0 ${feature.color}`}>
                  <Icon className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600">{feature.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-12 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100 shadow-sm">
        <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
          <span className="p-2 bg-blue-100 rounded-lg">🚀</span>
          Getting Started
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold">1</div>
              <p className="text-blue-800">Select a feature from the cards above to begin testing specific workflows.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold">2</div>
              <p className="text-blue-800">Use the token switcher in the sidebar to change authorization scopes and test different user roles.</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold">3</div>
              <p className="text-blue-800">Use the provided pre-filled examples for quick testing or modify the JSON directly.</p>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-sm font-bold">4</div>
              <p className="text-blue-800">All requests are sent directly to the live FPAS API, so you can see real-time results.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-4 text-sm text-gray-500">
        <span>API Base: {process.env.NEXT_PUBLIC_FHIR_BASE}</span>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Live
        </span>
      </div>
    </div>
  );
}