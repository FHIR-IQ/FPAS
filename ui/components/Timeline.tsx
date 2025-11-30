"use client";

import { Check, Clock, AlertCircle, XCircle } from "lucide-react";
import { clsx } from "clsx";

export interface TimelineEvent {
  stage: string;
  timestamp: Date;
  status: "pending" | "in_progress" | "completed" | "error";
  details?: string;
}

export interface TimelineProps {
  events: TimelineEvent[];
}

export function Timeline({ events }: TimelineProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No events yet. Submit a request to see the timeline.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;

        return (
          <div key={idx} className="relative">
            {/* Connector line */}
            {!isLast && (
              <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-gray-300" />
            )}

            {/* Event card */}
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="relative flex-shrink-0">
                <EventIcon status={event.status} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-3">
                  <h4 className="font-semibold text-gray-900">
                    {event.stage}
                  </h4>
                  <span className="text-xs text-gray-500">
                    {formatTimestamp(event.timestamp)}
                  </span>
                </div>

                {event.details && (
                  <p className="text-sm text-gray-600 mt-1">{event.details}</p>
                )}

                {/* Status badge */}
                <div className="mt-2">
                  <StatusBadge status={event.status} />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EventIcon({ status }: { status: TimelineEvent["status"] }) {
  const iconClasses = "h-8 w-8 rounded-full flex items-center justify-center";

  switch (status) {
    case "completed":
      return (
        <div className={clsx(iconClasses, "bg-green-100 text-green-600")}>
          <Check className="h-5 w-5" />
        </div>
      );
    case "in_progress":
      return (
        <div className={clsx(iconClasses, "bg-blue-100 text-blue-600")}>
          <Clock className="h-5 w-5 animate-pulse" />
        </div>
      );
    case "error":
      return (
        <div className={clsx(iconClasses, "bg-red-100 text-red-600")}>
          <XCircle className="h-5 w-5" />
        </div>
      );
    case "pending":
    default:
      return (
        <div className={clsx(iconClasses, "bg-gray-100 text-gray-400")}>
          <Clock className="h-5 w-5" />
        </div>
      );
  }
}

function StatusBadge({ status }: { status: TimelineEvent["status"] }) {
  const baseClasses =
    "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";

  switch (status) {
    case "completed":
      return (
        <span className={clsx(baseClasses, "bg-green-100 text-green-800")}>
          Completed
        </span>
      );
    case "in_progress":
      return (
        <span className={clsx(baseClasses, "bg-blue-100 text-blue-800")}>
          In Progress
        </span>
      );
    case "error":
      return (
        <span className={clsx(baseClasses, "bg-red-100 text-red-800")}>
          Error
        </span>
      );
    case "pending":
    default:
      return (
        <span className={clsx(baseClasses, "bg-gray-100 text-gray-800")}>
          Pending
        </span>
      );
  }
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) {
    return `${diffSecs}s ago`;
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else {
    return date.toLocaleTimeString();
  }
}