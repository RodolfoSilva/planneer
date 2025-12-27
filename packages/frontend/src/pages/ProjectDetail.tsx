import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { 
  ArrowLeft, 
  Calendar, 
  Plus, 
  MoreVertical,
  Settings,
  Trash2
} from 'lucide-react';
import { projects } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@planneer/shared';

export function ProjectDetail() {
  const { projectId } = useParams({ strict: false });
  
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId!),
    enabled: !!projectId,
  });
  
  const project = projectQuery.data?.data;
  
  if (projectQuery.isLoading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/3 mb-4" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }
  
  if (!project) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center">
        <h1 className="text-xl font-semibold text-slate-900">Projeto não encontrado</h1>
        <Link to="/projects" className="btn-primary mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar aos Projetos
        </Link>
      </div>
    );
  }
  
  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back link */}
      <Link 
        to="/projects" 
        className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-1" />
        Voltar aos Projetos
      </Link>
      
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900 mb-2">
            {project.name}
          </h1>
          <div className="flex items-center gap-3">
            <span className="badge badge-primary">
              {PROJECT_TYPE_LABELS[project.type] || project.type}
            </span>
            <span className={cn(
              "badge",
              project.status === 'completed' ? 'badge-success' :
              project.status === 'in_progress' ? 'badge-warning' :
              'bg-slate-100 text-slate-600'
            )}>
              {PROJECT_STATUS_LABELS[project.status] || project.status}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button className="btn-secondary">
            <Settings className="w-4 h-4 mr-2" />
            Editar
          </button>
          <button className="btn-ghost">
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>
      
      {/* Description */}
      {project.description && (
        <div className="card p-6 mb-6">
          <h2 className="font-semibold text-slate-900 mb-2">Descrição</h2>
          <p className="text-slate-600">{project.description}</p>
        </div>
      )}
      
      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="card p-4">
          <p className="text-sm text-slate-500 mb-1">Criado em</p>
          <p className="font-medium text-slate-900">
            {formatDate(project.createdAt)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500 mb-1">Última atualização</p>
          <p className="font-medium text-slate-900">
            {formatDate(project.updatedAt)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-slate-500 mb-1">Organização</p>
          <p className="font-medium text-slate-900">
            {project.organization?.name || '-'}
          </p>
        </div>
      </div>
      
      {/* Schedules */}
      <div className="card">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Cronogramas</h2>
          <Link to="/chat" className="btn-primary text-sm">
            <Plus className="w-4 h-4 mr-1" />
            Novo Cronograma
          </Link>
        </div>
        
        <div className="divide-y divide-slate-100">
          {project.schedules?.length > 0 ? (
            project.schedules.map((schedule: any) => (
              <Link
                key={schedule.id}
                to={`/schedules/${schedule.id}`}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{schedule.name}</p>
                  <p className="text-sm text-slate-500">
                    {schedule.startDate ? formatDate(schedule.startDate) : 'Sem data de início'}
                  </p>
                </div>
                <span className={cn(
                  "badge",
                  schedule.status === 'active' ? 'badge-success' : 'badge-warning'
                )}>
                  {schedule.status}
                </span>
              </Link>
            ))
          ) : (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum cronograma neste projeto</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



