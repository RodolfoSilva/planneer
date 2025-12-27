import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { 
  Plus, 
  FolderKanban, 
  Calendar, 
  FileStack, 
  ArrowRight,
  Sparkles,
  Clock
} from 'lucide-react';
import { projects, schedules, templates } from '@/lib/api';
import { formatRelativeTime } from '@/lib/utils';

export function Dashboard() {
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  });
  
  const schedulesQuery = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedules.list(),
  });
  
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => templates.list(),
  });
  
  const recentProjects = projectsQuery.data?.data.items.slice(0, 5) || [];
  const recentSchedules = schedulesQuery.data?.data.items.slice(0, 5) || [];
  
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-display font-bold text-slate-900">
          Bem-vindo ao Planneer
        </h1>
        <p className="text-slate-600 mt-1">
          Gere cronogramas inteligentes com o poder da IA
        </p>
      </div>
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Link 
          to="/chat"
          className="card-hover p-6 flex items-start gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
              Novo Cronograma
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Crie com IA
            </p>
          </div>
        </Link>
        
        <Link 
          to="/projects"
          className="card-hover p-6 flex items-start gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
            <FolderKanban className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
              Projetos
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {projectsQuery.data?.data.total || 0} projetos
            </p>
          </div>
        </Link>
        
        <Link 
          to="/schedules"
          className="card-hover p-6 flex items-start gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
              Cronogramas
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {schedulesQuery.data?.data.total || 0} cronogramas
            </p>
          </div>
        </Link>
        
        <Link 
          to="/templates"
          className="card-hover p-6 flex items-start gap-4 group"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <FileStack className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 group-hover:text-primary-600 transition-colors">
              Templates
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {templatesQuery.data?.data.total || 0} templates
            </p>
          </div>
        </Link>
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <div className="card">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Projetos Recentes</h2>
            <Link to="/projects" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="divide-y divide-slate-100">
            {recentProjects.length > 0 ? (
              recentProjects.map((project: any) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{project.name}</p>
                    <p className="text-sm text-slate-500">{project.type}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(project.updatedAt)}
                  </div>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center">
                <FolderKanban className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum projeto ainda</p>
                <Link to="/chat" className="btn-primary mt-4">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Primeiro Projeto
                </Link>
              </div>
            )}
          </div>
        </div>
        
        {/* Recent Schedules */}
        <div className="card">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Cronogramas Recentes</h2>
            <Link to="/schedules" className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Ver todos <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          
          <div className="divide-y divide-slate-100">
            {recentSchedules.length > 0 ? (
              recentSchedules.map((schedule: any) => (
                <Link
                  key={schedule.id}
                  to={`/schedules/${schedule.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{schedule.name}</p>
                    <p className="text-sm text-slate-500">{schedule.project?.name}</p>
                  </div>
                  <span className={`badge ${schedule.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {schedule.status}
                  </span>
                </Link>
              ))
            ) : (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhum cronograma ainda</p>
                <Link to="/chat" className="btn-primary mt-4">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Gerar com IA
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



