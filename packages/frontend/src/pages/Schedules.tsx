import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { Plus, Calendar, Search, Download, MoreVertical, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { schedules } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { SCHEDULE_STATUS_LABELS } from '@planneer/shared';
import { useState } from 'react';
import { createPortal } from 'react-dom';

// Modal wrapper using portal
function Modal({ children }: { children: React.ReactNode }) {
  return createPortal(children, document.body);
}

export function Schedules() {
  const [search, setSearch] = useState('');
  const [deletingSchedule, setDeletingSchedule] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const schedulesQuery = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedules.list(),
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => schedules.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      setDeletingSchedule(null);
      setOpenMenuId(null);
    },
  });
  
  const scheduleList = schedulesQuery.data?.data.items || [];
  
  const filteredSchedules = scheduleList.filter((schedule: any) =>
    schedule.name.toLowerCase().includes(search.toLowerCase()) ||
    schedule.project?.name?.toLowerCase().includes(search.toLowerCase())
  );
  
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Cronogramas</h1>
          <p className="text-slate-600 mt-1">Visualize e gerencie seus cronogramas</p>
        </div>
        <Link to="/chat" className="btn-primary">
          <Plus className="w-4 h-4 mr-2" />
          Novo Cronograma
        </Link>
      </div>
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cronogramas..."
          className="input pl-10 max-w-md"
        />
      </div>
      
      {/* Schedules Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Cronograma
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Projeto
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Período
              </th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {schedulesQuery.isLoading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-32" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-24" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-40" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16" /></td>
                  <td className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-8 ml-auto" /></td>
                </tr>
              ))
            ) : filteredSchedules.length > 0 ? (
              filteredSchedules.map((schedule: any) => (
                <tr key={schedule.id} className="hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <Link 
                      to={`/schedules/${schedule.id}`}
                      className="flex items-center gap-3 group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                        <Calendar className="w-5 h-5 text-emerald-600" />
                      </div>
                      <span className="font-medium text-slate-900 group-hover:text-primary-600 transition-colors">
                        {schedule.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-600">
                      {schedule.project?.name || '-'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-sm text-slate-600">
                      {schedule.startDate && schedule.endDate
                        ? `${formatDate(schedule.startDate)} - ${formatDate(schedule.endDate)}`
                        : schedule.startDate
                        ? `Início: ${formatDate(schedule.startDate)}`
                        : '-'
                      }
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      "badge",
                      schedule.status === 'active' ? 'badge-success' :
                      schedule.status === 'completed' ? 'bg-slate-100 text-slate-600' :
                      'badge-warning'
                    )}>
                      {SCHEDULE_STATUS_LABELS[schedule.status] || schedule.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-1 relative">
                      <button 
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setOpenMenuId(openMenuId === schedule.id ? null : schedule.id);
                        }}
                      >
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
                      {openMenuId === schedule.id && (
                        <>
                          <div 
                            className="fixed inset-0 z-10" 
                            onClick={() => setOpenMenuId(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-20">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDeletingSchedule(schedule);
                                setOpenMenuId(null);
                              }}
                              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 first:rounded-t-lg last:rounded-b-lg"
                            >
                              <Trash2 className="w-4 h-4" />
                              Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center">
                  <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">
                    {search ? 'Nenhum cronograma encontrado' : 'Nenhum cronograma ainda'}
                  </p>
                  <Link to="/chat" className="btn-primary mt-4 inline-flex">
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Cronograma
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {/* Delete Confirmation Modal */}
      {deletingSchedule && (
        <DeleteConfirmModal
          schedule={deletingSchedule}
          onClose={() => setDeletingSchedule(null)}
          onConfirm={() => deleteMutation.mutate(deletingSchedule.id)}
          isDeleting={deleteMutation.isPending}
        />
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




