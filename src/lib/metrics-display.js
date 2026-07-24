export const LATE_POSTING_SYSTEM_NOTE =
  '[SISTEMA] Postagem informada fora do prazo planejado. Aplicar análise com plano B da equipe.';

const SYSTEM_NOTE_PREFIX = '[SISTEMA]';

export const parseMetricsDescription = (description) => {
  const raw = String(description || '').trim();
  if (!raw) {
    return { userNotes: null, systemNotes: [] };
  }

  const parts = raw.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const systemNotes = [];
  const userParts = [];

  for (const part of parts) {
    if (part.startsWith(SYSTEM_NOTE_PREFIX)) {
      systemNotes.push(part.replace(SYSTEM_NOTE_PREFIX, '').trim());
    } else {
      userParts.push(part);
    }
  }

  return {
    userNotes: userParts.length > 0 ? userParts.join('\n\n') : null,
    systemNotes,
  };
};

export const hasLatePostingSystemNote = (description) => {
  return String(description || '').includes(LATE_POSTING_SYSTEM_NOTE)
    || parseMetricsDescription(description).systemNotes.some((note) =>
      note.toLowerCase().includes('fora do prazo')
    );
};
