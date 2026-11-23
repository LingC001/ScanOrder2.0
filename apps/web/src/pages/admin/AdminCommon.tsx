import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { FOOD_STATUS_LABELS, ORDER_STATUS_LABELS } from '@scanorder/contracts';
import type { FoodStatus, OrderStatus } from '@scanorder/contracts';

export function AdminPageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function AdminMessage({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? 'alert' : 'status'}
      className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
        error
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
      }`}
    >
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center text-sm text-slate-500">
      <Inbox size={32} className="mb-3 text-slate-300" />
      {children}
    </div>
  );
}

export function FoodStatusBadge({ status }: { status: FoodStatus }) {
  const color =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'archived'
        ? 'bg-slate-100 text-slate-500'
        : 'bg-amber-50 text-amber-700';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${color}`}>
      {FOOD_STATUS_LABELS[status]}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const color =
    status === 'pending'
      ? 'bg-orange-50 text-orange-700'
      : status === 'accepted'
        ? 'bg-blue-50 text-blue-700'
        : status === 'completed'
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-slate-100 text-slate-500';
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs ${color}`}>
      {ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <span>共 {total} 条</span>
      <div className="flex items-center gap-2">
        <button
          className="admin-secondary-button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="上一页"
        >
          <ChevronLeft size={16} />
        </button>
        <span>
          {totalPages ? page : 0} / {totalPages}
        </span>
        <button
          className="admin-secondary-button"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="下一页"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
