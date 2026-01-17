import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Loader2, Save } from 'lucide-react';
import { createPortal } from 'react-dom';
import { wbs } from '@/lib/api';
import type { WBS } from '@planneer/shared';

interface EditWBSModalProps {
  wbsItem?: WBS | null;
  scheduleId: string;
  parentId?: string | null;
  onClose: () => void;
}

export function EditWBSModal({ wbsItem, scheduleId, parentId, onClose }: EditWBSModalProps) {
  const queryClient = useQueryClient();
  const isEditing = !!wbsItem;
  
  const [formData, setFormData] = useState({
    code: wbsItem?.code || '',
    name: wbsItem?.name || '',
    parentId: wbsItem?.parentId || parentId || null,
  });

  // Fetch all WBS items to build parent selector
  const { data: wbsData } = useQuery({
    queryKey: ['wbs', scheduleId],
    queryFn: () => wbs.list(scheduleId),
    enabled: !!scheduleId,
  });

  const wbsItems = wbsData?.data || [];

  // Build tree structure for parent selector (excluding current item and its descendants)
  const getAvailableParents = () => {
    if (!wbsItem) return wbsItems;
    
    // Filter out current item and its descendants
    const excludeIds = new Set([wbsItem.id]);
    const findDescendants = (id: string) => {
      wbsItems.forEach(item => {
        if (item.parentId === id) {
          excludeIds.add(item.id);
          findDescendants(item.id);
        }
      });
    };
    findDescendants(wbsItem.id);
    
    return wbsItems.filter(item => !excludeIds.has(item.id));
  };

  const availableParents = getAvailableParents();

  const createMutation = useMutation({
    mutationFn: (data: typeof formData) => wbs.create({
      scheduleId,
      parentId: data.parentId || undefined,
      code: data.code,
      name: data.name,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: typeof formData) => wbs.update(wbsItem!.id, {
      code: data.code,
      name: data.name,
      parentId: data.parentId,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wbs', scheduleId] });
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-display font-bold text-slate-900">
            {isEditing ? 'Editar WBS' : 'Adicionar WBS'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            disabled={isLoading}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Código *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) => handleChange('code', e.target.value)}
              required
              maxLength={50}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
              placeholder="Ex: 1.1, 1.2.1, etc."
            />
            <p className="text-xs text-slate-500 mt-1">
              Código único da WBS (ex: 1.1, 1.2.1)
            </p>
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
              maxLength={255}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
              placeholder="Nome da WBS"
            />
          </div>

          {/* Parent */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              WBS Pai
            </label>
            <select
              value={formData.parentId || ''}
              onChange={(e) => handleChange('parentId', e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              disabled={isLoading}
            >
              <option value="">Nenhuma (WBS raiz)</option>
              {availableParents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.code} - {item.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Selecione uma WBS pai para criar uma hierarquia
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  {isEditing ? 'Salvar' : 'Criar'}
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



