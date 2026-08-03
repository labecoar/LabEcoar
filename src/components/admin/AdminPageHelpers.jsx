// @ts-nocheck
import React from 'react';
import { C, heading } from '@/lib/theme';
import { usePageTheme } from '@/hooks/usePageTheme';

export { usePageTheme, ON_DARK_SURFACE_LABEL, ON_DARK_SURFACE_MUTED } from '@/hooks/usePageTheme';

export function AdminAccessDenied({ message = 'Apenas administradores podem acessar esta página.', icon: Icon }) {
  const { textColor, subColor, cardBorder } = usePageTheme();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
      <div className="max-w-md p-8 rounded-2xl text-center" style={{ backgroundColor: C.card, border: `1px solid ${cardBorder}` }}>
        {Icon && <Icon size={36} style={{ color: '#f87171', margin: '0 auto 16px' }} />}
        <h2 style={{ ...heading, fontSize: 20, fontWeight: 800, color: textColor }}>Acesso Negado</h2>
        <p style={{ color: subColor, fontSize: 14 }}>{message}</p>
      </div>
    </div>
  );
}

export function AdminLoading({ label = 'Carregando...' }) {
  const { mutedColor } = usePageTheme();
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
        <p style={{ color: mutedColor }}>{label}</p>
      </div>
    </div>
  );
}

export function AdminEmptyState({ icon: Icon, title, subtitle }) {
  const { faintColor, mutedColor, textColor } = usePageTheme();
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <Icon size={36} style={{ color: faintColor }} />
      <p style={{ ...heading, fontSize: 18, fontWeight: 700, color: mutedColor }}>{title}</p>
      {subtitle && <p style={{ fontSize: 14, color: faintColor }}>{subtitle}</p>}
    </div>
  );
}

export function AdminTabButton({ active, children, ...props }) {
  const { activeTabStyle, inactiveTabStyle } = usePageTheme();
  return (
    <button
      type="button"
      className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
      style={{ ...(active ? activeTabStyle : inactiveTabStyle), ...heading, fontSize: 13 }}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminStatCard({ icon: Icon, label, value, color, iconBg }) {
  const { surfaceBg, cardBorder, mutedColor } = usePageTheme();
  return (
    <div className="flex items-center gap-4 p-5 rounded-2xl" style={{ backgroundColor: surfaceBg, border: `1px solid ${cardBorder}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: iconBg }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div>
        <div style={{ ...heading, fontSize: 28, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 11, color: mutedColor, marginTop: 4 }}>{label}</div>
      </div>
    </div>
  );
}

export function AdminSurfaceBox({ children, className = '', style = {} }) {
  const { surfaceBgAlt, cardBorder } = usePageTheme();
  return (
    <div className={className} style={{ backgroundColor: surfaceBgAlt, border: `1px solid ${cardBorder}`, ...style }}>
      {children}
    </div>
  );
}
