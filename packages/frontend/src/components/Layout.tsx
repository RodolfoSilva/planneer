import { ReactNode, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from '@tanstack/react-router';
import { 
  LayoutDashboard, 
  MessageSquare, 
  FolderKanban, 
  Calendar, 
  FileStack,
  Building2,
  LogOut,
  Menu,
  X,
  Loader2,
  ChevronDown,
  Check
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Novo Cronograma', href: '/chat', icon: MessageSquare },
  { name: 'Projetos', href: '/projects', icon: FolderKanban },
  { name: 'Cronogramas', href: '/schedules', icon: Calendar },
  { name: 'Templates', href: '/templates', icon: FileStack },
  { name: 'Organizações', href: '/organizations', icon: Building2 },
];

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const { 
    hasOrganization, 
    isLoading: isOrgLoading, 
    organizations, 
    currentOrganization,
    setSelectedOrganizationId 
  } = useOrganization();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgSelectorOpen, setOrgSelectorOpen] = useState(false);
  const [mobileOrgSelectorOpen, setMobileOrgSelectorOpen] = useState(false);
  const orgSelectorRef = useRef<HTMLDivElement>(null);
  const mobileOrgSelectorRef = useRef<HTMLDivElement>(null);
  
  const isLoading = isAuthLoading || (isAuthenticated && isOrgLoading);
  
  // Pages that don't require organization
  const publicPaths = ['/login', '/onboarding'];
  const isPublicPath = publicPaths.includes(location.pathname);
  
  // All useEffect hooks must be called before any conditional returns
  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated && !isPublicPath) {
      navigate({ to: '/login' });
    }
  }, [isAuthLoading, isAuthenticated, isPublicPath, navigate]);
  
  // Redirect to onboarding if authenticated but no organization
  useEffect(() => {
    if (isAuthenticated && !isOrgLoading && !hasOrganization && !isPublicPath) {
      navigate({ to: '/onboarding' });
    }
  }, [isAuthenticated, isOrgLoading, hasOrganization, isPublicPath, navigate]);
  
  // Close org selector when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (orgSelectorRef.current && !orgSelectorRef.current.contains(event.target as Node)) {
        setOrgSelectorOpen(false);
      }
      if (mobileOrgSelectorRef.current && !mobileOrgSelectorRef.current.contains(event.target as Node)) {
        setMobileOrgSelectorOpen(false);
      }
    }

    if (orgSelectorOpen || mobileOrgSelectorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [orgSelectorOpen, mobileOrgSelectorOpen]);
  
  // Don't show sidebar on login or onboarding page
  if (isPublicPath) {
    return <>{children}</>;
  }
  
  // Show loading while checking auth or organization
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-4" />
          <p className="text-slate-600">Carregando...</p>
        </div>
      </div>
    );
  }
  
  // Don't render protected content if not authenticated or no organization
  if (!isAuthenticated || !hasOrganization) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-slate-200">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <span className="font-display font-bold text-xl text-gradient">Planneer</span>
            </Link>
            <button 
              className="lg:hidden p-1 hover:bg-slate-100 rounded"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Organization Selector */}
          {currentOrganization && organizations.length > 0 && (
            <div className="px-3 py-3 border-b border-slate-200" ref={orgSelectorRef}>
              <div className="relative">
                <button
                  onClick={() => setOrgSelectorOpen(!orgSelectorOpen)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {currentOrganization.logo ? (
                      <img 
                        src={currentOrganization.logo} 
                        alt={currentOrganization.name}
                        className="w-5 h-5 rounded object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-5 h-5 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-3 h-3 text-primary-600" />
                      </div>
                    )}
                    <span className="truncate text-left">{currentOrganization.name}</span>
                  </div>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-slate-400 flex-shrink-0 transition-transform",
                    orgSelectorOpen && "rotate-180"
                  )} />
                </button>

                {/* Dropdown */}
                {orgSelectorOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => {
                          setSelectedOrganizationId(org.id);
                          setOrgSelectorOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                          "hover:bg-slate-50",
                          currentOrganization.id === org.id && "bg-primary-50"
                        )}
                      >
                        {org.logo ? (
                          <img 
                            src={org.logo} 
                            alt={org.name}
                            className="w-5 h-5 rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-3 h-3 text-primary-600" />
                          </div>
                        )}
                        <span className="flex-1 text-left truncate">{org.name}</span>
                        {currentOrganization.id === org.id && (
                          <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                        )}
                      </button>
                    ))}
                    <div className="border-t border-slate-200 mt-1">
                      <Link
                        to="/organizations"
                        onClick={() => setOrgSelectorOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <Building2 className="w-4 h-4" />
                        <span>Gerenciar organizações</span>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                (item.href !== '/' && location.pathname.startsWith(item.href));
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary-50 text-primary-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={cn(
                    "w-5 h-5",
                    isActive ? "text-primary-600" : "text-slate-400"
                  )} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          
          {/* User section */}
          {isAuthenticated && (
            <div className="p-4 border-t border-slate-200">
              <div className="flex items-center gap-3 px-3 py-2">
                {user?.image ? (
                  <img 
                    src={user.image} 
                    alt={user.name || 'User'} 
                    className="w-8 h-8 rounded-full"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">
                      {user?.name?.[0] || user?.email?.[0] || 'U'}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {user?.name || 'Usuário'}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={() => logout()}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
      
      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 flex items-center h-16 px-4 bg-white border-b border-slate-200 gap-3">
          <button
            className="p-2 -ml-2 hover:bg-slate-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 bg-gradient-to-br from-primary-500 to-accent-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Calendar className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-gradient">Planneer</span>
          </div>
          {currentOrganization && (
            <div className="relative flex-shrink-0" ref={mobileOrgSelectorRef}>
              <button
                onClick={() => setMobileOrgSelectorOpen(!mobileOrgSelectorOpen)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                {currentOrganization.logo ? (
                  <img 
                    src={currentOrganization.logo} 
                    alt={currentOrganization.name}
                    className="w-6 h-6 rounded object-cover"
                  />
                ) : (
                  <div className="w-6 h-6 rounded bg-primary-100 flex items-center justify-center">
                    <Building2 className="w-3.5 h-3.5 text-primary-600" />
                  </div>
                )}
                <ChevronDown className={cn(
                  "w-3.5 h-3.5 text-slate-400 transition-transform",
                  mobileOrgSelectorOpen && "rotate-180"
                )} />
              </button>
              {mobileOrgSelectorOpen && (
                <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                  {organizations.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => {
                        setSelectedOrganizationId(org.id);
                        setMobileOrgSelectorOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors",
                        "hover:bg-slate-50",
                        currentOrganization.id === org.id && "bg-primary-50"
                      )}
                    >
                      {org.logo ? (
                        <img 
                          src={org.logo} 
                          alt={org.name}
                          className="w-5 h-5 rounded object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-5 h-5 rounded bg-primary-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-3 h-3 text-primary-600" />
                        </div>
                      )}
                      <span className="flex-1 text-left truncate">{org.name}</span>
                      {currentOrganization.id === org.id && (
                        <Check className="w-4 h-4 text-primary-600 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                  <div className="border-t border-slate-200 mt-1">
                    <Link
                      to="/organizations"
                      onClick={() => setMobileOrgSelectorOpen(false)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      <Building2 className="w-4 h-4" />
                      <span>Gerenciar organizações</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </header>
        
        {/* Page content */}
        <main className="min-h-[calc(100vh-4rem)] lg:min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}

