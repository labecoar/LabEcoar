import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertCircle, Info, Bell, Clock3, CalendarClock, PartyPopper, Send, ShieldAlert } from "lucide-react";
import { C } from "@/lib/theme";

const NOTIFICATION_ICONS = {
  task_available: Bell,
  task_due_soon: Clock3,
  task_metrics_due_soon: CalendarClock,
  metrics_send_reminder: Send,
  task_completed: PartyPopper,
  candidatura_aprovada: CheckCircle2,
  candidatura_rejeitada: XCircle,
  submissao_aprovada: CheckCircle2,
  submissao_rejeitada: XCircle,
  tarefa_expirando: AlertCircle,
  admin_application_review_due: ShieldAlert,
  admin_proof_review_due: ShieldAlert,
  admin_metrics_review_due: ShieldAlert,
  info: Info
};

const NOTIFICATION_COLORS = {
  task_available: { color: C.lime, bg: C.lime_back },
  task_due_soon: { color: C.orange, bg: C.orange_back },
  task_metrics_due_soon: { color: C.orange, bg: C.orange_back },
  metrics_send_reminder: { color: C.blue, bg: C.blue_back },
  task_completed: { color: C.lime, bg: C.lime_back },
  candidatura_aprovada: { color: C.lime, bg: C.lime_back },
  candidatura_rejeitada: { color: C.red, bg: C.red_back },
  submissao_aprovada: { color: C.lime, bg: C.lime_back },
  submissao_rejeitada: { color: C.red, bg: C.red_back },
  tarefa_expirando: { color: C.orange, bg: C.orange_back },
  admin_application_review_due: { color: C.orange, bg: C.orange_back },
  admin_proof_review_due: { color: C.orange, bg: C.orange_back },
  admin_metrics_review_due: { color: C.orange, bg: C.orange_back },
  info: { color: C.lime, bg: C.lime_back }
};

export default function NotificationItem({ notification, onMarkAsRead }) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
  const colors = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.info;

  return (
    <div
      className={`p-4 hover:bg-[rgba(var(--ink),0.05)] cursor-pointer transition-colors ${!notification.is_read ? 'border-l-4' : ''}`}
      style={{
        backgroundColor: C.card,
        borderBottom: `1px solid rgba(var(--ink),0.05)`,
        ...(!notification.is_read ? { borderLeftColor: colors.color } : {}),
      }}
      onClick={onMarkAsRead}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: colors.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: colors.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4
              className={`text-sm ${!notification.is_read ? 'font-bold' : 'font-medium'}`}
              style={{ color: !notification.is_read ? C.cream : `${C.cream}CC` }}
            >
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.color }} />
            )}
          </div>
          <p className="text-sm mb-2" style={{ color: `${C.cream}99` }}>
            {notification.message}
          </p>
          {notification.related_task_title && (
            <p className="text-xs mb-2" style={{ color: colors.color }}>
              📋 {notification.related_task_title}
            </p>
          )}
          <p className="text-xs" style={{ color: `${C.cream}66` }}>
            {format(new Date(notification.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}