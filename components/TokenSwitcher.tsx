"use client";

import { useState } from "react";
import { User, Building, Server } from "lucide-react";
import { clsx } from "clsx";

export type TokenScope = "patient" | "provider" | "system";

const scopes = [
  {
    id: "patient" as const,
    label: "Patient",
    icon: User,
    token: "mock-patient-token",
    scopes: ["patient/*.read"],
    description: "Single patient access",
  },
  {
    id: "provider" as const,
    label: "Provider",
    icon: Building,
    token: "mock-provider-token",
    scopes: ["user/Claim.read", "user/ClaimResponse.read"],
    description: "Provider attributed patients",
  },
  {
    id: "system" as const,
    label: "System",
    icon: Server,
    token: "mock-system-token",
    scopes: ["system/*.read", "system/*.write"],
    description: "System-to-system access",
  },
];

export function TokenSwitcher() {
  const [activeScope, setActiveScope] = useState<TokenScope>("provider");

  const activeConfig = scopes.find((s) => s.id === activeScope);

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
        Auth Scope
      </div>

      {/* Scope Selector */}
      <div className="space-y-1">
        {scopes.map((scope) => {
          const Icon = scope.icon;
          const isActive = scope.id === activeScope;
          return (
            <button
              key={scope.id}
              onClick={() => setActiveScope(scope.id)}
              className={clsx(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-800"
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{scope.label}</span>
              {isActive && (
                <span className="text-xs bg-blue-500 px-2 py-0.5 rounded">
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Active Token Info */}
      {activeConfig && (
        <div className="mt-4 p-3 bg-gray-800 rounded-md text-xs space-y-2">
          <div className="text-gray-400">Active Token:</div>
          <div className="font-mono text-gray-300 break-all">
            {activeConfig.token}
          </div>
          <div className="text-gray-500 text-[10px]">
            {activeConfig.description}
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {activeConfig.scopes.map((s) => (
              <span
                key={s}
                className="inline-flex items-center px-2 py-0.5 rounded text-[10px] bg-gray-700 text-gray-300"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}