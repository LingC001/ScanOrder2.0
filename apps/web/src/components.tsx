import { useEffect, useEffectEvent, useRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Minus, Plus, X } from 'lucide-react';
import { MAX_QUANTITY } from '@scanorder/contracts';

export function Button({
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`primary-button ${className}`}>
      {children}
    </button>
  );
}

export function Header({ title, backTo = '/choose' }: { title: string; backTo?: string }) {
  return (
    <header className="page-header">
      <Link to={backTo} className="icon-button absolute left-2" aria-label="返回">
        <ChevronLeft size={24} />
      </Link>
      <h1>{title}</h1>
    </header>
  );
}

export function Notice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return (
    <p className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>
      {children}
    </p>
  );
}

export function LoadingError({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  if (loading) return <Notice>正在加载，请稍候…</Notice>;
  if (error)
    return (
      <div className="px-5 py-8 text-center">
        <Notice error>{error}</Notice>
        <button className="mt-3 text-orange-600 underline underline-offset-4" onClick={retry}>
          重新加载
        </button>
      </div>
    );
  return null;
}

export function Quantity({
  name,
  value,
  onChange,
}: {
  name: string;
  value: number;
  onChange: (delta: 1 | -1) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="quantity-button quantity-minus"
        aria-label={`减少${name}`}
        onClick={() => onChange(-1)}
      >
        <Minus size={16} />
      </button>
      <span className="min-w-4 text-center text-sm" aria-label={`${name}数量`}>
        {value}
      </span>
      <button
        type="button"
        className="quantity-button"
        disabled={value >= MAX_QUANTITY}
        aria-label={`增加${name}`}
        onClick={() => onChange(1)}
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

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

export function FoodImage({
  src,
  name,
  className = '',
}: {
  src: string;
  name: string;
  className?: string;
}) {
  return (
    <img
      src={src}
      alt={name}
      className={`food-image ${className}`}
      loading="lazy"
      onError={(event) => {
        const image = event.currentTarget;
        if (!image.src.endsWith('/assets/shop.png')) image.src = '/assets/shop.png';
      }}
    />
  );
}

export function formatTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Shanghai',
  }).format(new Date(value));
}
