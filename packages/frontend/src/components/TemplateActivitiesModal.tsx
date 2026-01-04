import { useQuery } from '@tanstack/react-query';
import { X, Loader2, ListTodo, AlertCircle } from 'lucide-react';
import { templates } from '@/lib/api';
import { cn } from '@/lib/utils';

interface TemplateActivitiesModalProps {
  templateId: string;
  templateName: string;
  onClose: () => void;
}

interface TemplateActivity {
  id?: string;
  code: string;
  name: string;
  description?: string;
  duration?: string | number;
  durationUnit?: string;
  wbsPath?: string;
  predecessors?: string;
  resources?: string;
}

export function TemplateActivitiesModal({
  templateId,
  templateName,
  onClose,
}: TemplateActivitiesModalProps) {
  const activitiesQuery = useQuery({
    queryKey: ['template-activities', templateId],
    queryFn: () => templates.getActivities(templateId),
  });

  const activities = activitiesQuery.data?.data.items || [];
  const isLoading = activitiesQuery.isLoading;
  const error = activitiesQuery.error;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Atividades do Template
            </h2>
            <p className="text-sm text-slate-500 mt-1">{templateName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500 mx-auto mb-3" />
                <p className="text-slate-500">Carregando atividades...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <p className="text-red-600 font-medium mb-1">Erro ao carregar atividades</p>
                <p className="text-sm text-slate-500">
                  {error instanceof Error ? error.message : 'Erro desconhecido'}
                </p>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <div className="text-center">
                <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500">Nenhuma atividade encontrada neste template</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-auto p-6">
              <div className="mb-4 text-sm text-slate-600">
                Total: <strong>{activities.length}</strong> atividades
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Nome
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Descrição
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Duração
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        WBS
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Predecessores
                      </th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Recursos
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activities.map((activity: TemplateActivity, index: number) => (
                      <tr
                        key={activity.id || activity.code || index}
                        className="hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="text-sm font-mono text-slate-600">
                            {activity.code}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-slate-900">
                            {activity.name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600 line-clamp-2 max-w-xs">
                            {activity.description || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {activity.duration
                              ? `${activity.duration} ${activity.durationUnit || 'dias'}`
                              : '-'
                            }
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {activity.wbsPath || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {activity.predecessors || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-slate-600">
                            {activity.resources || '-'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="btn-secondary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

