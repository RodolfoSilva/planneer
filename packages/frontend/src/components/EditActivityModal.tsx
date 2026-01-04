import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Save } from 'lucide-react';
import { createPortal } from 'react-dom';
import { activities, wbs as wbsApi } from '@/lib/api';
import { useToastContext } from '@/contexts/ToastContext';
import type { Activity, DurationUnit, ActivityType } from '@planneer/shared';

interface ActivityWithWBS extends Activity {
  wbs?: {
    code: string;
    name: string;
  } | null;
}

interface EditActivityModalProps {
  activity: ActivityWithWBS;
  onClose: () => void;
  scheduleId: string;
}

export function EditActivityModal({ activity, onClose, scheduleId }: EditActivityModalProps) {
  const queryClient = useQueryClient();
  const toast = useToastContext();
  
  // Fetch WBS items for the schedule
  const { data: wbsData } = useQuery({
    queryKey: ['wbs', scheduleId],
    queryFn: () => wbsApi.list(scheduleId),
    enabled: !!scheduleId,
  });

  const wbsItems = wbsData?.data || [];

  // Build tree structure from flat array and flatten for dropdown
  const buildTreeAndFlatten = (items: any[]): any[] => {
    if (items.length === 0) return [];

    // Build tree
    const map = new Map<string, any>();
    const roots: any[] = [];

    items.forEach(item => {
      map.set(item.id, { ...item, children: [] });
    });

    items.forEach(item => {
      const node = map.get(item.id)!;
      if (item.parentId && map.has(item.parentId)) {
        const parent = map.get(item.parentId);
        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    });

    // Sort roots and children by sortOrder
    const sortByOrder = (nodes: any[]) => {
      nodes.sort((a, b) => a.sortOrder - b.sortOrder);
      nodes.forEach(node => {
        if (node.children && node.children.length > 0) {
          sortByOrder(node.children);
        }
      });
    };

    sortByOrder(roots);

    // Flatten tree for dropdown with indentation
    const flatten = (nodes: any[], level = 0): any[] => {
      const result: any[] = [];
      nodes.forEach(node => {
        const indent = '  '.repeat(level);
        result.push({
          ...node,
          displayName: `${indent}${node.code} - ${node.name}`,
        });
        if (node.children && node.children.length > 0) {
          result.push(...flatten(node.children, level + 1));
        }
      });
      return result;
    };

    return flatten(roots);
  };

  const flatWBS = buildTreeAndFlatten(wbsItems);

  const [formData, setFormData] = useState({
    name: activity.name || '',
    description: activity.description || '',
    code: activity.code || '',
    duration: activity.duration || 0,
    durationUnit: (activity.durationUnit || 'days') as DurationUnit,
    startDate: activity.startDate ? new Date(activity.startDate).toISOString().split('T')[0] : '',
    endDate: activity.endDate ? new Date(activity.endDate).toISOString().split('T')[0] : '',
    percentComplete: activity.percentComplete || 0,
    activityType: (activity.activityType || 'task') as ActivityType,
    wbsId: (activity as any).wbsId || activity.wbs?.id || null,
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => activities.update(activity.id, {
      name: data.name,
      description: data.description || undefined,
      code: data.code,
      duration: data.duration,
      durationUnit: data.durationUnit,
      startDate: data.startDate || null,
      endDate: data.endDate || null,
      percentComplete: data.percentComplete,
      activityType: data.activityType,
      wbsId: data.wbsId || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      toast.success('Atividade atualizada com sucesso!');
      onClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar atividade. Tente novamente.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900">
            Editar Atividade
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
          {/* Code and Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Código *
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Tipo *
              </label>
              <select
                value={formData.activityType}
                onChange={(e) => handleChange('activityType', e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              >
                <option value="task">Tarefa</option>
                <option value="milestone">Marco</option>
                <option value="summary">Resumo</option>
                <option value="start_milestone">Marco Inicial</option>
                <option value="finish_milestone">Marco Final</option>
              </select>
            </div>
          </div>

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
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={updateMutation.isPending}
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
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Duração *
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={formData.duration}
                onChange={(e) => handleChange('duration', parseFloat(e.target.value) || 0)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Unidade *
              </label>
              <select
                value={formData.durationUnit}
                onChange={(e) => handleChange('durationUnit', e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              >
                <option value="hours">Horas</option>
                <option value="days">Dias</option>
                <option value="weeks">Semanas</option>
                <option value="months">Meses</option>
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Data de Início
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Data de Término
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          {/* Percent Complete */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Progresso (%)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="100"
                value={formData.percentComplete}
                onChange={(e) => handleChange('percentComplete', parseInt(e.target.value))}
                className="flex-1"
                disabled={updateMutation.isPending}
              />
              <span className="text-sm font-medium text-slate-700 w-12 text-right">
                {formData.percentComplete}%
              </span>
            </div>
          </div>

          {/* WBS Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              WBS
            </label>
            <select
              value={formData.wbsId || ''}
              onChange={(e) => handleChange('wbsId', e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={updateMutation.isPending}
            >
              <option value="">Nenhuma WBS</option>
              {flatWBS.map((wbsItem) => (
                <option key={wbsItem.id} value={wbsItem.id}>
                  {wbsItem.displayName}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Selecione a WBS à qual esta atividade pertence
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
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
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

