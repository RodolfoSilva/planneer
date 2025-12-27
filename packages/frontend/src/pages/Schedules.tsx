import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Plus, Calendar, Search, Download, MoreVertical } from 'lucide-react';
import { schedules } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { SCHEDULE_STATUS_LABELS } from '@planneer/shared';
import { useState } from 'react';

export function Schedules() {
  const [search, setSearch] = useState('');
  
  const schedulesQuery = useQuery({
    queryKey: ['schedules'],
    queryFn: () => schedules.list(),
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
                    <div className="flex items-center justify-end gap-1">
                      <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-slate-400" />
                      </button>
                      <button className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                        <MoreVertical className="w-4 h-4 text-slate-400" />
                      </button>
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
    </div>
  );
}



