import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { 
  ArrowLeft, 
  Download, 
  Table2, 
  GanttChart,
  FileDown,
  Loader2
} from 'lucide-react';
import { schedules } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { ScheduleTable } from '@/components/ScheduleTable';
import { Timeline } from '@/components/Timeline';
import { SCHEDULE_STATUS_LABELS } from '@planneer/shared';

type ViewMode = 'table' | 'timeline';

export function ScheduleDetail() {
  const { scheduleId } = useParams({ strict: false });
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  
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
  
  const schedule = scheduleQuery.data?.data;
  
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
              <span className={cn(
                "badge",
                schedule.status === 'active' ? 'badge-success' : 'badge-warning'
              )}>
                {SCHEDULE_STATUS_LABELS[schedule.status] || schedule.status}
              </span>
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
      <div className="flex-1 overflow-auto">
        {viewMode === 'table' ? (
          <ScheduleTable 
            activities={schedule.activities || []}
            onActivityClick={(activity) => console.log('Clicked:', activity)}
          />
        ) : (
          schedule.startDate && schedule.endDate && (
            <Timeline
              activities={schedule.activities || []}
              startDate={schedule.startDate}
              endDate={schedule.endDate}
            />
          )
        )}
      </div>
    </div>
  );
}



