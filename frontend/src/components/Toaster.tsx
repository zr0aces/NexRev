import React from 'react';
import { Check, AlertCircle, Info, X } from 'lucide-react';
import { useToast, Toast } from '../context/ToastContext';

export default function Toaster() {
  const { toasts, removeToast } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div className="toaster-container">
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: Toast, onRemove: () => void }) {
  const Icon = toast.type === 'success' ? Check : toast.type === 'error' ? AlertCircle : Info;
  
  return (
    <div className={`toast-item toast-item--${toast.type}`}>
      <div className="toast-icon">
        <Icon size={18} />
      </div>
      <div className="toast-message">{toast.message}</div>
      <button className="toast-close" onClick={onRemove}>
        <X size={16} />
      </button>
    </div>
  );
}
