// @ts-nocheck
import React from "react";
import { C, heading, body } from "@/lib/theme";

export function PageShell({ children, className = "" }) {
  return (
    <div className={`min-h-screen ${className}`} style={{ background: C.black, ...body }}>
      {children}
    </div>
  );
}

export function PageHeader({ children, className = "" }) {
  return (
    <div
      className={`hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10 gap-2 min-w-0 ${className}`}
      style={{
        backgroundColor: `${C.black}F5`,
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid rgba(var(--ink),0.05)",
      }}
    >
      {children}
    </div>
  );
}

export function PageContent({ children, className = "", maxWidth = "max-w-6xl" }) {
  return (
    <div className={`px-4 sm:px-6 md:px-8 pt-4 md:pt-7 pb-8 md:pb-10 ${maxWidth} mx-auto w-full min-w-0 ${className}`}>
      {children}
    </div>
  );
}

export function PageHero({ children, className = "" }) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 md:mb-8 ${className}`}>
      {children}
    </div>
  );
}

export function PageTitle({ children, subtitle, className = "" }) {
  return (
    <div className={className}>
      <h1
        className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none"
        style={{ ...heading, color: C.cream }}
      >
        {children}
      </h1>
      {subtitle && (
        <div className="text-sm mt-1.5 md:mt-2" style={{ color: `${C.cream}50` }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

export function PointsBadge({ points }) {
  return (
    <div
      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full shrink-0"
      style={{ backgroundColor: C.lime, color: C.onAccent }}
    >
      <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{points} pts</span>
    </div>
  );
}
