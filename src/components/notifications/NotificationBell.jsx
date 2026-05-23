// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom'
import { Bell, CheckCheck, X } from 'lucide-react';
import NotificationItem from '@/components/notifications/NotificationItem';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useTaskNotifications()
  const [popoverPos, setPopoverPos] = useState(null)

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (!containerRef.current) return
      if (!containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsOpen(false)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const estimatedWidth = Math.min(22 * 16, Math.floor(window.innerWidth * 0.9))
    const estimatedHeight = Math.floor(window.innerHeight * 0.7)

    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow >= estimatedHeight + 16
      ? rect.bottom + 8
      : Math.max(8, rect.top - Math.min(estimatedHeight, rect.top) - 8)

    const left = rect.left + estimatedWidth + 16 <= window.innerWidth
      ? rect.left
      : undefined
    const right = left === undefined ? 8 : undefined

    setPopoverPos({ top, left, right, width: estimatedWidth })
  }, [isOpen])

  const handleNotificationClick = (notificationId) => {
    markAsRead(notificationId)
    setIsOpen(false)
  }

  // ← separar o overlay em variável para usar no portal
  const overlay = isOpen ? (
    <>
      <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40" />
      <div
        className="fixed mt-2 w-[22rem] max-w-[90vw] rounded-2xl border border-gray-200 bg-white shadow-2xl z-50 overflow-hidden"
        style={(() => {
          if (!popoverPos) return { right: 8, top: 0 }
          const s = { top: popoverPos.top + 'px' }
          if (popoverPos.left !== undefined) s.left = popoverPos.left + 'px'
          if (popoverPos.right !== undefined) s.right = popoverPos.right + 'px'
          if (popoverPos.width) s.width = popoverPos.width + 'px'
          return s
        })()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 bg-white">
          <div>
            <p className="text-sm font-semibold text-[#3c0b14]">Notificações</p>
            <p className="text-xs text-gray-500">Tarefas disponíveis e prazos próximos</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
              title="Marcar todas como lidas"
            >
              <CheckCheck className="w-4 h-4" />
              Ler todas
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500"
              aria-label="Fechar notificações"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-white">
          {loading ? (
            <div className="p-4 text-sm text-gray-500">Carregando notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">
              Nenhuma notificação no momento.
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => handleNotificationClick(notification.id)}
              />
            ))
          )}
        </div>
      </div>
    </>
  ) : null

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="relative inline-flex items-center justify-center p-2.5 rounded-full bg-gray-100 transition-colors hover:bg-gray-200"
        aria-label="Abrir notificações"
        aria-expanded={isOpen}
      >
        <Bell className="w-5.5 h-5.5 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6.5 h-6.5 px-1.5 rounded-full bg-[#ce161c] text-white text-[11px] font-bold flex items-center justify-center shadow-md shadow-[#ce161c30] border border-white/60">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* ← Portal renderiza direto no body, fora de qualquer stacking context */}
      {createPortal(overlay, document.body)}
    </div>
  )
}