import React from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";
import { C, body } from "@/lib/theme";

export default function ThemeToggle({ collapsed = false }) {
  const { mode, toggleTheme, isLight } = useThemeMode();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      title={isLight ? "Ativar modo noite" : "Ativar modo dia"}
      aria-label={isLight ? "Ativar modo noite" : "Ativar modo dia"}
      className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 hover:bg-white/10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
      style={{
        color: "rgba(255,255,255,0.85)",
        ...body,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {isLight ? (
        <Moon className="w-4 h-4 shrink-0" />
      ) : (
        <Sun className="w-4 h-4 shrink-0" style={{ color: C.lime }} />
      )}
      <span className="group-data-[collapsible=icon]:hidden truncate">
        {collapsed ? null : isLight ? "Modo noite" : "Modo dia"}
      </span>
      {!collapsed && (
        <span
          className="ml-auto group-data-[collapsible=icon]:hidden text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-md"
          style={{
            background: isLight ? "rgba(255,255,255,0.15)" : C.lime,
            color: isLight ? "#fff" : C.onAccent,
            fontWeight: 700,
          }}
        >
          {mode === "light" ? "dia" : "noite"}
        </span>
      )}
    </button>
  );
}
