import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  FileStack, 
  Upload, 
  Search, 
  Trash2,
  FileText,
  Loader2,
  AlertCircle,
  Building2
} from 'lucide-react';
import { templates } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { PROJECT_TYPE_LABELS } from '@planneer/shared';
import { useOrganization } from '@/hooks/useOrganization';

export function Templates() {
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  
  const { currentOrganization, isLoading: isOrgLoading } = useOrganization();
  const defaultOrgId = currentOrganization?.id;
  
  const templatesQuery = useQuery({
    queryKey: ['templates'],
    queryFn: () => templates.list(),
  });
  
  const uploadMutation = useMutation({
    mutationFn: ({ file, organizationId }: { file: File; organizationId: string }) =>
      templates.upload(file, organizationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      setError(null);
    },
    onError: (err: Error) => {
      setError(err.message || 'Falha ao importar template. Verifique se você está autenticado.');
    },
  });
  
  const deleteMutation = useMutation({
    mutationFn: (id: string) => templates.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (err: Error) => {
      setError(err.message || 'Falha ao excluir template.');
    },
  });
  
  const templateList = templatesQuery.data?.data.items || [];
  
  const filteredTemplates = templateList.filter((template: any) =>
    template.name.toLowerCase().includes(search.toLowerCase()) ||
    template.description?.toLowerCase().includes(search.toLowerCase())
  );
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!defaultOrgId) {
        setError('Organização não encontrada.');
        return;
      }
      setError(null);
      uploadMutation.mutate({ file, organizationId: defaultOrgId });
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  };
  
  const isLoading = isOrgLoading;
  
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Templates</h1>
          <p className="text-slate-600 mt-1">
            Importe arquivos XER/XML para usar como referência na geração de cronogramas
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xer,.xml"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadMutation.isPending || isLoading}
            className="btn-primary"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Importar Template
          </button>
        </div>
      </div>
      
      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-800 font-medium">Erro</p>
            <p className="text-red-600 text-sm">{error}</p>
          </div>
          <button 
            onClick={() => setError(null)}
            className="ml-auto text-red-400 hover:text-red-600"
          >
            ×
          </button>
        </div>
      )}
      
      {/* Organization Info */}
      {currentOrganization && (
        <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-sm text-slate-600">
          <Building2 className="w-4 h-4" />
          <span>Organização: <strong>{currentOrganization.name}</strong></span>
        </div>
      )}
      
      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar templates..."
          className="input pl-10 max-w-md"
        />
      </div>
      
      {/* Templates Grid */}
      {templatesQuery.isLoading || isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-6 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-3" />
              <div className="h-4 bg-slate-200 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template: any) => (
            <div
              key={template.id}
              className="card p-6 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center",
                  template.organizationId ? "bg-amber-100" : "bg-slate-100"
                )}>
                  <FileStack className={cn(
                    "w-6 h-6",
                    template.organizationId ? "text-amber-600" : "text-slate-500"
                  )} />
                </div>
                {template.organizationId && (
                  <button 
                    className="p-1 hover:bg-slate-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      if (confirm('Tem certeza que deseja excluir este template?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                  </button>
                )}
              </div>
              
              <h3 className="font-semibold text-slate-900 mb-1">
                {template.name}
              </h3>
              
              {template.description && (
                <p className="text-sm text-slate-500 mb-3 line-clamp-2">
                  {template.description}
                </p>
              )}
              
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="badge badge-primary">
                  {PROJECT_TYPE_LABELS[template.type as keyof typeof PROJECT_TYPE_LABELS] || template.type}
                </span>
                <span className="badge bg-slate-100 text-slate-600">
                  {template.sourceFormat?.toUpperCase()}
                </span>
                {!template.organizationId && (
                  <span className="badge bg-emerald-100 text-emerald-700">
                    Sistema
                  </span>
                )}
              </div>
              
              <div className="flex items-center justify-between text-sm text-slate-500 pt-4 border-t border-slate-100">
                <span className="flex items-center gap-1">
                  <FileText className="w-4 h-4" />
                  {template.activityCount || 0} atividades
                </span>
                <span>{formatDate(template.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-12 text-center">
          <FileStack className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Nenhum template encontrado
          </h3>
          <p className="text-slate-500 mb-6">
            {search 
              ? 'Tente uma busca diferente'
              : 'Importe arquivos XER ou XML para criar templates de referência'
            }
          </p>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || uploadMutation.isPending}
            className="btn-primary"
          >
            {uploadMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Importar Primeiro Template
          </button>
        </div>
      )}
    </div>
  );
}
