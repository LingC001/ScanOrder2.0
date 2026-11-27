import { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  children,
  onClose,
  className = '',
  preview = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  preview?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const closeFromKeyboard = useEffectEvent(onClose);
  useEffect(() => {
    const previous = document.activeElement;
    const panel = container.current;
    const first = panel?.querySelector<HTMLElement>('button,textarea,input,[tabindex="0"]');
    first?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeFromKeyboard();
      if (event.key !== 'Tab' || !panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not(:disabled),textarea,input,[tabindex="0"]'),
      );
      const start = nodes[0];
      const end = nodes.at(-1);
      if (event.shiftKey && document.activeElement === start) {
        event.preventDefault();
        end?.focus();
      } else if (!event.shiftKey && document.activeElement === end) {
        event.preventDefault();
        start?.focus();
      }
    }
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className={`modal-backdrop ${preview ? 'image-preview' : ''}`} onClick={onClose}>
      <div
        ref={container}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-panel ${className}`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="font-medium">{title}</h2>
          <button type="button" className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
