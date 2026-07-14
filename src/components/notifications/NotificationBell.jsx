// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom'
import { Bell, CheckCheck, X } from 'lucide-react';
import NotificationItem from '@/components/notifications/NotificationItem';
import { useTaskNotifications } from '@/hooks/useTaskNotifications';
import { C } from '@/lib/theme';

export default function NotificationBell() {
  const navigate = useNavigate()
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

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id)

    navigate(notification.link_path || '/Tasks')

    setIsOpen(false)
  }

  const overlay = isOpen ? (
    <>
      <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-40" />
      <div
        className="fixed mt-2 w-[22rem] max-w-[90vw] rounded-2xl border border-white/10 bg-white shadow-2xl z-50 overflow-hidden"
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
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-black">
          <div>
            <p className="text-sm font-extrabold text-white font-size-16">Notificações</p>
            <p className="text-xs text-white/60">
              {unreadCount > 0 ? `${unreadCount} não lidas` : 'Tudo em dia por aqui'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={markAllAsRead}
              className="inline-flex items-center gap-1 text-xs font-medium hover:text-emerald-400"
              title="Marcar todas como lidas"
              style={{ color: C.lime }}
            >
              <CheckCheck className="w-4 h-4" />
              Ler todas
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/60"
              aria-label="Fechar notificações"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto bg-black">
          {loading ? (
            <div className="p-4 text-sm text-white/50">Carregando notificações...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-white/50">
              Nenhuma notificação no momento.
            </div>
          ) : (
            notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={() => handleNotificationClick(notification)}
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
        className="relative inline-flex items-center justify-center p-2.5 rounded-full transition-colors hover:opacity-80"
        style={{ backgroundColor: C.overlay }}
        aria-label="Abrir notificações"
        aria-expanded={isOpen}
      >
        <Bell className="w-5.5 h-5.5" style={{ color: C.cream }} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-6.5 h-6.5 px-1.5 rounded-full bg-[#ce161c] text-white text-[11px] font-bold flex items-center justify-center shadow-md shadow-[#ce161c30] border border-white/60">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {createPortal(overlay, document.body)}
    </div>
  )
}