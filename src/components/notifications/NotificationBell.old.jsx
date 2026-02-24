import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import NotificationItem from "./NotificationItem";

export default function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: currentUser } = useQuery({
    queryKey: ['current-user'],
    queryFn: () => base44.auth.me(),
  });

  const { data: notifications } = useQuery({
    queryKey: ['notifications', currentUser?.email],
    queryFn: async () => {
      if (!currentUser?.email) return [];
      return base44.entities.Notification.filter(
        { user_email: currentUser.email },
        '-created_date',
        50
      );
    },
    enabled: !!currentUser?.email,
    initialData: [],
    refetchInterval: 30000, // Refetch a cada 30 segundos
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId) => {
      await base44.entities.Notification.update(notificationId, {
        is_read: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const unreadNotifications = notifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(n => 
          base44.entities.Notification.update(n.id, { is_read: true })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          style={{ color: '#3c0b14' }}
        >
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge
              className="absolute -top-1 -right-1 w-5 h-5 flex items-center justify-center p-0 text-xs border-2 border-white"
              style={{ background: '#ce161c', color: 'white' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 border-b" style={{ borderColor: '#096e4c20' }}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold" style={{ color: '#3c0b14' }}>Notificações</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                className="text-xs"
                style={{ color: '#096e4c' }}
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="w-12 h-12 mx-auto mb-2" style={{ color: '#929292' }} />
              <p className="text-sm" style={{ color: '#929292' }}>Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#096e4c10' }}>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsReadMutation.mutate(notification.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}