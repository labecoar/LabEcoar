import React from "react";
import { Moon, Sun } from "lucide-react";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { C, body } from "@/lib/theme";

export default function ThemeToggle() {
  const { isLight, toggleTheme } = useThemeMode();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const label = isLight ? "Modo Escuro" : "Modo Claro";

  const button = (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      className={`flex items-center rounded-xl transition-all hover:brightness-125 ${collapsed ? "w-8 h-8 justify-center mx-auto" : "w-full justify-start"}`}
      style={{
        gap: collapsed ? 0 : 10,
        padding: collapsed ? 0 : "9px 14px",
        backgroundColor: isLight ? `${C.lime}22` : "rgba(255,255,222,0.07)",
        color: isLight ? C.lime : "rgba(255,255,222,0.7)",
        ...body,
      }}
    >
      {isLight ? <Moon size={14} /> : <Sun size={14} />}
      {!collapsed && (
        <span style={{ fontSize: 12, fontWeight: 600 }}>
          {label}
        </span>
      )}
    </button>
  );

  if (!collapsed || isMobile) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="right" align="center" sideOffset={10} className="px-3">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
