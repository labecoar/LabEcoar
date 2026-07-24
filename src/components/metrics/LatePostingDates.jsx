// @ts-nocheck
import React from 'react';
import { CalendarClock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { C } from '@/lib/theme';

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
};

export default function LatePostingDates({ postingDeadline, postedAt }) {
  const deadlineLabel = formatDateTime(postingDeadline);
  const postedLabel = formatDateTime(postedAt);

  if (!deadlineLabel && !postedLabel) return null;

  return (
    <div className="flex flex-col gap-1.5 mb-3">
      {deadlineLabel && (
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: `${C.cream}55` }}>
          <CalendarClock size={11} style={{ color: `${C.orange}99` }} />
          Prazo de postagem: <strong style={{ color: `${C.cream}80` }}>{deadlineLabel}</strong>
        </span>
      )}
      {postedLabel && (
        <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, color: `${C.cream}55` }}>
          <CalendarClock size={11} style={{ color: `${C.orange}99` }} />
          Postagem informada em: <strong style={{ color: `${C.cream}80` }}>{postedLabel}</strong>
        </span>
      )}
    </div>
  );
}
