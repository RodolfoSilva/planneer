import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { cn } from '@/lib/utils';
import { activities } from '@/lib/api';
import { useToastContext } from '@/contexts/ToastContext';
import { Milestone, ListTodo, GripVertical, Calendar, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface Activity {
  id: string;
  code: string;
  name: string;
  duration: number;
  startDate: string | null;
  endDate: string | null;
  actualStart: string | null;
  actualEnd: string | null;
  percentComplete: number;
  activityType: string;
  wbs?: {
    code: string;
    name: string;
  } | null;
}

interface KanbanBoardProps {
  activities: Activity[];
  scheduleId: string;
  onActivityClick?: (activity: Activity) => void;
}

type ActivityStatus = 'not_started' | 'in_progress' | 'completed';

// Helper function to determine activity status
function getActivityStatus(activity: Activity): ActivityStatus {
  if (activity.percentComplete === 100 || activity.actualEnd) {
    return 'completed';
  }
  if (activity.percentComplete > 0 || activity.actualStart) {
    return 'in_progress';
  }
  return 'not_started';
}

// Helper function to update activity status when moved
function getStatusUpdateData(newStatus: ActivityStatus, activity: Activity) {
  const today = new Date().toISOString().split('T')[0];
  
  switch (newStatus) {
    case 'not_started':
      return {
        percentComplete: 0,
        actualStart: null,
        actualEnd: null,
      };
    case 'in_progress':
      return {
        percentComplete: activity.percentComplete > 0 ? activity.percentComplete : 10,
        actualStart: activity.actualStart || today,
        actualEnd: null,
      };
    case 'completed':
      return {
        percentComplete: 100,
        actualStart: activity.actualStart || activity.startDate || today,
        actualEnd: activity.actualEnd || today,
      };
  }
}

const STATUS_CONFIG: Record<ActivityStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  not_started: {
    label: 'Não Iniciado',
    color: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
  },
  in_progress: {
    label: 'Em Progresso',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  completed: {
    label: 'Concluído',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
};

// Sortable Activity Card Component
function SortableActivityCard({
  activity,
  onClick,
}: {
  activity: Activity;
  onClick?: () => void;
}) {
  const status = getActivityStatus(activity);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "bg-white rounded-lg border border-slate-200 p-3 mb-2 cursor-pointer hover:shadow-md transition-all",
        isDragging && "shadow-lg"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div
          {...attributes}
          {...listeners}
          className="mt-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600"
        >
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {activity.activityType === 'milestone' ? (
              <Milestone className="w-4 h-4 text-amber-500 flex-shrink-0" />
            ) : (
              <ListTodo className="w-4 h-4 text-slate-400 flex-shrink-0" />
            )}
            <span className="text-xs font-mono text-slate-600 truncate">
              {activity.code}
            </span>
          </div>
          <h4 className="text-sm font-medium text-slate-900 mb-2 line-clamp-2">
            {activity.name}
          </h4>
          
          {/* Progress bar */}
          {activity.percentComplete > 0 && (
            <div className="mb-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-500">Progresso</span>
                <span className="text-xs font-medium text-slate-700">
                  {activity.percentComplete}%
                </span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
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
            </div>
          )}

          {/* Dates */}
          <div className="space-y-1">
            {activity.startDate && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Calendar className="w-3 h-3" />
                <span>{formatDate(activity.startDate)}</span>
              </div>
            )}
            {activity.duration > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock className="w-3 h-3" />
                <span>{activity.duration}d</span>
              </div>
            )}
          </div>

          {/* WBS info */}
          {activity.wbs && (
            <div className="mt-2 pt-2 border-t border-slate-100">
              <p className="text-xs text-slate-500 truncate">
                {activity.wbs.code} - {activity.wbs.name}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Column Component
function KanbanColumn({
  status,
  activities,
  onActivityClick,
}: {
  status: ActivityStatus;
  activities: Activity[];
  onActivityClick?: (activity: Activity) => void;
}) {
  const config = STATUS_CONFIG[status];
  const sortableIds = activities.map(a => a.id);
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-1 min-w-[280px] rounded-lg border-2 border-dashed transition-colors",
        config.bgColor,
        config.borderColor,
        isOver && "border-primary-400 bg-opacity-80"
      )}
    >
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className={cn("text-sm font-semibold uppercase tracking-wide", config.color)}>
            {config.label}
          </h3>
          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", config.bgColor, config.color)}>
            {activities.length}
          </span>
        </div>
        
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[100px]">
            {activities.map((activity) => (
              <SortableActivityCard
                key={activity.id}
                activity={activity}
                onClick={() => onActivityClick?.(activity)}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  );
}

export function KanbanBoard({ activities, scheduleId, onActivityClick }: KanbanBoardProps) {
  const queryClient = useQueryClient();
  const toast = useToastContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [items, setItems] = useState<Record<ActivityStatus, Activity[]>>(() => {
    const grouped: Record<ActivityStatus, Activity[]> = {
      not_started: [],
      in_progress: [],
      completed: [],
    };
    
    activities.forEach(activity => {
      const status = getActivityStatus(activity);
      grouped[status].push(activity);
    });
    
    return grouped;
  });

  // Update items when activities change
  useMemo(() => {
    const grouped: Record<ActivityStatus, Activity[]> = {
      not_started: [],
      in_progress: [],
      completed: [],
    };
    
    activities.forEach(activity => {
      const status = getActivityStatus(activity);
      grouped[status].push(activity);
    });
    
    setItems(grouped);
  }, [activities]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const updateActivityMutation = useMutation({
    mutationFn: ({ activityId, data }: { activityId: string; data: any }) =>
      activities.update(activityId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar atividade');
    },
  });

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Find which column the active item is in
    const activeStatus = Object.keys(items).find(status =>
      items[status as ActivityStatus].some(a => a.id === activeId)
    ) as ActivityStatus | undefined;
    
    if (!activeStatus) return;
    
    // Check if over is a column (status) directly
    let overStatus: ActivityStatus | undefined = undefined;
    if (overId === 'not_started' || overId === 'in_progress' || overId === 'completed') {
      overStatus = overId as ActivityStatus;
    } else {
      // Check if over is an activity in a column
      overStatus = Object.keys(items).find(status =>
        items[status as ActivityStatus].some(a => a.id === overId)
      ) as ActivityStatus | undefined;
    }
    
    // If dragging over a different column
    if (overStatus && overStatus !== activeStatus) {
      const activeItem = items[activeStatus].find(a => a.id === activeId);
      if (activeItem) {
        setItems(prev => {
          const newItems = { ...prev };
          // Remove from current column if not already removed
          if (newItems[activeStatus].some(a => a.id === activeId)) {
            newItems[activeStatus] = newItems[activeStatus].filter(a => a.id !== activeId);
          }
          // Add to new column if not already there
          if (!newItems[overStatus].some(a => a.id === activeId)) {
            newItems[overStatus] = [...newItems[overStatus], activeItem];
          }
          return newItems;
        });
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) {
      setActiveId(null);
      return;
    }
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Find which column the active item is in
    const activeStatus = Object.keys(items).find(status =>
      items[status as ActivityStatus].some(a => a.id === activeId)
    ) as ActivityStatus | undefined;
    
    if (!activeStatus) {
      setActiveId(null);
      return;
    }
    
    // Check if dropped in a column (status) directly
    let overStatus: ActivityStatus | undefined = undefined;
    if (overId === 'not_started' || overId === 'in_progress' || overId === 'completed') {
      overStatus = overId as ActivityStatus;
    } else {
      // Check if dropped on an activity in a column
      overStatus = Object.keys(items).find(status =>
        items[status as ActivityStatus].some(a => a.id === overId)
      ) as ActivityStatus | undefined;
    }
    
    if (overStatus && overStatus !== activeStatus) {
      const activeItem = items[activeStatus].find(a => a.id === activeId);
      if (activeItem) {
        // Update the activity status
        const updateData = getStatusUpdateData(overStatus, activeItem);
        updateActivityMutation.mutate({
          activityId: activeId,
          data: updateData,
        });
        
        // Optimistically update UI
        setItems(prev => {
          const newItems = { ...prev };
          newItems[activeStatus] = newItems[activeStatus].filter(a => a.id !== activeId);
          newItems[overStatus] = [...newItems[overStatus], activeItem];
          return newItems;
        });
      }
    } else if (overStatus === activeStatus) {
      // Reorder within the same column
      const activeIndex = items[activeStatus].findIndex(a => a.id === activeId);
      const overIndex = items[activeStatus].findIndex(a => a.id === overId);
      
      if (activeIndex !== overIndex && overIndex !== -1) {
        setItems(prev => ({
          ...prev,
          [activeStatus]: arrayMove(prev[activeStatus], activeIndex, overIndex),
        }));
      }
    }
    
    setActiveId(null);
  }

  const activeActivity = activeId
    ? [...items.not_started, ...items.in_progress, ...items.completed].find(
        a => a.id === activeId
      )
    : null;

  return (
    <div className="h-full overflow-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 min-w-max">
          {(Object.keys(STATUS_CONFIG) as ActivityStatus[]).map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              activities={items[status]}
              onActivityClick={onActivityClick}
            />
          ))}
        </div>
        
        <DragOverlay>
          {activeActivity ? (
            <div className="bg-white rounded-lg border-2 border-primary-500 shadow-xl p-3 w-64">
              <div className="flex items-center gap-2 mb-1">
                {activeActivity.activityType === 'milestone' ? (
                  <Milestone className="w-4 h-4 text-amber-500" />
                ) : (
                  <ListTodo className="w-4 h-4 text-slate-400" />
                )}
                <span className="text-xs font-mono text-slate-600">
                  {activeActivity.code}
                </span>
              </div>
              <h4 className="text-sm font-medium text-slate-900">
                {activeActivity.name}
              </h4>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      
      {activities.length === 0 && (
        <div className="text-center py-12">
          <ListTodo className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma atividade encontrada</p>
        </div>
      )}
    </div>
  );
}

