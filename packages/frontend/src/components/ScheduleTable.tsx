import { cn } from '@/lib/utils';
import { ChevronRight, Milestone, ListTodo } from 'lucide-react';

interface Activity {
  id: string;
  code: string;
  name: string;
  duration: number;
  startDate: string | null;
  endDate: string | null;
  percentComplete: number;
  activityType: string;
  wbs?: {
    code: string;
    name: string;
  } | null;
}

interface ScheduleTableProps {
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
}

export function ScheduleTable({ activities, onActivityClick }: ScheduleTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Código
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Atividade
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Duração
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Início
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Término
            </th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Progresso
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {activities.map((activity) => (
            <tr 
              key={activity.id}
              className={cn(
                "hover:bg-slate-50 transition-colors cursor-pointer",
                activity.activityType === 'milestone' && "bg-amber-50/50"
              )}
              onClick={() => onActivityClick?.(activity)}
            >
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {activity.activityType === 'milestone' ? (
                    <Milestone className="w-4 h-4 text-amber-500" />
                  ) : (
                    <ListTodo className="w-4 h-4 text-slate-400" />
                  )}
                  <span className="text-sm font-mono text-slate-600">
                    {activity.code}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {activity.name}
                  </p>
                  {activity.wbs && (
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <ChevronRight className="w-3 h-3" />
                      {activity.wbs.name}
                    </p>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={cn(
                  "text-sm",
                  activity.duration === 0 ? "text-slate-400" : "text-slate-700"
                )}>
                  {activity.duration === 0 ? '-' : `${activity.duration}d`}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-slate-600">
                  {activity.startDate 
                    ? new Date(activity.startDate).toLocaleDateString('pt-BR')
                    : '-'
                  }
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-slate-600">
                  {activity.endDate 
                    ? new Date(activity.endDate).toLocaleDateString('pt-BR')
                    : '-'
                  }
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden max-w-[100px]">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        activity.percentComplete === 100 
                          ? "bg-emerald-500" 
                          : "bg-primary-500"
                      )}
                      style={{ width: `${activity.percentComplete}%` }}
                    />
                  </div>
                  <span className="text-xs text-slate-500 w-8">
                    {activity.percentComplete}%
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {activities.length === 0 && (
        <div className="text-center py-12">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma atividade encontrada</p>
        </div>
      )}
    </div>
  );
}



