import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Eye, Search } from 'lucide-react';
import { formatMoney, ORDER_STATUS_LABELS } from '@scanorder/contracts';
import type { Order, OrderStatus } from '@scanorder/contracts';
import { api } from '../../api';
import { formatTime, Modal } from '../../components';
import { useResource } from '../../useResource';
import {
  AdminMessage,
  AdminPageHeader,
  EmptyState,
  OrderStatusBadge,
  Pagination,
} from './AdminCommon';

export function AdminOrders() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | ''>('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [message, setMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const [operating, setOperating] = useState(false);

  const load = useCallback(
    (signal: AbortSignal) =>
      api.adminOrders({ page, pageSize: 20, search, status: status || undefined }, signal),
    [page, search, status],
  );
  const orders = useResource(load);

  function filter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function updateStatus(order: Order, next: 'accepted' | 'completed' | 'cancelled') {
    setOperating(true);
    setOperationError('');
    try {
      const updated = await api.updateOrderStatus(order.id, { status: next });
      setSelected(updated);
      setMessage(`订单已更新为${ORDER_STATUS_LABELS[updated.status]}`);
      orders.retry();
    } catch (failure) {
      setOperationError(failure instanceof Error ? failure.message : '订单操作失败');
    } finally {
      setOperating(false);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="订单管理"
        description="待接单和已接单订单可以继续处理，完成或取消后不可再次变更。"
      />
      {message && <AdminMessage>{message}</AdminMessage>}
      {(operationError || orders.error) && (
        <AdminMessage error>{operationError || orders.error}</AdminMessage>
      )}
      <section className="admin-card mb-4">
        <form
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
          onSubmit={filter}
        >
          <label className="admin-field mb-0">
            <span>订单号或桌号</span>
            <div className="relative">
              <Search size={16} className="absolute top-3 left-3 text-slate-400" />
              <input
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="输入完整或部分订单号、桌号"
              />
            </div>
          </label>
          <label className="admin-field mb-0">
            <span>状态</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as OrderStatus | '');
                setPage(1);
              }}
            >
              <option value="">全部状态</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="admin-primary-button self-end" type="submit">
            查询
          </button>
        </form>
      </section>
      <section className="admin-card">
        {orders.loading ? (
          <EmptyState>正在加载订单…</EmptyState>
        ) : orders.data?.items.length === 0 ? (
          <EmptyState>没有符合当前条件的订单。</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[780px]">
                <thead>
                  <tr>
                    <th>订单</th>
                    <th>桌台</th>
                    <th>菜品</th>
                    <th>金额</th>
                    <th>状态</th>
                    <th>下单时间</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.data?.items.map((order) => (
                    <tr key={order.id}>
                      <td className="font-mono text-xs">{order.id.slice(0, 8)}</td>
                      <td>{order.tableNumber}</td>
                      <td>{order.totalQuantity} 份</td>
                      <td>￥{formatMoney(order.totalAmountCents)}</td>
                      <td>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-slate-500">
                        {formatTime(order.createdAt)}
                      </td>
                      <td>
                        <div className="flex justify-end">
                          <button
                            className="admin-secondary-button"
                            onClick={() => {
                              setSelected(order);
                              setMessage('');
                              setOperationError('');
                            }}
                          >
                            <Eye size={14} />
                            查看
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={orders.data?.page ?? 1}
              totalPages={orders.data?.totalPages ?? 0}
              total={orders.data?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </section>
      {selected && (
        <Modal title="订单详情" onClose={() => setSelected(null)}>
          <div className="p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">桌台 {selected.tableNumber}</p>
                <h2 className="mt-1 text-lg font-semibold">
                  ￥{formatMoney(selected.totalAmountCents)}
                </h2>
              </div>
              <OrderStatusBadge status={selected.status} />
            </div>
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
              {selected.items.map((item) => (
                <div key={item.id} className="flex justify-between gap-3 px-3 py-3 text-sm">
                  <span>
                    {item.name} × {item.quantity}
                  </span>
                  <span>￥{formatMoney(item.totalAmountCents)}</span>
                </div>
              ))}
            </div>
            <dl className="mt-4 space-y-2 text-xs text-slate-500">
              <div className="flex justify-between gap-4">
                <dt>订单编号</dt>
                <dd className="break-all text-right font-mono">{selected.id}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>人数</dt>
                <dd>{selected.guestCount} 位</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>下单时间</dt>
                <dd>{formatTime(selected.createdAt)}</dd>
              </div>
              {selected.comment && (
                <div>
                  <dt>备注</dt>
                  <dd className="mt-1 break-words text-slate-700">{selected.comment}</dd>
                </div>
              )}
            </dl>
            {operationError && (
              <div className="mt-4">
                <AdminMessage error>{operationError}</AdminMessage>
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              {selected.status === 'pending' && (
                <button
                  className="admin-primary-button"
                  disabled={operating}
                  onClick={() => updateStatus(selected, 'accepted')}
                >
                  接单
                </button>
              )}
              {(selected.status === 'pending' || selected.status === 'accepted') && (
                <>
                  <button
                    className="admin-secondary-button"
                    disabled={operating}
                    onClick={() => updateStatus(selected, 'completed')}
                  >
                    完成订单
                  </button>
                  <button
                    className="admin-danger-button"
                    disabled={operating}
                    onClick={() => updateStatus(selected, 'cancelled')}
                  >
                    取消订单
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
