// @ts-nocheck
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { LayoutDashboard, Target, FileCheck, Trophy, LogOut, Shield, User, Users, MessageSquare, Gift, CreditCard, DollarSign, BarChart3, ShieldCheck, HelpCircle, Activity } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useThemeMode } from "@/contexts/ThemeContext";
import { useUserScore, useGroupProgress } from "@/hooks/useScores";
import logoCuica from "@/assets/images/cuica_lab.png";
import NotificationBell from "@/components/notifications/NotificationBell";
import ThemeToggle from "@/components/ThemeToggle";
import { C, heading, body } from '@/lib/theme'
import { useQuery } from "@tanstack/react-query";
import { adminUsersService } from "@/services/admin-users.service";
import { useAdminTasks } from "@/hooks/useTasks";
import { getGroupCategory } from "@/components/dashboard/GroupProgress";
import { getCurrentQuarterKey } from "@/services/scores.service";
import { useForumUnread } from "@/hooks/useForumUnread";
import { useForumRealtime } from "@/hooks/useForumRealtime";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const isTaskExpired = (task) => {
  if (!task?.expires_at) return false;
  return new Date(task.expires_at).getTime() < Date.now();
};

const navigationItems = [
  {
    title: "Dashboard",
    url: createPageUrl("Dashboard"),
    icon: LayoutDashboard,
  },
  {
    title: "Tarefas Disponíveis",
    url: createPageUrl("Tasks"),
    icon: Target,
  },
  {
    title: "Minhas Submissões",
    url: createPageUrl("MySubmissions"),
    icon: FileCheck,
  },
  {
    title: "Fórum",
    url: createPageUrl("Forum"),
    icon: MessageSquare,
    showUnreadDot: true,
  },
  {
    title: "Recompensas",
    url: createPageUrl("Rewards"),
    icon: Gift,
  },
  {
    title: "Meus Pagamentos",
    url: createPageUrl("MyPayments"),
    icon: CreditCard,
  },
  {
    title: "Perfil",
    url: createPageUrl("Profile"),
    icon: User,
  },
  {
    title: "FAQ",
    url: createPageUrl("FAQ"),
    icon: HelpCircle,
  },
];

const adminNavigationItems = [
  {
    title: "Gerenciar Conteúdo",
    url: createPageUrl("AdminContentManagement"),
    icon: Target,
  },
  {
    title: "Usuários",
    url: createPageUrl("AdminUsers"),
    icon: Users,
  },
  {
    title: "Monitoramento",
    url: createPageUrl("AdminMonitoring"),
    icon: Activity,
  },
  {
    title: "Fórum",
    url: createPageUrl("Forum"),
    icon: MessageSquare,
    showUnreadDot: true,
  },
  {
    title: "Seleção",
    url: createPageUrl("AdminApplications"),
    icon: User,
  },
  {
    title: "Aprovação",
    url: createPageUrl("AdminApproval"),
    icon: Shield,
  },

  {
    title: "Métricas",
    url: createPageUrl("AdminMetrics"),
    icon: BarChart3,
  },
  {
    title: "Pagamentos",
    url: createPageUrl("AdminPayments"),
    icon: DollarSign,
  },
  {
    title: "Recompensas",
    url: createPageUrl("AdminRewards"),
    icon: Gift,
  },
  {
    title: "Resgates de Recompensas",
    url: createPageUrl("AdminRewardClaims"),
    icon: Gift,
  },
  {
    title: "Ranking",
    url: createPageUrl("Leaderboard"),
    icon: Trophy,
  },
  {
    title: "FAQ",
    url: createPageUrl("FAQ"),
    icon: HelpCircle,
  },
];

function NavigationMenu({ items, isNavItemActive, hasForumUnread = false }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title} className="group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:justify-center">
          <SidebarMenuButton
            asChild
            className={`hover:bg-[#096e4c10] transition-all duration-200 rounded-xl mb-1 ${isNavItemActive(item.url) ? 'text-black shadow-md' : 'text-white'
              }`}
            style={isNavItemActive(item.url) ? {
              background: C.lime
            } : {}}
          >
            <Link
              to={item.url}
              className="flex items-center gap-3 px-4 py-2.5 w-full group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 relative"
              onClick={handleNavigationClick}
            >
              <span className="relative inline-flex shrink-0">
                <item.icon className="w-4 h-4" />
                {item.showUnreadDot && hasForumUnread && (
                  <span
                    className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: "#ce161c",
                      boxShadow: "0 0 0 2px rgba(0,0,255,0.9)",
                    }}
                    aria-label="Novidades no fórum"
                  />
                )}
              </span>
              <span
                className="group-data-[collapsible=icon]:hidden"
                style={{
                  fontSize: 13,
                  fontWeight: isNavItemActive(item.url) ? 700 : 400,
                }}
              >
                {item.title}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </SidebarMenu>
  );
}

function MobileSidebarAutoCloseOnRouteChange({ pathname }) {
  const { isMobile, setOpenMobile } = useSidebar();

  React.useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, pathname, setOpenMobile]);

  return null;
}

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { mode, colors } = useThemeMode();
  const { hasUnread: hasForumUnread } = useForumUnread();
  useForumRealtime(!!user?.id);
  const { data: userScore } = useUserScore(user?.id);
  const visibleNavigationItems = isAdmin ? adminNavigationItems : navigationItems;
  const landingPageUrl = currentPageName ? createPageUrl(currentPageName) : null;

  // Controla a sidebar no desktop: fechada (só ícones) por padrão, expande no hover.
  // No mobile o comportamento continua sendo o padrão do Sheet (openMobile / setOpenMobile).
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const closeTimeoutRef = React.useRef(null);

  const handleSidebarMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setSidebarOpen(true);
  };

  const handleSidebarMouseLeave = () => {
    closeTimeoutRef.current = setTimeout(() => {
      setSidebarOpen(false);
    }, 400); // tempo (ms) parado fora da sidebar antes de minimizar
  };

  React.useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  // Chamadas de hooks devem ficar obrigatoriamente dentro do componente
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersService.listUsers(),
    enabled: !!isAdmin // Evita buscar a lista de usuários para não-admins
  });
  const { data: tasks } = useAdminTasks();

  // Progresso do GRUPO (substitui a categoria individual na sidebar)
  const currentQuarter = getCurrentQuarterKey();
  const { data: groupProgress } = useGroupProgress(currentQuarter);
  const collectivePoints = groupProgress?.collective_points || 0;
  const activeEcoantes = groupProgress?.active_ecoantes || 0;
  const groupProgressPct = Math.round(groupProgress?.progress_percentage || 0);
  const groupCategory = getGroupCategory(collectivePoints, activeEcoantes || 1);

  const activeUsers = users?.filter(u => u.is_active !== false).length ?? 0;
  const activeTasks = tasks?.filter(t => t.status === 'active' && !isTaskExpired(t)).length ?? 0;

  const isNavItemActive = (itemUrl) => {
    if (location.pathname === itemUrl) return true;
    if (location.pathname === '/' && landingPageUrl && itemUrl === landingPageUrl) return true;
    // Mantém Fórum ativo ao abrir um tópico
    if (itemUrl === createPageUrl("Forum") && location.pathname === createPageUrl("ForumTopic")) return true;
    return false;
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/Login';
  };

  const currentPoints = Number(userScore?.total_points || 0);
  const displayUserName = isAdmin
    ? 'Administrador'
    : (user?.display_name && user.display_name.trim() !== ''
      ? user.display_name
      : user?.full_name && user.full_name.trim() !== ''
        ? user.full_name
        : 'Ecoante');

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
      <MobileSidebarAutoCloseOnRouteChange pathname={location.pathname} />

      <div className="min-h-screen flex w-full" style={{ backgroundColor: colors.black, color: colors.cream }}>
        <Sidebar
          collapsible="icon"
          className="border-r flex flex-col"
          style={{
            backgroundColor: colors.blue,
            "--sidebar-width-icon": "4rem"
          }}
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
        >
          <SidebarHeader className="border-a p-6" >
            <img
              src={logoCuica}
              style={{ height: 38, width: 172, justifyContent: "center", alignSelf: "center" }}
              className="w-full h-full object-cover group-data-[collapsible=icon]:hidden"
            />
          </SidebarHeader>

          <SidebarContent className="flex flex-col h-full">

            <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 group-data-[collapsible=icon]:px-1">
              <SidebarGroup>
                <SidebarGroupContent>
                  <NavigationMenu
                    items={visibleNavigationItems}
                    isNavItemActive={isNavItemActive}
                    hasForumUnread={hasForumUnread}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
            <div className="p-3 pt-0 shrink-0">
              <div className="mb-2 px-1">
                <ThemeToggle />
              </div>

              {isAdmin && (
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                  <div
                    className="p-4 rounded-2xl border"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <p className="text-xs text-white/50 uppercase mb-3">
                      Painel Admin
                    </p>

                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold"
                      style={{
                        background: C.lime,
                        color: C.onAccent,
                        fontSize: 12,
                        ...body,
                        fontWeight: 700,
                      }}
                    >
                      <ShieldCheck size={16} />
                      Administrador
                    </div>

                    <p className="text-white/50 mt-1" style={{ fontFamily: body.fontFamily, fontSize: 11, fontWeight: 400 }}>
                      Agência CuícaLab
                    </p>

                    <div className="mt-1 space-y-1">
                      <div className="flex justify-between">
                        <span className="text-white/60">Ecoantes ativos</span>
                        <span className="text-lime-300 font-bold">
                          {activeUsers}
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-white/60">Tarefas ativas</span>
                        <span className="font-bold text-white">
                          {activeTasks}
                        </span>
                      </div>
                    </div>
                  </div>
                </SidebarGroup>
              )}

              {!isAdmin && (
                <SidebarGroup className="group-data-[collapsible=icon]:hidden">
                  <div
                    className="p-4 rounded-2xl border"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <p className="text-xs text-white/50 uppercase mb-3">
                      Nível do Grupo
                    </p>

                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold"
                      style={{
                        background: C.lime,
                        color: C.onAccent,
                        fontSize: 12,
                        ...body,
                        fontWeight: 700,
                      }}
                    >
                      {groupCategory?.icon && <groupCategory.icon size={16} />}
                      {groupCategory?.name}
                    </div>

                    <div className="mt-4 space-y-1">
                      <div className="flex justify-between items-center">
                        <span className="text-white/60 text-sm">Progresso grupal</span>
                        <span className="text-lime-300 font-bold">
                          {groupProgressPct}%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full w-full overflow-hidden mt-2 mb-3" style={{ backgroundColor: "rgba(255,255,255,0.1)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(100, groupProgressPct)}%`,
                            background: `linear-gradient(90deg, ${C.blue} 0%, ${C.lime} 100%)`,
                          }}
                        />
                      </div>

                      <div className="flex justify-between">
                        <span className="text-white/60 text-sm">Seus pontos</span>
                        <span className="font-bold text-white">
                          {currentPoints}
                        </span>
                      </div>
                    </div>
                  </div>
                </SidebarGroup>
              )}
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t p-4 group-data-[collapsible=icon]:p-2" style={{ borderColor: '#096e4c20' }}>
            <div className="flex items-center justify-between group-data-[collapsible=icon]:justify-center">
              <div className="flex items-center gap-3 flex-1 min-w-0 group-data-[collapsible=icon]:flex-none">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2 shrink-0"
                    style={{ borderColor: '#096e4c' }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: C.orange,
                      color: C.cream
                    }}
                  >
                    <span className="text-white font-bold text-sm">
                      {displayUserName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                  <p className="font-medium text-sm truncate text-white">{displayUserName}</p>
                  <p className="text-xs truncate text-white/50">{user?.instagram_handle || user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg transition-colors duration-200 hover:bg-[#ce161c10] shrink-0 group-data-[collapsible=icon]:hidden"
                title="Sair"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header
            className="backdrop-blur-sm border-b px-6 py-4"
            style={{
              borderColor: colors.border,
              background: colors.black,
            }}
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger
                  className="p-2 rounded-lg transition-colors duration-200 md:hidden hover:opacity-80"
                  style={{ color: colors.cream }}
                />
                <div className="md:hidden flex items-center gap-2">
                  <img
                    src={logoCuica}
                    alt="Cuíca Lab"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <h1 className="text-xl font-bold" style={{ color: colors.cream }}>Cuíca Lab</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
              </div>
            </div>
          </header>

          <div
            key={mode}
            className="flex-1 overflow-auto forum-typography"
            style={{ backgroundColor: colors.black }}
          >
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}