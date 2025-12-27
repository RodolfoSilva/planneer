import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, FolderKanban, Search, Filter, MoreVertical } from 'lucide-react';
import { projects } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@planneer/shared';
import { useState } from 'react';

export function Projects() {
  const [search, setSearch] = useState('');
  
  const projectsQuery = useQuery({
    queryKey: ['projects'],
    queryFn: () => projects.list(),
  });
  
  const projectList = projectsQuery.data?.data.items || [];
  
  const filteredProjects = projectList.filter((project: any) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Projetos</h1>
          <p className="text-slate-600 mt-1">Gerencie seus projetos e cronogramas</p>
        </div>
        <Link to="/chat" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Novo Projeto
        </Link>
      </div>
      
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar projetos..."
            className="input pl-10"
          />
        </div>
        <button className="btn-secondary">
          <Filter className="w-4 h-4 mr-2" />
          Filtros
        </button>
      </div>
      
      {/* Projects Grid */}
      {projectsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredProjects.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project: any) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="card-hover p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                  <FolderKanban className="w-6 h-6 text-primary-600" />
                </div>
                <button 
                  className="p-1 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.preventDefault()}
                >
                  <MoreVertical className="w-4 h-4 text-slate-400" />
                </button>
              </div>
              
              <h3 className="font-semibold text-slate-900 mb-1 group-hover:text-primary-600 transition-colors">
                {project.name}
              </h3>
              
              {project.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                  {project.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 flex-wrap">
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
              
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {project.schedules?.length || 0} cronogramas
                </span>
                <span className="text-slate-400">
                  {formatRelativeTime(project.updatedAt)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <FolderKanban className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Nenhum projeto encontrado
          </h3>
          <p className="text-slate-500 mb-6">
            {search 
              ? 'Tente uma busca diferente'
              : 'Comece criando seu primeiro projeto com a IA'
            }
          </p>
          <Link to="/chat" className="btn-primary">
            <Plus className="w-4 h-4 mr-2" />
            Criar Projeto
          </Link>
        </div>
      )}
    </div>
  );
}



