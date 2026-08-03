import { useThemeMode } from '@/contexts/ThemeContext';
import { C, body, heading } from '@/lib/theme';

/** Texto claro sobre fundos escuros fixos (ex.: card verde escuro) */
export const ON_DARK_SURFACE_LABEL = 'rgba(255,255,222,0.75)';
export const ON_DARK_SURFACE_MUTED = 'rgba(255,255,222,0.65)';

export function usePageTheme() {
  const { isLight, T } = useThemeMode();

  const mutedColor = isLight ? T.textMuted : `${C.cream}50`;
  const subColor = isLight ? T.textSub : `${C.cream}60`;
  const faintColor = isLight ? T.textFaint : `${C.cream}40`;
  const labelColor = isLight ? T.textMuted : `${C.cream}45`;
  const textColor = isLight ? T.text : C.cream;
  const borderColor = isLight ? T.border : 'rgba(var(--ink),0.07)';
  const borderMid = isLight ? T.borderMid : 'rgba(var(--ink),0.06)';
  const cardBorder = isLight ? T.border : 'rgba(var(--ink),0.06)';
  const itemBg = isLight ? T.itemBg : 'rgba(var(--ink),0.06)';
  const surfaceBg = isLight ? C.card : 'rgba(var(--ink),0.03)';
  const surfaceBgAlt = isLight ? C.card : 'rgba(var(--ink),0.04)';
  const inputBg = isLight ? C.card : 'rgba(var(--ink),0.04)';

  const selectChevronStroke = isLight ? '%231D1D1B' : '%23FFFFDE';
  const chevronOpacity = isLight ? '0.55' : '0.4';

  const inputStyle = {
    border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`,
    backgroundColor: inputBg,
    color: textColor,
    fontSize: 13,
    ...body,
  };

  const selectStyle = {
    ...inputStyle,
    cursor: 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${selectChevronStroke}' stroke-width='2' stroke-opacity='${chevronOpacity}'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    paddingRight: 32,
  };

  const optionStyle = { backgroundColor: C.card, color: textColor };

  const inactiveTabStyle = {
    backgroundColor: itemBg,
    color: isLight ? T.textSub : `${C.cream}70`,
    fontWeight: 400,
    border: isLight ? `1px solid ${T.border}` : 'none',
  };

  const activeTabStyle = {
    backgroundColor: C.lime,
    color: C.onAccent,
    fontWeight: 700,
    border: 'none',
  };

  const pageTitleStyle = { ...heading, color: textColor };
  const pageSubtitleStyle = { fontSize: 14, color: mutedColor, marginTop: 6 };

  return {
    isLight,
    T,
    mutedColor,
    subColor,
    faintColor,
    labelColor,
    textColor,
    borderColor,
    borderMid,
    cardBorder,
    itemBg,
    surfaceBg,
    surfaceBgAlt,
    inputStyle,
    selectStyle,
    optionStyle,
    inactiveTabStyle,
    activeTabStyle,
    pageTitleStyle,
    pageSubtitleStyle,
  };
}
