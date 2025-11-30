"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FileText,
  ClipboardList,
  Zap,
  Users,
  Database,
  BarChart3,
} from "lucide-react";
import { TokenSwitcher } from "./TokenSwitcher";
import { clsx } from "clsx";

const navigation = [
  { name: "Home", href: "/", icon: Home },
  { name: "PAS Submission", href: "/pas", icon: FileText },
  { name: "DTR Workflow", href: "/dtr", icon: ClipboardList },
  { name: "CDS Hooks", href: "/cds", icon: Zap },
  { name: "Access Viewer", href: "/access", icon: Users },
  { name: "Bulk Export", href: "/bulk", icon: Database },
  { name: "Metrics", href: "/metrics", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex flex-col w-64 bg-gray-900 text-white">
      {/* Header */}
      <div className="flex items-center h-16 px-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">FPAS UI</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-gray-800 text-white"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Token Switcher */}
      <div className="p-4 border-t border-gray-700">
        <TokenSwitcher />
      </div>

      {/* Footer */}
      <div className="px-4 py-3 text-xs text-gray-400 border-t border-gray-700">
        <div>API: {process.env.NEXT_PUBLIC_FHIR_BASE?.split("/fhir")[0]}</div>
        <div className="mt-1">Version 1.0.0</div>
      </div>
    </div>
  );
}