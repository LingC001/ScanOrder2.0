import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Minus, Plus } from 'lucide-react';
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
