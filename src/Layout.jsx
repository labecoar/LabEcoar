// @ts-nocheck
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Home, Target, CheckCircle2, Trophy, LogOut, Shield, User, MessageSquare, Gift, DollarSign, BarChart3 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useUserScore } from "@/hooks/useScores";
import logoCuica from "@/assets/images/logo_cuica.png";
import NotificationBell from "@/components/notifications/NotificationBell";
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
} from "@/components/ui/sidebar";

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

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const { user, profile, isAdmin, signOut } = useAuth();
  const { data: userScore } = useUserScore(user?.id);
  const visibleNavigationItems = isAdmin ? adminNavigationItems : navigationItems;
  const landingPageUrl = currentPageName ? createPageUrl(currentPageName) : null;

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
        
        body {
          color: #3c0b14;
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
      `}</style>
      <div className="min-h-screen flex w-full" style={{ background: 'linear-gradient(to br, #f5fff8, #ffffff, #fff5f8)' }}>
        <Sidebar className="border-r bg-white/80 backdrop-blur-sm" style={{ borderColor: '#096e4c20' }}>
          <SidebarHeader className="border-b p-6" style={{ borderColor: '#096e4c20' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden">
                <img
                  src={logoCuica}
                  alt="Cuíca Lab"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="font-bold text-lg" style={{ color: '#3c0b14' }}>Cuíca Lab</h2>
                <p className="text-xs" style={{ color: '#096e4c' }}>Cuíca x Ecoantes</p>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="p-3">
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {visibleNavigationItems.map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        className={`hover:bg-[#096e4c10] transition-all duration-200 rounded-xl mb-1 ${isNavItemActive(item.url) ? 'text-white shadow-md' : 'text-[#3c0b14]'
                          }`}
                        style={isNavItemActive(item.url) ? {
                          background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)'
                        } : {}}
                      >
                        <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {user && !isAdmin && (
              <SidebarGroup className="mt-6">
                <div className="px-4 py-4 rounded-xl border-2" style={{
                  background: 'linear-gradient(135deg, #096e4c05 0%, #00c33105 100%)',
                  borderColor: '#096e4c'
                }}>
                  <div className="mb-3 pb-3 border-b" style={{ borderColor: '#096e4c20' }}>
                    <p className="text-xs mb-1" style={{ color: '#929292' }}>Categoria Atual</p>
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${categoryInfo.color} bg-opacity-20 border-2 border-current`}>
                      <span className="font-bold text-sm">{categoryInfo.name}</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#929292' }}>{categoryInfo.range}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#3c0b14' }}>Pontos</span>
                      <span className="font-bold" style={{ color: '#096e4c' }}>{currentPoints}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#3c0b14' }}>Ganho Previsto</span>
                      <span className="font-bold" style={{ color: '#00c331' }}>{categoryInfo.value}</span>
                    </div>
                  </div>
                </div>
              </SidebarGroup>
            )}
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
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{
                    background: 'linear-gradient(135deg, #096e4c 0%, #00c331 100%)'
                  }}>
                    <span className="text-white font-bold text-sm">
                      {(user?.display_name?.charAt(0) || user?.full_name?.charAt(0) || 'E').toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" style={{ color: '#3c0b14' }}>{displayUserName}</p>
                  <p className="text-xs truncate" style={{ color: '#929292' }}>{user?.instagram_handle || user?.email}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg transition-colors duration-200 hover:bg-[#ce161c10]"
                title="Sair"
              >
                <LogOut className="w-4 h-4" style={{ color: '#ce161c' }} />
              </button>
            </div>
          </SidebarFooter>
        </Sidebar>

        <main className="flex-1 flex flex-col">
          <header className="bg-white/80 backdrop-blur-sm border-b px-6 py-4" style={{ borderColor: '#096e4c20' }}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <SidebarTrigger className="p-2 rounded-lg transition-colors duration-200 md:hidden hover:bg-[#096e4c10]" />
                <div className="md:hidden flex items-center gap-2">
                  <img
                    src={logoCuica}
                    alt="Cuíca Lab"
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <h1 className="text-xl font-bold" style={{ color: '#3c0b14' }}>Cuíca Lab</h1>
                </div>
              </div>
              <NotificationBell />
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