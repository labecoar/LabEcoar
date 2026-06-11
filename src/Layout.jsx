// @ts-nocheck
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Target, CheckCircle2, Trophy, LogOut, Shield, User, Users, MessageSquare, Gift, DollarSign, BarChart3, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import logoCuica from "@/assets/images/cuica_lab.png";
import NotificationBell from "@/components/notifications/NotificationBell";
import { C, heading, body } from '@/lib/theme'
import { useQuery } from "@tanstack/react-query";
import { adminUsersService } from "@/services/admin-users.service";
import { useAdminTasks } from "@/hooks/useTasks";

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
    icon: Home,
  },
  {
    title: "Tarefas Disponíveis",
    url: createPageUrl("Tasks"),
    icon: Target,
  },
  {
    title: "Minhas Submissões",
    url: createPageUrl("MySubmissions"),
    icon: CheckCircle2,
  },
  {
    title: "Fórum",
    url: createPageUrl("Forum"),
    icon: MessageSquare,
  },
  {
    title: "Recompensas",
    url: createPageUrl("Rewards"),
    icon: Gift,
  },
  {
    title: "Meus Pagamentos",
    url: createPageUrl("MyPayments"),
    icon: DollarSign,
  },
  {
    title: "Perfil",
    url: createPageUrl("Profile"),
    icon: User,
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
    title: "Fórum",
    url: createPageUrl("Forum"),
    icon: MessageSquare,
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
];

const CATEGORY_INFO = {
  voz_e_violao: { name: "Voz e Violão", color: "bg-yellow-500", range: "50-200 pts", value: "R$ 1.000" },
  dueto: { name: "Dueto", color: "bg-pink-500", range: "201-500 pts", value: "R$ 2.000" },
  fanfarra: { name: "Fanfarra", color: "bg-blue-500", range: "501-1000 pts", value: "R$ 3.500" },
  carnaval: { name: "Carnaval", color: "bg-orange-500", range: "999+ pts", value: "R$ 4.500" }
};

const getCategoryByPoints = (points = 0) => {
  if (points >= 1001) return 'carnaval';
  if (points >= 501) return 'fanfarra';
  if (points >= 201) return 'dueto';
  return 'voz_e_violao';
};

function NavigationMenu({ items, isNavItemActive }) {
  const { isMobile, setOpenMobile } = useSidebar();

  const handleNavigationClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <SidebarMenu>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
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
              className="flex items-center gap-3 px-4 py-2.5"
              onClick={handleNavigationClick}
            >
              <item.icon className="w-4 h-4" />
              <span
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
  const { data: userScore } = useUserScore(user?.id);
  const visibleNavigationItems = isAdmin ? adminNavigationItems : navigationItems;
  const landingPageUrl = currentPageName ? createPageUrl(currentPageName) : null;

  // Chamadas de hooks devem ficar obrigatoriamente dentro do componente
  const { data: users } = useQuery({
    queryKey: ['admin-users'],
    queryFn: () => adminUsersService.listUsers(),
    enabled: !!isAdmin // Evita buscar a lista de usuários para não-admins
  });
  const { data: tasks } = useAdminTasks();

  const activeUsers = users?.filter(u => u.is_active !== false).length ?? 0;
  const activeTasks = tasks?.filter(t => t.status === 'active' && !isTaskExpired(t)).length ?? 0;

  const isNavItemActive = (itemUrl) => {
    if (location.pathname === itemUrl) return true;
    if (location.pathname === '/' && landingPageUrl && itemUrl === landingPageUrl) return true;
    return false;
  };

  const handleLogout = async () => {
    await signOut();
    window.location.href = '/Login';
  };

  const hasScoreLoaded = typeof userScore?.total_points === 'number';
  const currentPoints = Number(userScore?.total_points || 0);
  const categoryKey = hasScoreLoaded
    ? getCategoryByPoints(currentPoints)
    : (profile?.current_category || 'voz_e_violao');
  const categoryInfo = CATEGORY_INFO[categoryKey] || CATEGORY_INFO.voz_e_violao;
  const displayUserName = isAdmin
    ? 'Administrador'
    : (user?.display_name && user.display_name.trim() !== ''
      ? user.display_name
      : user?.full_name && user.full_name.trim() !== ''
        ? user.full_name
        : 'Ecoante');

  return (
    <SidebarProvider>
      <MobileSidebarAutoCloseOnRouteChange pathname={location.pathname} />
      <style>{`
        :root {
          --primary: 165 100% 22%;
          --primary-foreground: 0 0% 100%;
          --secondary: 340 80% 13%;
          --secondary-foreground: 0 0% 100%;
          --accent: 165 100% 22%;
          --background: 0 0% 98%;
          --card: 0 0% 100%;
          --foreground: 340 80% 13%;
          
          /* Nova paleta */
          --verde-escuro: #096e4c;
          --marrom-escuro: #3c0b14;
          --roxo: #a6539f;
          --rosa: #e833ae;
          --laranja: #ff6a2d;
          --coral: #ff8677;
          --amarelo: #f6c835;
          --verde-claro: #00c331;
          --verde-lima: #d9f73b;
          --azul: #0077ad;
          --azul-claro: #00d3fb;
          --cinza: #929292;
          --vermelho: #ce161c;
        }
        
        .bg-gradient-primary {
          background: linear-gradient(135deg, #096e4c 0%, #00c331 100%);
        }
        
        .bg-gradient-secondary {
          background: linear-gradient(135deg, #e833ae 0%, #a6539f 100%);
        }
        
        .text-gradient-primary {
          background: linear-gradient(135deg, #096e4c 0%, #00c331 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
      `}
      </style>

      <div className="min-h-screen flex w-full bg-background text-foreground">
        <Sidebar
          className="border-r flex flex-col"
          // style={{
          style={{
            backgroundColor: C.blue
          }}
        >
          <SidebarHeader className="border-a p-6" >
            <img
              src={logoCuica}
              style={{ height: 38, width: 172, justifyContent: "center", alignSelf: "center" }}
              className="w-full h-full object-cover"
            />
          </SidebarHeader>

          <SidebarContent className="flex flex-col h-full">

            <div className="flex-1 overflow-y-auto p-3">
              <SidebarGroup>
                <SidebarGroupContent>
                  <NavigationMenu
                    items={visibleNavigationItems}
                    isNavItemActive={isNavItemActive}
                  />
                </SidebarGroupContent>
              </SidebarGroup>
            </div>
            <div className="p-3 pt-0 shrink-0">

              {isAdmin && (
                <SidebarGroup>
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
                        color: C.black,
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
                <SidebarGroup className="mt-6">
                  <div
                    className="p-5 rounded-3xl border"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      borderColor: "rgba(255,255,255,0.15)",
                    }}
                  >
                    <p className="text-xs text-white/50 uppercase mb-4">
                      Minha Categoria
                    </p>

                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold"
                      style={{
                        background: C.lime,
                        color: C.black,
                        fontSize: 11,
                        ...body,
                        fontWeight: 700,
                      }}
                    >
                      {categoryInfo.name}
                    </div>

                    <div className="mt-6">
                      <div className="flex justify-between">
                        <span className="text-white/60">Pontos</span>
                        <span className="font-bold text-white">
                          {currentPoints}
                        </span>
                      </div>

                      <div className="flex justify-between mt-3">
                        <span className="text-white/60">
                          Ganho Previsto
                        </span>
                        <span
                          className="font-bold"
                          style={{ color: C.lime }}
                        >
                          {categoryInfo.value}
                        </span>
                      </div>
                    </div>
                  </div>
                </SidebarGroup>
              )}
            </div>
          </SidebarContent>

          <SidebarFooter className="border-t p-4" style={{ borderColor: '#096e4c20' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {user?.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="w-10 h-10 rounded-full object-cover border-2"
                    style={{ borderColor: '#096e4c' }}
                  />
                ) : (
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center"
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
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate text-white">{displayUserName}</p>
                  <p className="text-xs truncate text-white/50" >{user?.instagram_handle || user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg transition-colors duration-200 hover:bg-[#ce161c10]"
                title="Sair"
              >
                <LogOut className="w-4 h-4 text-white" />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="backdrop-blur-sm border-b px-6 py-4" style={{ borderColor: 'rgba(255,255,255,0.1)', background: C.black}}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="p-2 rounded-lg transition-colors duration-200 md:hidden hover:bg-white/10 text-white" />
                <div className="md:hidden flex items-center gap-2">
                  <img
                    src={logoCuica}
                    alt="Cuíca Lab"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <h1 className="text-xl font-bold text-white">Cuíca Lab</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <NotificationBell />
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto forum-typography">
            {children}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}