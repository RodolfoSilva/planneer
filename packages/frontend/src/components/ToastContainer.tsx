import { ToastComponent } from './Toast';
import type { Toast } from './Toast';

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          className="pointer-events-auto"
          style={{ 
            transform: `translateY(${index * -8}px)`,
            zIndex: 50 + index 
          }}
        >
          <ToastComponent
            toast={toast}
            onClose={() => onRemove(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}

