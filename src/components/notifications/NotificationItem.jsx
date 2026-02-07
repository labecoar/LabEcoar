import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertCircle, Info } from "lucide-react";

const NOTIFICATION_ICONS = {
  candidatura_aprovada: CheckCircle2,
  candidatura_rejeitada: XCircle,
  submissao_aprovada: CheckCircle2,
  submissao_rejeitada: XCircle,
  tarefa_expirando: AlertCircle,
  info: Info
};

const NOTIFICATION_COLORS = {
  candidatura_aprovada: { bg: '#00c33110', color: '#00c331', border: '#00c33130' },
  candidatura_rejeitada: { bg: '#ce161c10', color: '#ce161c', border: '#ce161c30' },
  submissao_aprovada: { bg: '#00c33110', color: '#00c331', border: '#00c33130' },
  submissao_rejeitada: { bg: '#ce161c10', color: '#ce161c', border: '#ce161c30' },
  tarefa_expirando: { bg: '#ff6a2d10', color: '#ff6a2d', border: '#ff6a2d30' },
  info: { bg: '#0077ad10', color: '#0077ad', border: '#0077ad30' }
};

export default function NotificationItem({ notification, onMarkAsRead }) {
  const Icon = NOTIFICATION_ICONS[notification.type] || Info;
  const colors = NOTIFICATION_COLORS[notification.type] || NOTIFICATION_COLORS.info;

  return (
    <div
      className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors ${!notification.is_read ? 'border-l-4' : ''}`}
      style={!notification.is_read ? { borderColor: colors.color } : {}}
      onClick={onMarkAsRead}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: colors.bg }}
        >
          <Icon className="w-5 h-5" style={{ color: colors.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h4 className={`text-sm ${!notification.is_read ? 'font-bold' : 'font-medium'}`} style={{ color: '#3c0b14' }}>
              {notification.title}
            </h4>
            {!notification.is_read && (
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.color }} />
            )}
          </div>
          <p className="text-sm mb-2" style={{ color: '#929292' }}>
            {notification.message}
          </p>
          {notification.related_task_title && (
            <p className="text-xs mb-2" style={{ color: '#096e4c' }}>
              📋 {notification.related_task_title}
            </p>
          )}
          <p className="text-xs" style={{ color: '#929292' }}>
            {format(new Date(notification.created_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>
      </div>
    </div>
  );
}