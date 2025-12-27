import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { differenceInDays, format, addDays, startOfWeek, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Activity {
  id: string;
  code: string;
  name: string;
  duration: number;
  startDate: string | null;
  endDate: string | null;
  percentComplete: number;
  activityType: string;
}

interface TimelineProps {
  activities: Activity[];
  startDate: string;
  endDate: string;
}

export function Timeline({ activities, startDate, endDate }: TimelineProps) {
  const timelineData = useMemo(() => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = differenceInDays(end, start) + 1;
    
    // Generate weeks for header
    const weeks: { start: Date; end: Date; days: Date[] }[] = [];
    let currentWeekStart = startOfWeek(start, { locale: ptBR });
    
    while (currentWeekStart <= end) {
      const weekEnd = addDays(currentWeekStart, 6);
      const days = eachDayOfInterval({
        start: currentWeekStart < start ? start : currentWeekStart,
        end: weekEnd > end ? end : weekEnd,
      });
      
      weeks.push({
        start: currentWeekStart,
        end: weekEnd,
        days,
      });
      
      currentWeekStart = addDays(currentWeekStart, 7);
    }
    
    return { start, end, totalDays, weeks };
  }, [startDate, endDate]);
  
  const getActivityPosition = (activity: Activity) => {
    if (!activity.startDate || !activity.endDate) return null;
    
    const actStart = new Date(activity.startDate);
    const actEnd = new Date(activity.endDate);
    
    const startOffset = differenceInDays(actStart, timelineData.start);
    const duration = differenceInDays(actEnd, actStart) + 1;
    
    const leftPercent = (startOffset / timelineData.totalDays) * 100;
    const widthPercent = (duration / timelineData.totalDays) * 100;
    
    return { left: leftPercent, width: widthPercent };
  };
  
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[800px]">
        {/* Header with dates */}
        <div className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
          <div className="flex">
            {/* Activity name column */}
            <div className="w-64 flex-shrink-0 px-4 py-2 border-r border-slate-200">
              <span className="text-xs font-semibold text-slate-600 uppercase">
                Atividade
              </span>
            </div>
            
            {/* Timeline header */}
            <div className="flex-1 flex">
              {timelineData.weeks.map((week, i) => (
                <div 
                  key={i}
                  className="flex-1 text-center border-r border-slate-200 last:border-r-0"
                  style={{ minWidth: `${(week.days.length / timelineData.totalDays) * 100}%` }}
                >
                  <div className="text-xs font-medium text-slate-700 py-1 border-b border-slate-200">
                    {format(week.start, "dd MMM", { locale: ptBR })}
                  </div>
                  <div className="flex">
                    {week.days.map((day, j) => (
                      <div 
                        key={j} 
                        className={cn(
                          "flex-1 text-[10px] text-slate-400 py-0.5",
                          day.getDay() === 0 || day.getDay() === 6 ? "bg-slate-100" : ""
                        )}
                      >
                        {format(day, 'd')}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Activity rows */}
        <div className="divide-y divide-slate-100">
          {activities.map((activity) => {
            const position = getActivityPosition(activity);
            
            return (
              <div key={activity.id} className="flex group hover:bg-slate-50">
                {/* Activity name */}
                <div className="w-64 flex-shrink-0 px-4 py-2 border-r border-slate-200">
                  <p className="text-sm font-medium text-slate-900 truncate" title={activity.name}>
                    {activity.name}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{activity.code}</p>
                </div>
                
                {/* Timeline bar */}
                <div className="flex-1 relative h-12">
                  {position && (
                    <div
                      className={cn(
                        "absolute top-2 h-8 rounded-md transition-all",
                        activity.activityType === 'milestone'
                          ? "w-3 h-3 top-4 rotate-45 bg-amber-500"
                          : "bg-primary-500 group-hover:bg-primary-600"
                      )}
                      style={activity.activityType === 'milestone' 
                        ? { left: `${position.left}%` }
                        : { left: `${position.left}%`, width: `${Math.max(position.width, 1)}%` }
                      }
                    >
                      {activity.activityType !== 'milestone' && (
                        <>
                          {/* Progress bar */}
                          <div 
                            className="absolute inset-y-0 left-0 bg-primary-700 rounded-l-md"
                            style={{ width: `${activity.percentComplete}%` }}
                          />
                          {/* Activity name inside bar */}
                          <span className="absolute inset-0 flex items-center px-2 text-xs text-white font-medium truncate">
                            {activity.name}
                          </span>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}



