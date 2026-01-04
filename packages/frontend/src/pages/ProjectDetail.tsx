import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { 
  ArrowLeft, 
  Calendar, 
  Plus, 
  MoreVertical,
  Settings,
  Trash2,
  Sparkles,
  Download,
  AlertTriangle,
  Loader2,
  X
} from 'lucide-react';
import { projects, chat, schedules } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS, PROJECT_STATUS_LABELS, type ProjectType, type ProjectStatus } from '@planneer/shared';

// Modal wrapper using portal
function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export function ProjectDetail() {
  const { projectId } = useParams({ strict: false });
  const navigate = useNavigate();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  
  const projectQuery = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projects.get(projectId!),
    enabled: !!projectId,
  });
  
  const project = projectQuery.data?.data;

  // Download XER mutation
  const downloadXerMutation = useMutation({
    mutationFn: (scheduleId: string) => schedules.downloadXer(scheduleId),
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.data.downloadUrl, "_blank");
    },
    onError: (err: Error) => {
      console.error("[ProjectDetail] Error downloading XER:", err);
    },
  });

  // Mutation to get or create chat session for this project
  const chatSessionMutation = useMutation({
    mutationFn: () => chat.getOrCreateSessionForProject(projectId!),
    onSuccess: (data) => {
      navigate({ to: `/chat/${data.data.id}` });
    },
    onError: (err: Error) => {
      console.error('[ProjectDetail] Error getting chat session:', err);
    },
  });

  // Delete project mutation
  const queryClient = useQueryClient();
  const deleteProjectMutation = useMutation({
    mutationFn: () => projects.delete(projectId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      navigate({ to: '/projects' });
    },
    onError: (err: Error) => {
      console.error('[ProjectDetail] Error deleting project:', err);
    },
  });
  
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
          <button 
            onClick={() => chatSessionMutation.mutate()}
            disabled={chatSessionMutation.isPending}
            className="btn-primary"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {chatSessionMutation.isPending ? 'Abrindo...' : 'Modificar com IA'}
          </button>
          <button 
            onClick={() => setShowEditModal(true)}
            className="btn-secondary"
          >
            <Settings className="w-4 h-4 mr-2" />
            Editar
          </button>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="btn-ghost text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-4 h-4" />
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
              <div
                key={schedule.id}
                className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors"
              >
                <Link
                  to={`/schedules/${schedule.id}`}
                  className="flex items-center gap-4 flex-1 min-w-0"
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
                {schedule.xerFileKey && (
                  <button
                    onClick={() => downloadXerMutation.mutate(schedule.id)}
                    disabled={downloadXerMutation.isPending}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-600 hover:text-slate-900"
                    title="Baixar arquivo .xer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum cronograma neste projeto</p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Project Modal */}
      {showEditModal && project && (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditModal(false)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && project && (
        <DeleteConfirmModal
          project={project}
          onClose={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  );
}

// Edit Project Modal
function EditProjectModal({
  project,
  onClose,
}: {
  project: any;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: project.name || '',
    description: project.description || '',
    type: project.type || 'other' as ProjectType,
    status: project.status || 'draft' as ProjectStatus,
  });
  const [error, setError] = useState<string | null>(null);

  const updateMutation = useMutation({
    mutationFn: () => projects.update(project.id, {
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      status: formData.status,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message || 'Erro ao atualizar projeto');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError('O nome do projeto é obrigatório');
      return;
    }
    setError(null);
    updateMutation.mutate();
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
          {/* Header */}
          <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-xl font-display font-bold text-slate-900">
              Editar Projeto
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              disabled={updateMutation.isPending}
            >
              <X className="w-5 h-5 text-slate-500" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Nome *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                maxLength={255}
                className="input"
                disabled={updateMutation.isPending}
                placeholder="Nome do projeto"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Descrição
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                rows={4}
                className="input resize-none"
                disabled={updateMutation.isPending}
                placeholder="Descrição do projeto (opcional)"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo *
              </label>
              <select
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value as ProjectType)}
                required
                className="input"
                disabled={updateMutation.isPending}
              >
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value as ProjectStatus)}
                required
                className="input"
                disabled={updateMutation.isPending}
              >
                {Object.entries(PROJECT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={updateMutation.isPending}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary flex-1"
                disabled={updateMutation.isPending || !formData.name.trim()}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Alterações'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
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
  const navigate = useNavigate();
  const [confirmName, setConfirmName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: () => projects.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects" });
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



