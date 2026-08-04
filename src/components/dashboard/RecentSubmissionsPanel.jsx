// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { Eye, ArrowUpRight, Target } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TaskDetailsModal from '@/components/tasks/TaskDetailsModal';
import {
  ACTIVE_USER_CATEGORIES,
  CATEGORY_NAMES,
  getCategoryStyle,
  getSubmissionTaskId,
  getUserSubmissionStatusDisplay,
  normalizeSubmissionStatus,
  resolveNextDeadline,
  getDeadlineState,
  isSubmissionReopenedByDateChange,
} from '@/lib/task-submission-display';
import { C, heading, getModalBackground } from '@/lib/theme';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useThemeMode } from '@/contexts/ThemeContext';

const RECENT_LIMIT = 5;

const formatShortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, 'dd/MM/yyyy', { locale: ptBR });
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return format(date, "dd/MM/yy 'às' HH:mm", { locale: ptBR });
};

function StatusBadge({ submission, metricsSubmission }) {
  const { label, bg, color } = getUserSubmissionStatusDisplay(submission, metricsSubmission);
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: bg, color }}>
      {label}
    </span>
  );
}

function resolveRejectionReason(submission, metricsSubmission) {
  const submissionStatus = normalizeSubmissionStatus(submission?.status);
  if (['application_rejected', 'rejected', 'script_rejected'].includes(submissionStatus)) {
    if (isSubmissionReopenedByDateChange(submission?.task, submission)) return null;
    const reason = String(submission?.rejection_reason || '').trim();
    if (reason) return reason;
  }
  if (String(metricsSubmission?.status || '').trim().toLowerCase() === 'rejected') {
    const reason = String(metricsSubmission?.rejection_reason || '').trim();
    if (reason) return reason;
  }
  return null;
}

function RejectionReasonTrigger({ reason }) {
  const { isLight, T } = useThemeMode();
  const trimmed = String(reason || '').trim();
  if (!trimmed) return null;

  const borderColor = isLight ? T.border : 'rgba(var(--ink),0.12)';
  const textColor = isLight ? T.text : C.cream;
  const surfaceBg = getModalBackground(isLight);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all hover:brightness-110"
          style={{ border: `1px solid ${borderColor}`, backgroundColor: 'transparent', color: '#f87171' }}
          title="Ver motivo da rejeição"
        >
          <Eye size={12} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" side="left" className="w-80 border-0 bg-transparent p-0 shadow-xl">
        <div className="rounded-xl p-4" style={{ backgroundColor: surfaceBg, border: `1px solid ${borderColor}` }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#f87171', letterSpacing: '0.05em', marginBottom: 8 }}>
            MOTIVO DA REJEIÇÃO
          </p>
          <p className="whitespace-pre-wrap" style={{ fontSize: 13, color: textColor, lineHeight: 1.5 }}>
            {trimmed}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function RecentSubmissionsPanel({ submissions = [], metricsSubmissions = [], onViewAll }) {
  const { isLight, T } = useThemeMode();
  const [selectedSubmission, setSelectedSubmission] = useState(null);

  const mutedColor = isLight ? T.textMuted : `${C.cream}50`;
  const subColor = isLight ? T.textSub : `${C.cream}60`;
  const faintColor = isLight ? T.textFaint : `${C.cream}40`;

  const getMetricsSubmission = (taskId) =>
    metricsSubmissions.find((item) => String(item.task_id) === String(taskId)) || null;

  const recentRows = useMemo(() => {
    return [...submissions]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, RECENT_LIMIT)
      .map((submission) => {
        const taskId = getSubmissionTaskId(submission);
        const metricsSubmission = taskId ? getMetricsSubmission(taskId) : null;
        const task = submission.task;
        const nextDeadline = resolveNextDeadline(task, submission, metricsSubmission);
        const deadlineState = getDeadlineState(nextDeadline);
        const statusDisplay = getUserSubmissionStatusDisplay(submission, metricsSubmission);
        const isPaid = task?.category === 'campanha' || Number(task?.offered_value || 0) > 0;
        const rewardLabel = isPaid
          ? `R$ ${Number(task?.offered_value || 0).toLocaleString('pt-BR')}`
          : `${Number(task?.points || 0).toLocaleString('pt-BR')} pts`;

        return {
          submission,
          task,
          metricsSubmission,
          nextDeadline,
          deadlineState,
          statusDisplay,
          rewardLabel,
        };
      });
  }, [submissions, metricsSubmissions]);

  const isTaskClaimed = (submission) => {
    const status = normalizeSubmissionStatus(submission?.status);
    return ['application_pending', 'application_approved', 'script_pending', 'script_approved', 'script_rejected', 'proof_pending', 'pending'].includes(status);
  };

  return (
    <>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: isLight ? C.card : 'rgba(var(--ink),0.02)',
          border: `1px solid ${isLight ? T.borderMid : 'rgba(var(--ink),0.07)'}`,
        }}
      >
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4"
          style={{ borderBottom: '1px solid rgba(var(--ink),0.07)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: C.lime }} />
            <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Submissões Recentes</span>
            <span style={{ fontSize: 12, color: faintColor }}>{recentRows.length} exibida(s)</span>
          </div>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="flex items-center gap-1 transition-opacity hover:opacity-100 opacity-65 shrink-0 self-start sm:self-auto"
              style={{ fontSize: 12, color: isLight ? T.accent : C.lime, ...heading, fontWeight: 600 }}
            >
              Ver todas <ArrowUpRight size={12} />
            </button>
          )}
        </div>

        {recentRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Target size={28} style={{ color: `${C.cream}20` }} />
            <p style={{ ...heading, fontSize: 14, color: isLight ? T.textMuted : `${C.cream}40` }}>
              Nenhuma submissão recente.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(var(--ink),0.06)' }}>
                  {['TAREFA', 'CATEGORIA', 'STATUS', 'PRAZO', 'INSCRIÇÃO', 'RECOMPENSA', ''].map((label) => (
                    <th
                      key={label || 'actions'}
                      className="text-left px-4 sm:px-5 py-3"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: isLight ? T.textFaint : `${C.cream}40`,
                        letterSpacing: '0.08em',
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentRows.map((row, i) => {
                  const { color: catColor, bg: catBg } = getCategoryStyle(row.task?.category);
                  return (
                    <tr
                      key={row.submission.id}
                      style={{
                        backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(var(--ink),0.015)',
                        borderBottom: '1px solid rgba(var(--ink),0.04)',
                      }}
                    >
                      <td className="px-4 sm:px-5 py-3">
                        <p style={{ fontWeight: 600, color: C.cream, fontSize: 13 }} className="max-w-[220px] truncate">
                          {row.task?.title || 'Tarefa'}
                        </p>
                        <p style={{ fontSize: 11, color: faintColor }}>
                          {row.deadlineState.isExpired
                            ? 'Prazo expirado'
                            : row.deadlineState.timeLabel !== 'Sem data'
                              ? `Restam ${row.deadlineState.timeLabel}`
                              : 'Sem prazo definido'}
                        </p>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap" style={{ backgroundColor: catBg, color: catColor }}>
                          {ACTIVE_USER_CATEGORIES[row.task?.category] || CATEGORY_NAMES[row.task?.category] || row.task?.category || '—'}
                        </span>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <StatusBadge submission={row.submission} metricsSubmission={row.metricsSubmission} />
                          <RejectionReasonTrigger reason={resolveRejectionReason(row.submission, row.metricsSubmission)} />
                        </div>
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <p style={{ fontSize: 13, color: row.deadlineState.isCritical ? '#f87171' : row.deadlineState.isWarning ? C.orange : (isLight ? T.textSub : `${C.cream}70`) }}>
                          {formatDateTime(row.nextDeadline)}
                        </p>
                      </td>
                      <td className="px-4 sm:px-5 py-3" style={{ fontSize: 12, color: subColor }}>
                        {formatShortDate(row.submission.created_at)}
                      </td>
                      <td className="px-4 sm:px-5 py-3" style={{ ...heading, fontWeight: 800, color: row.statusDisplay.bucket === 'concluidas' ? (isLight ? C.darkGreen : C.lime) : mutedColor, fontSize: 13 }}>
                        {row.rewardLabel}
                      </td>
                      <td className="px-4 sm:px-5 py-3">
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(row.submission)}
                          className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110 whitespace-nowrap"
                          style={{ border: `1px solid ${isLight ? T.border : 'rgba(var(--ink),0.12)'}`, backgroundColor: 'transparent', color: isLight ? T.textSub : `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                        >
                          <Eye size={12} /> Detalhes
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedSubmission && (
        <TaskDetailsModal
          task={selectedSubmission.task || { id: selectedSubmission.task_id, title: 'Tarefa' }}
          onClose={() => setSelectedSubmission(null)}
          isTaskClaimed={isTaskClaimed(selectedSubmission)}
          isTaskApproved={normalizeSubmissionStatus(selectedSubmission.status) === 'approved'}
          currentSubmission={selectedSubmission}
        />
      )}
    </>
  );
}
