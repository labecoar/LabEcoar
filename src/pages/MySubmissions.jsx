// @ts-nocheck
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useMySubmissions } from '@/hooks/useSubmissions';
import { useMyMetricsSubmissions } from '@/hooks/useMetrics';
import { useUserScore } from '@/hooks/useScores';
import {
  Activity, Search, Target, ChevronLeft, ChevronRight,
  ArrowUpDown, Eye, XCircle, Star, Plus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import TaskDetailsModal from '@/components/tasks/TaskDetailsModal';
import {
  CATEGORY_NAMES,
  ACTIVE_USER_CATEGORIES,
  USER_STATUS_FILTER_OPTIONS,
  USER_BUCKET_FILTER_OPTIONS,
  getSubmissionTaskId,
  normalizeSubmissionStatus,
  getUserSubmissionStatusDisplay,
  resolveNextDeadline,
  getDeadlineState,
  isPendingSubmission,
  isCompletedSubmission,
  isRejectedSubmission,
  isExpiredSubmission,
} from '@/lib/task-submission-display';
import { C, heading, body } from '@/lib/theme';
import { createPageUrl } from '@/utils';

const PAGE_SIZE = 10;

const aInputCls = 'w-full px-4 py-2.5 rounded-xl outline-none transition-all';
const aInputStyle = {
  border: '1px solid rgba(var(--ink),0.12)',
  backgroundColor: 'rgba(var(--ink),0.04)',
  color: C.cream,
  fontSize: 13,
  ...body,
};
const aSelectStyle = {
  ...aInputStyle,
  cursor: 'pointer',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23FFFFDE' stroke-width='2' stroke-opacity='0.4'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
};

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

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between px-6 py-4" style={{ borderTop: '1px solid rgba(var(--ink),0.07)' }}>
      <span style={{ fontSize: 12, color: `${C.cream}50` }}>
        Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
          style={{ border: '1px solid rgba(var(--ink),0.12)', color: C.cream }}
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="h-8 w-8 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
          style={{ border: '1px solid rgba(var(--ink),0.12)', color: C.cream }}
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

function SortButton({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="inline-flex items-center gap-1 hover:opacity-80 transition-opacity"
      style={{ color: active ? C.lime : `${C.cream}40`, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em' }}
    >
      {label}
      <ArrowUpDown size={10} style={{ opacity: active ? 1 : 0.4, transform: active && sortDir === 'asc' ? 'rotate(180deg)' : 'none' }} />
    </button>
  );
}

export default function MySubmissions() {
  const navigate = useNavigate();
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [bucketFilter, setBucketFilter] = useState('andamento');
  const [statusDetailFilter, setStatusDetailFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ field: 'created_at', dir: 'desc' });
  const { user } = useAuth();
  const { data: submissions = [], isLoading, error } = useMySubmissions(user?.id);
  const { data: myMetricsSubmissions = [] } = useMyMetricsSubmissions(user?.id);
  const { data: userScore } = useUserScore(user?.id);

  const getMetricsSubmission = (taskId) =>
    myMetricsSubmissions.find((item) => String(item.task_id) === String(taskId)) || null;

  const enrichedSubmissions = useMemo(() => {
    return submissions.map((submission) => {
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
  }, [submissions, myMetricsSubmissions]);

  const overview = useMemo(() => ({
    total: enrichedSubmissions.length,
    pending: enrichedSubmissions.filter(({ submission, metricsSubmission }) =>
      isPendingSubmission(submission, metricsSubmission)).length,
    completed: enrichedSubmissions.filter(({ submission, metricsSubmission }) =>
      isCompletedSubmission(submission, metricsSubmission)).length,
    rejected: enrichedSubmissions.filter(({ submission, metricsSubmission }) =>
      isRejectedSubmission(submission, metricsSubmission)).length,
    expired: enrichedSubmissions.filter(({ submission, metricsSubmission }) =>
      isExpiredSubmission(submission, metricsSubmission)).length,
    points: enrichedSubmissions
      .filter(({ submission, metricsSubmission }) => isCompletedSubmission(submission, metricsSubmission))
      .reduce((acc, { submission }) => acc + (Number(submission.points_awarded || submission.task?.points) || 0), 0),
  }), [enrichedSubmissions]);

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    let result = enrichedSubmissions.filter((row) => {
      if (bucketFilter !== 'todas' && row.statusDisplay.bucket !== bucketFilter) return false;
      if (statusDetailFilter !== 'all' && row.statusDisplay.key !== statusDetailFilter) return false;
      if (categoryFilter !== 'all' && row.task?.category !== categoryFilter) return false;
      if (!term) return true;
      const haystack = [row.task?.title, row.task?.description, CATEGORY_NAMES[row.task?.category], row.statusDisplay.label]
        .filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) => {
      switch (sort.field) {
        case 'title':
          return dir * String(a.task?.title || '').localeCompare(String(b.task?.title || ''), 'pt-BR');
        case 'category':
          return dir * String(CATEGORY_NAMES[a.task?.category] || '').localeCompare(String(CATEGORY_NAMES[b.task?.category] || ''), 'pt-BR');
        case 'deadline': {
          const aTime = a.nextDeadline ? new Date(a.nextDeadline).getTime() : 0;
          const bTime = b.nextDeadline ? new Date(b.nextDeadline).getTime() : 0;
          return dir * (aTime - bTime);
        }
        case 'reward':
          return dir * ((Number(a.task?.points) || Number(a.task?.offered_value) || 0) - (Number(b.task?.points) || Number(b.task?.offered_value) || 0));
        default:
          return dir * (new Date(a.submission.created_at).getTime() - new Date(b.submission.created_at).getTime());
      }
    });

    return result;
  }, [enrichedSubmissions, search, categoryFilter, bucketFilter, statusDetailFilter, sort]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const paginatedRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      dir: prev.field === field && prev.dir === 'desc' ? 'asc' : 'desc',
    }));
    setPage(1);
  };

  const isTaskClaimed = (submission) => {
    const status = normalizeSubmissionStatus(submission?.status);
    return ['application_pending', 'application_approved', 'proof_pending', 'pending'].includes(status);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: C.black }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: C.lime }} />
          <p style={{ color: `${C.cream}50` }}>Carregando suas tarefas...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: C.black }}>
        <div className="max-w-md p-8 rounded-2xl text-center" style={{ backgroundColor: C.card, border: '1px solid rgba(255,34,85,0.2)' }}>
          <XCircle size={36} style={{ color: '#f87171', margin: '0 auto 16px' }} />
          <h2 style={{ ...heading, fontSize: 20, fontWeight: 800, color: C.cream }} className="mb-2">Erro ao carregar</h2>
          <p style={{ color: `${C.cream}60`, fontSize: 14 }}>{error?.message || 'Não foi possível carregar suas tarefas agora.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.black, ...body }}>
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 md:px-8 py-3 md:py-4 sticky top-0 z-10"
        style={{ backgroundColor: `${C.black}F5`, backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(var(--ink),0.05)' }}>
        <div className="flex items-center gap-3">
          <Activity size={16} style={{ color: C.lime }} />
          <span style={{ ...heading, fontSize: 12, fontWeight: 700, color: `${C.cream}60`, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Minhas Tarefas
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ backgroundColor: C.lime, color: C.onAccent }}>
            <Star size={11} fill={C.onAccent} />
            <span style={{ ...heading, fontSize: 12, fontWeight: 800 }}>{userScore?.total_points || 0} pts</span>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 pt-4 md:pt-7 pb-8 md:pb-10 max-w-7xl mx-auto w-full min-w-0 space-y-5 md:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight leading-none" style={{ ...heading, color: C.cream }}>
              Minhas Tarefas
            </h1>
            <p className="text-sm mt-1.5 md:mt-2 leading-relaxed" style={{ color: `${C.cream}50` }}>
              Acompanhe suas inscrições, prazos e status — visão completa das suas participações.
            </p>
          </div>
          <button
            onClick={() => navigate(createPageUrl('Tasks'))}
            className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110 shrink-0"
            style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
          >
            <Plus size={15} /> Ver tarefas disponíveis
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {[
            { label: 'Total', value: overview.total, color: C.cream },
            { label: 'Em andamento', value: overview.pending, color: C.orange },
            { label: 'Concluídas', value: overview.completed, color: C.lime },
            { label: 'Rejeitadas', value: overview.rejected, color: '#f87171' },
            { label: 'Expiradas', value: overview.expired, color: `${C.cream}60` },
            { label: 'Pontos ganhos', value: overview.points, color: C.lime },
          ].map(({ label, value, color }) => (
            <div key={label} className="p-4 sm:p-5 rounded-2xl" style={{ backgroundColor: 'rgba(var(--ink),0.03)', border: '1px solid rgba(var(--ink),0.06)' }}>
              <div style={{ fontSize: 11, color: `${C.cream}50`, marginBottom: 6 }}>{label}</div>
              <div className="text-xl sm:text-2xl md:text-3xl font-black leading-none tracking-tight" style={{ ...heading, color }}>{value}</div>
            </div>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'rgba(var(--ink),0.02)', border: '1px solid rgba(var(--ink),0.07)' }}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-6 py-4"
            style={{ borderBottom: '1px solid rgba(var(--ink),0.07)' }}>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: C.lime }} />
              <span style={{ ...heading, fontSize: 15, fontWeight: 700, color: C.cream }}>Minhas inscrições</span>
              <span style={{ fontSize: 12, color: `${C.cream}40` }}>{filteredRows.length} exibida(s)</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="relative flex-1 sm:min-w-[200px]">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: `${C.cream}40` }} />
                <input
                  className={aInputCls}
                  style={{ ...aInputStyle, paddingLeft: 34 }}
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  placeholder="Buscar tarefa..."
                />
              </div>
              <select
                className={aInputCls}
                style={{ ...aSelectStyle, minWidth: 140 }}
                value={categoryFilter}
                onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              >
                <option value="all" style={{ backgroundColor: C.card }}>Todas categorias</option>
                {Object.entries(ACTIVE_USER_CATEGORIES).map(([value, label]) => (
                  <option key={value} value={value} style={{ backgroundColor: C.card }}>{label}</option>
                ))}
              </select>
              {(bucketFilter === 'andamento' || bucketFilter === 'todas') && (
                <select
                  className={aInputCls}
                  style={{ ...aSelectStyle, minWidth: 170 }}
                  value={statusDetailFilter}
                  onChange={(e) => { setStatusDetailFilter(e.target.value); setPage(1); }}
                >
                  {USER_STATUS_FILTER_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value} style={{ backgroundColor: C.card }}>{label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 px-6 py-3 overflow-x-auto" style={{ borderBottom: '1px solid rgba(var(--ink),0.07)', scrollbarWidth: 'none' }}>
            {USER_BUCKET_FILTER_OPTIONS.map(({ value, label }) => {
              const active = bucketFilter === value;
              const count = value === 'todas'
                ? enrichedSubmissions.length
                : enrichedSubmissions.filter((row) => row.statusDisplay.bucket === value).length;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => { setBucketFilter(value); setStatusDetailFilter('all'); setPage(1); }}
                  className="shrink-0 px-4 py-2 rounded-xl transition-all duration-150"
                  style={{
                    backgroundColor: active ? C.lime : 'rgba(var(--ink),0.06)',
                    color: active ? C.black : `${C.cream}70`,
                    fontWeight: active ? 700 : 400,
                    ...heading,
                    fontSize: 13,
                  }}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>

          {paginatedRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Target size={32} style={{ color: `${C.cream}20` }} />
              <p style={{ ...heading, fontSize: 16, color: `${C.cream}40` }}>
                {bucketFilter === 'andamento' && statusDetailFilter === 'all'
                  ? 'Nenhuma tarefa em andamento no momento.'
                  : 'Nenhuma tarefa encontrada com esses filtros.'}
              </p>
              {bucketFilter === 'andamento' && statusDetailFilter === 'all' && (
                <button
                  onClick={() => navigate(createPageUrl('Tasks'))}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl transition-all hover:brightness-110"
                  style={{ backgroundColor: C.lime, color: C.onAccent, ...heading, fontWeight: 700, fontSize: 13 }}
                >
                  <Plus size={15} /> Explorar tarefas disponíveis
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(var(--ink),0.06)' }}>
                      <th className="text-left px-5 py-3">
                        <SortButton label="TAREFA" field="title" sortField={sort.field} sortDir={sort.dir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-5 py-3">
                        <SortButton label="CATEGORIA" field="category" sortField={sort.field} sortDir={sort.dir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-5 py-3" style={{ fontSize: 10, fontWeight: 700, color: `${C.cream}40`, letterSpacing: '0.08em' }}>STATUS</th>
                      <th className="text-left px-5 py-3">
                        <SortButton label="PRAZO" field="deadline" sortField={sort.field} sortDir={sort.dir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-5 py-3">
                        <SortButton label="INSCRIÇÃO" field="created_at" sortField={sort.field} sortDir={sort.dir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-5 py-3">
                        <SortButton label="RECOMPENSA" field="reward" sortField={sort.field} sortDir={sort.dir} onSort={handleSort} />
                      </th>
                      <th className="text-left px-5 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row, i) => (
                      <tr
                        key={row.submission.id}
                        style={{
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(var(--ink),0.015)',
                          borderBottom: '1px solid rgba(var(--ink),0.04)',
                        }}
                      >
                        <td className="px-5 py-3">
                          <p style={{ fontWeight: 600, color: C.cream, fontSize: 13 }} className="max-w-[220px] truncate">
                            {row.task?.title || 'Tarefa'}
                          </p>
                          <p style={{ fontSize: 11, color: `${C.cream}40` }}>
                            {row.deadlineState.isExpired
                              ? 'Prazo expirado'
                              : row.deadlineState.timeLabel !== 'Sem data'
                                ? `Restam ${row.deadlineState.timeLabel}`
                                : 'Sem prazo definido'}
                          </p>
                        </td>
                        <td className="px-5 py-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: `${C.lime}12`, color: C.lime }}>
                            {ACTIVE_USER_CATEGORIES[row.task?.category] || CATEGORY_NAMES[row.task?.category] || row.task?.category || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusBadge submission={row.submission} metricsSubmission={row.metricsSubmission} />
                        </td>
                        <td className="px-5 py-3">
                          <p style={{ fontSize: 13, color: row.deadlineState.isCritical ? '#f87171' : row.deadlineState.isWarning ? C.orange : `${C.cream}70` }}>
                            {formatDateTime(row.nextDeadline)}
                          </p>
                        </td>
                        <td className="px-5 py-3" style={{ fontSize: 12, color: `${C.cream}60` }}>
                          {formatShortDate(row.submission.created_at)}
                        </td>
                        <td className="px-5 py-3" style={{ ...heading, fontWeight: 800, color: row.statusDisplay.bucket === 'concluidas' ? C.lime : `${C.cream}50`, fontSize: 13 }}>
                          {row.rewardLabel}
                        </td>
                        <td className="px-5 py-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmission(row.submission)}
                            className="h-8 px-3 rounded-lg flex items-center gap-1.5 transition-all hover:brightness-110"
                            style={{ border: '1px solid rgba(var(--ink),0.12)', backgroundColor: 'transparent', color: `${C.cream}70`, fontSize: 12, fontWeight: 600, ...heading }}
                          >
                            <Eye size={12} /> Detalhes
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </>
          )}
        </div>
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
    </div>
  );
}
