import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, FolderKanban, Search, Filter, MoreVertical, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { projects } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS } from '@planneer/shared';
import { useOrganization } from '@/hooks/useOrganization';

// Modal wrapper using portal
function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export function Projects() {
  const [search, setSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<any | null>(null);
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  const queryClient = useQueryClient();
  
  const projectsQuery = useQuery({
    queryKey: ['projects', currentOrganization?.id],
    queryFn: () => projects.list(currentOrganization?.id),
    enabled: !!currentOrganization && !isOrgLoading,
    staleTime: 0, // Always refetch when organization changes
  });
  
  const projectList = projectsQuery.data?.data?.items || [];
  
  const filteredProjects = projectList.filter((project: any) =>
    project.name.toLowerCase().includes(search.toLowerCase()) ||
    project.description?.toLowerCase().includes(search.toLowerCase())
  );

  const deleteMutation = useMutation({
    mutationFn: (projectId: string) => projects.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDeleteProject(null);
      setOpenMenuId(null);
    },
    onError: (err: Error) => {
      console.error('[Projects] Error deleting project:', err);
    },
  });
  
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
      {isOrgLoading || !currentOrganization ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : projectsQuery.isLoading ? (
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
                <div className="relative">
                  <button 
                    className="p-1 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.preventDefault();
                      setOpenMenuId(openMenuId === project.id ? null : project.id);
                    }}
                  >
                    <MoreVertical className="w-4 h-4 text-slate-400" />
                  </button>
                  {openMenuId === project.id && (
                    <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-[10] min-w-[160px]">
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          setDeleteProject(project);
                          setOpenMenuId(null);
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </button>
                    </div>
                  )}
                </div>
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
      ) : projectsQuery.isError ? (
        <div className="card p-12 text-center">
          <FolderKanban className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Erro ao carregar projetos
          </h3>
          <p className="text-slate-500 mb-6">
            {projectsQuery.error?.message || 'Ocorreu um erro ao buscar os projetos'}
          </p>
          <button 
            onClick={() => projectsQuery.refetch()} 
            className="btn-primary"
          >
            Tentar novamente
          </button>
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

      {/* Delete Confirmation Modal */}
      {deleteProject && (
        <DeleteConfirmModal
          project={deleteProject}
          onClose={() => setDeleteProject(null)}
        />
      )}

      {/* Click outside to close menu */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-[5]"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  project,
  onClose,
}: {
  project: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => projects.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || "Erro ao excluir projeto");
    },
  });

  const handleDelete = () => {
    if (confirmName !== project.name) {
      setError("O nome não corresponde");
      return;
    }
    deleteMutation.mutate();
  };

  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="p-6">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>

            <h2 className="text-xl font-display font-bold text-slate-900 text-center mb-2">
              Excluir Projeto
            </h2>

            <p className="text-slate-600 text-center mb-6">
              Esta ação é <strong>irreversível</strong>. Todos os cronogramas
              e dados associados a{" "}
              <strong>"{project.name}"</strong> serão permanentemente
              excluídos.
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Digite <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded">{project.name}</span> para confirmar
              </label>
              <input
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                placeholder="Nome do projeto"
                className="input"
              />
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={deleteMutation.isPending}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="btn-danger flex-1"
                disabled={
                  deleteMutation.isPending || confirmName !== project.name
                }
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Excluir
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}



