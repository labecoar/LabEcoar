// @ts-nocheck
import React from "react";
import { Star } from "lucide-react";
import { C, heading, body } from "@/lib/theme";
import { useThemeMode } from "@/contexts/ThemeContext";

export function usePageHeaderTheme() {
  const { isLight, T } = useThemeMode();

  return {
    isLight,
    T,
    barStyle: {
      backgroundColor: isLight ? `${T.topbar}F8` : `${C.black}F5`,
      backdropFilter: "blur(16px)",
      borderBottom: `1px solid ${isLight ? T.topbarBdr : "rgba(var(--ink),0.05)"}`,
    },
    labelStyle: {
      ...heading,
      fontSize: 12,
      fontWeight: 700,
      color: isLight ? T.accent : `${C.cream}60`,
      letterSpacing: "0.06em",
      textTransform: "uppercase",
    },
    iconColor: isLight ? T.accent : C.lime,
    chipStyle: {
      backgroundColor: isLight ? T.itemBg : "rgba(var(--ink),0.06)",
      color: isLight ? T.textSub : `${C.cream}70`,
    },
  };
}

export function PageShell({ children, className = "" }) {
  return (
    <div className={`min-h-screen ${className}`} style={{ background: C.black, ...body }}>
      {children}
    </div>
  );
}

export function PageHeader({ children, className = "" }) {
  const { barStyle } = usePageHeaderTheme();

  return (
    <div
      className={`hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10 gap-2 min-w-0 ${className}`}
      style={barStyle}
    >
      {children}
    </div>
  );
}

export function PageHeaderLabel({ icon: Icon, children, iconSize = 16, className = "" }) {
  const { labelStyle, iconColor } = usePageHeaderTheme();

  return (
    <div className={`flex items-center gap-2 sm:gap-3 min-w-0 ${className}`}>
      {Icon && <Icon size={iconSize} className="shrink-0" style={{ color: iconColor }} />}
      <span className="truncate" style={labelStyle}>{children}</span>
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
  const { isLight, T } = useThemeMode();

  return (
    <div className={className}>
      <h1
        className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none"
        style={{ ...heading, color: C.cream }}
      >
        {children}
      </h1>
      {subtitle && (
        <div className="text-sm mt-1.5 md:mt-2" style={{ color: isLight ? T.textMuted : `${C.cream}50` }}>
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
      <Star size={11} fill={C.onAccent} className="shrink-0" />
      <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{points} pts</span>
    </div>
  );
}
