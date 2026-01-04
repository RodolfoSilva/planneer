import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from '@tanstack/react-router';
import { 
  ArrowLeft, 
  Download, 
  Table2, 
  GanttChart,
  FileDown,
  Loader2,
  Trash2,
  AlertTriangle,
  LayoutGrid,
  ChevronDown
} from 'lucide-react';
import { schedules, wbs as wbsApi } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { ScheduleTable } from '@/components/ScheduleTable';
import { Timeline } from '@/components/Timeline';
import { WBSTree } from '@/components/WBSTree';
import { KanbanBoard } from '@/components/KanbanBoard';
import { EditActivityModal } from '@/components/EditActivityModal';
import { EditWBSModal } from '@/components/EditWBSModal';
import { SCHEDULE_STATUS_LABELS } from '@planneer/shared';
import { createPortal } from 'react-dom';
import { FolderTree } from 'lucide-react';
import type { ScheduleStatus } from '@planneer/shared';

type ViewMode = 'table' | 'timeline' | 'wbs' | 'kanban';

// Modal wrapper using portal
function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export function ScheduleDetail() {
  const { scheduleId } = useParams({ strict: false });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState<any | null>(null);
  const [selectedWBS, setSelectedWBS] = useState<any | null>(null);
  const [wbsModalParentId, setWbsModalParentId] = useState<string | null | undefined>(undefined);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const scheduleQuery = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedules.get(scheduleId!),
    enabled: !!scheduleId,
  });
  
  const exportMutation = useMutation({
    mutationFn: (format: 'xer' | 'xml') => schedules.export(scheduleId!, format),
    onSuccess: (data) => {
      // Download the file
      const blob = new Blob([data.data.content], { type: data.data.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
  });

  const downloadXerMutation = useMutation({
    mutationFn: () => schedules.downloadXer(scheduleId!),
    onSuccess: (data) => {
      // Open download URL in new tab
      window.open(data.data.downloadUrl, "_blank");
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: () => schedules.delete(scheduleId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      navigate({ to: '/schedules' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (status: ScheduleStatus) => schedules.update(scheduleId!, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
  });
  
  const schedule = scheduleQuery.data?.data;

  // Fetch WBS items
  const wbsQuery = useQuery({
    queryKey: ['wbs', scheduleId],
    queryFn: () => wbsApi.list(scheduleId!),
    enabled: !!scheduleId && viewMode === 'wbs',
  });

  const wbsItems = wbsQuery.data?.data || schedule?.wbsItems || [];

  // Delete WBS mutation
  const deleteWBSMutation = useMutation({
    mutationFn: (wbsId: string) => wbsApi.delete(wbsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    },
  });

  const handleDeleteWBS = (wbsItem: any) => {
    if (confirm(`Tem certeza que deseja excluir a WBS "${wbsItem.code} - ${wbsItem.name}"?\n\nEsta ação não pode ser desfeita e só é permitida se a WBS não tiver filhos ou atividades associadas.`)) {
      deleteWBSMutation.mutate(wbsItem.id);
    }
  };
  
  if (scheduleQuery.isLoading) {
    return (
      <div className="p-6 lg:p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }
  
  if (!schedule) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto text-center">
        <h1 className="text-xl font-semibold text-slate-900">Cronograma não encontrado</h1>
        <Link to="/schedules" className="btn-primary mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar aos Cronogramas
        </Link>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen lg:h-[calc(100vh-0px)]">
      {/* Header */}
      <div className="flex-shrink-0 p-4 lg:p-6 border-b border-slate-200 bg-white">
        <Link 
          to="/schedules" 
          className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar aos Cronogramas
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-display font-bold text-slate-900">
              {schedule.name}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-slate-500">
                {schedule.project?.name}
              </span>
              <StatusDropdown
                currentStatus={schedule.status}
                onStatusChange={(status) => updateStatusMutation.mutate(status)}
                isUpdating={updateStatusMutation.isPending}
              />
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('table')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'table' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Table2 className="w-4 h-4" />
                Tabela
              </button>
              <button
                onClick={() => setViewMode('timeline')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'timeline' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <GanttChart className="w-4 h-4" />
                Timeline
              </button>
              <button
                onClick={() => setViewMode('wbs')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'wbs' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FolderTree className="w-4 h-4" />
                WBS
              </button>
              <button
                onClick={() => setViewMode('kanban')}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  viewMode === 'kanban' 
                    ? "bg-white text-slate-900 shadow-sm" 
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                KANBAN
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              {/* Download generated XER file if it exists */}
              {schedule?.xerFileKey && (
                <button
                  onClick={() => downloadXerMutation.mutate()}
                  disabled={downloadXerMutation.isPending}
                  className="btn-primary"
                >
                  {downloadXerMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Baixar .xer
                </button>
              )}
              
              {/* Export dropdown */}
              <div className="relative group">
                <button className="btn-secondary">
                  {exportMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  Exportar
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                  <button
                    onClick={() => exportMutation.mutate('xer')}
                    disabled={exportMutation.isPending}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 first:rounded-t-lg"
                  >
                    <FileDown className="w-4 h-4" />
                    Primavera XER
                  </button>
                  <button
                    onClick={() => exportMutation.mutate('xml')}
                    disabled={exportMutation.isPending}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 last:rounded-b-lg"
                  >
                    <FileDown className="w-4 h-4" />
                    Primavera XML (P6)
                  </button>
                </div>
              </div>
              
              {/* Delete button */}
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-secondary text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Excluir
              </button>
            </div>
          </div>
        </div>
        
        {/* Date info */}
        {schedule.startDate && (
          <div className="flex items-center gap-4 mt-4 text-sm text-slate-600">
            <span>
              <strong>Início:</strong> {formatDate(schedule.startDate)}
            </span>
            {schedule.endDate && (
              <span>
                <strong>Término:</strong> {formatDate(schedule.endDate)}
              </span>
            )}
            <span>
              <strong>Atividades:</strong> {schedule.activities?.length || 0}
            </span>
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 lg:p-6">
        {viewMode === 'table' ? (
          <ScheduleTable 
            activities={schedule.activities || []}
            onActivityClick={(activity) => setSelectedActivity(activity)}
          />
        ) : viewMode === 'timeline' ? (
          schedule.startDate && schedule.endDate && (
            <Timeline
              activities={schedule.activities || []}
              startDate={schedule.startDate}
              endDate={schedule.endDate}
            />
          )
        ) : viewMode === 'kanban' ? (
          <KanbanBoard
            activities={schedule.activities || []}
            scheduleId={scheduleId!}
            onActivityClick={(activity) => setSelectedActivity(activity)}
          />
        ) : (
          <WBSTree
            wbsItems={wbsItems}
            onAdd={(parentId) => {
              setWbsModalParentId(parentId);
              setSelectedWBS(null);
            }}
            onEdit={(wbsItem) => {
              setSelectedWBS(wbsItem);
              setWbsModalParentId(undefined);
            }}
            onDelete={handleDeleteWBS}
            selectedWbsId={selectedWBS?.id}
            onSelect={(wbsId) => {
              const item = wbsItems.find(w => w.id === wbsId);
              setSelectedWBS(item || null);
            }}
          />
        )}
      </div>
      
      {/* Edit Activity Modal */}
      {selectedActivity && (
        <EditActivityModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
          scheduleId={scheduleId!}
        />
      )}

      {/* Edit/Create WBS Modal */}
      {(selectedWBS !== null || wbsModalParentId !== undefined) && (
        <EditWBSModal
          wbsItem={selectedWBS}
          scheduleId={scheduleId!}
          parentId={wbsModalParentId}
          onClose={() => {
            setSelectedWBS(null);
            setWbsModalParentId(undefined);
          }}
        />
      )}
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && schedule && (
        <DeleteConfirmModal
          schedule={schedule}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={() => deleteMutation.mutate()}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}

// Status Dropdown Component
function StatusDropdown({
  currentStatus,
  onStatusChange,
  isUpdating,
}: {
  currentStatus: ScheduleStatus;
  onStatusChange: (status: ScheduleStatus) => void;
  isUpdating: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const statusOptions: ScheduleStatus[] = ['draft', 'active', 'completed', 'archived'];

  const getStatusBadgeClass = (status: ScheduleStatus) => {
    switch (status) {
      case 'active':
        return 'badge-success';
      case 'completed':
        return 'bg-slate-100 text-slate-600';
      case 'archived':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'badge-warning';
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
          getStatusBadgeClass(currentStatus),
          isUpdating && "opacity-50 cursor-not-allowed"
        )}
      >
        {isUpdating ? (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            Atualizando...
          </>
        ) : (
          <>
            {SCHEDULE_STATUS_LABELS[currentStatus] || currentStatus}
            <ChevronDown className="w-3 h-3" />
          </>
        )}
      </button>

      {isOpen && !isUpdating && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
            {statusOptions.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => {
                  if (status !== currentStatus) {
                    onStatusChange(status);
                  }
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors first:rounded-t-lg last:rounded-b-lg",
                  status === currentStatus
                    ? "bg-primary-50 text-primary-700 font-medium"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  status === 'active' ? 'bg-green-500' :
                  status === 'completed' ? 'bg-slate-400' :
                  status === 'archived' ? 'bg-slate-500' :
                  'bg-yellow-500'
                )} />
                {SCHEDULE_STATUS_LABELS[status] || status}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  schedule,
  onClose,
  onConfirm,
  isDeleting,
}: {
  schedule: any;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <Modal>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl">
          <div className="p-6">
            <div className="w-14 h-14 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-7 h-7 text-red-600" />
            </div>

            <h2 className="text-xl font-display font-bold text-slate-900 text-center mb-2">
              Excluir Cronograma
            </h2>

            <p className="text-slate-600 text-center mb-6">
              Tem certeza que deseja excluir o cronograma <strong>"{schedule.name}"</strong>?
              Esta ação é <strong>irreversível</strong> e todos os dados associados serão permanentemente excluídos.
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                onClick={onConfirm}
                className="btn-danger flex-1"
                disabled={isDeleting}
              >
                {isDeleting ? (
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



