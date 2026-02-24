import React from 'react';
import { Bell } from 'lucide-react';

// Componente temporário - será implementado com Supabase futuramente
export default function NotificationBell() {
  return (
    <button className="relative p-2 hover:bg-gray-100 rounded-full transition-colors">
      <Bell className="w-5 h-5 text-gray-600" />
    </button>
  );
}
