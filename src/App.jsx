import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import NavigationTracker from '@/lib/NavigationTracker'
import { pagesConfig } from './pages.config'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';

const { Pages, Layout, mainPage } = pagesConfig;
const mainPageKey = mainPage ?? Object.keys(Pages)[0];
const ADMIN_ONLY_PAGES = new Set(['AdminContentManagement', 'AdminApproval', 'AdminApplications', 'Leaderboard']);
const isAdminPage = (pageName) => ADMIN_ONLY_PAGES.has(pageName);

const LayoutWrapper = ({ children, currentPageName }) => Layout ?
  <Layout currentPageName={currentPageName}>{children}</Layout>
  : <>{children}</>;

const AuthenticatedApp = () => {
  const { loading, isAuthenticated, isAdmin } = useAuth();
  const landingPageKey = isAdmin ? 'AdminApproval' : mainPageKey;
  const LandingPage = landingPageKey ? Pages[landingPageKey] : null;

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-50 to-green-100">
        <div className="text-center">
          <div className="text-4xl mb-4">🌿</div>
          <div className="w-12 h-12 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando... </p>
        </div>
      </div>
    );
  }

  // Render the main app
  return (
    <Routes>
      <Route path="/Login" element={<Pages.Login />} />
      <Route
        path="/CompleteProfile"
        element={
          <ProtectedRoute requireCompleteProfile={false}>
            <Pages.CompleteProfile />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={
        <ProtectedRoute requireAdmin={isAdminPage(landingPageKey)}>
          <LayoutWrapper currentPageName={landingPageKey}>
            {LandingPage ? <LandingPage /> : null}
          </LayoutWrapper>
        </ProtectedRoute>
      } />
      {Object.entries(Pages).map(([path, Page]) => {
        if (path === 'Login' || path === 'CompleteProfile') return null; // Already mapped
        return (
          <Route
            key={path}
            path={`/${path}`}
            element={
              <ProtectedRoute requireAdmin={isAdminPage(path)}>
                <LayoutWrapper currentPageName={path}>
                  <Page />
                </LayoutWrapper>
              </ProtectedRoute>
            }
          />
        );
      })}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <NavigationTracker />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App
