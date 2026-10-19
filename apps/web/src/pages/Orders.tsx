import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { formatMoney } from '@scanorder/contracts';
import { api } from '../api';
import { FoodImage, formatTime, Header, LoadingError, Notice } from '../components';
import { useResource } from '../useResource';

export function OrderList() {
  const resource = useResource(api.orders);
  return (
    <main className="page-shell">
      <Header title="订单列表" />
      <div className="page-scroll">
        <LoadingError {...resource} />
        {resource.data?.length === 0 && <Notice>暂无订单，快去选几道喜欢的菜吧</Notice>}
        {resource.data?.map((order) => (
          <Link
            key={order.id}
            to={`/listDetail?id=${order.id}`}
            className="white-card block"
            aria-label={`查看订单 ${order.id}`}
          >
            <div className="flex justify-between gap-3 text-sm">
              <h2 className="font-medium">{order.location}</h2>
              <span className="shrink-0 text-xs text-orange-600">
                {order.finished ? '订单已完成' : '订单未完成'}
              </span>
            </div>
            <div className="mt-6 flex justify-between text-sm">
              <span className="text-gray-500">菜品数量：共{order.totalQuantity}件菜品</span>
              <strong>￥{formatMoney(order.totalAmountCents)}</strong>
            </div>
            <p className="mt-3 text-xs text-gray-400">下单时间：{formatTime(order.createdAt)}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}

function Detail({ id }: { id: string }) {
  const load = useCallback((signal: AbortSignal) => api.order(id, signal), [id]);
  const resource = useResource(load);
  const order = resource.data;
  return (
    <>
      <LoadingError {...resource} />
      {order && (
        <>
          <section className="order-status">
            <h2 className="text-xl font-medium">{order.finished ? '订单已完成' : '订单未完成'}</h2>
            <p className="mt-2 text-xs">感谢光临，祝您用餐愉快</p>
          </section>
          <section className="white-card">
            {order.items.map((item) => (
              <div key={item.id} className="flex gap-3 py-3">
                <FoodImage src={item.imageUrl} name={item.name} className="h-14 w-14 rounded" />
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between gap-2 text-sm">
                    <span>{item.name}</span>
                    <span>￥{formatMoney(item.totalAmountCents)}</span>
                  </div>
                  <p className="mt-3 text-xs text-gray-400">数量：{item.quantity}</p>
                </div>
              </div>
            ))}
            <div className="mt-2 flex justify-between border-t border-gray-100 py-4 text-sm">
              <span className="text-gray-500">共{order.totalQuantity}份</span>
              <span>
                小计 ￥<strong>{formatMoney(order.totalAmountCents)}</strong>
              </span>
            </div>
          </section>
          <section className="white-card text-xs text-gray-500">
            <h2 className="mb-4 text-sm font-medium text-gray-800">订单信息</h2>
            <p className="break-all">订单编号：{order.id}</p>
            <p className="mt-3">下单时间：{formatTime(order.createdAt)}</p>
            <p className="mt-3">
              桌台名称：{order.tableNumber} · {order.guestCount}位
            </p>
            {order.comment && <p className="mt-3 break-words">备注：{order.comment}</p>}
          </section>
        </>
      )}
    </>
  );
}

export function OrderDetail() {
  const [params] = useSearchParams();
  const id = params.get('id');
  return (
    <main className="page-shell">
      <Header title="订单详情" backTo="/orderList" />
      <div className="page-scroll">
        {id ? <Detail key={id} id={id} /> : <Notice error>缺少订单编号</Notice>}
      </div>
    </main>
  );
}
