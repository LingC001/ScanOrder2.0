import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { formatMoney } from '@scanorder/contracts';
import { api } from '../api';
import { useCart } from '../CartProvider';
import { Button, FoodImage, Header, Modal, Notice } from '../components';

export function SubmitOrder() {
  const { state, dispatch, totals } = useCart();
  const navigate = useNavigate();
  const [commentOpen, setCommentOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  async function submit() {
    if (submitting.current || !totals.quantity) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await api.createOrder({
        tableNumber: state.tableNumber,
        guestCount: state.guestCount,
        comment: state.comment,
        items: state.items.map(({ food, quantity }) => ({ foodId: food.id, quantity })),
      });
      dispatch({ type: 'ordered' });
      navigate('/orderList', { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '下单失败，请重试');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return (
    <main className="page-shell">
      <Header title="提交订单" />
      <div className="page-scroll pb-28">
        {state.items.length === 0 ? (
          <div className="p-8 text-center">
            <Notice>购物车还是空的</Notice>
            <Link className="text-sm text-orange-600" to="/choose">
              返回菜单选菜
            </Link>
          </div>
        ) : (
          <>
            <p className="px-4 pt-4 text-xs text-gray-500">
              桌台 {state.tableNumber} · {state.guestCount}位
            </p>
            <section className="white-card">
              {state.items.map(({ food, quantity }) => (
                <div
                  key={food.id}
                  className="flex gap-3 border-b border-gray-100 py-4 last:border-0"
                >
                  <FoodImage src={food.imageUrl} name={food.name} className="h-14 w-14 rounded" />
                  <div className="min-w-0 flex-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span>{food.name}</span>
                      <span>￥{formatMoney(food.priceCents * quantity)}</span>
                    </div>
                    <p className="mt-3 text-xs text-gray-400">数量：{quantity}</p>
                  </div>
                </div>
              ))}
              <p className="border-t border-gray-100 py-4 text-right text-sm">
                小计：￥<strong>{formatMoney(totals.amountCents)}</strong>
              </p>
            </section>
            <button
              className="mx-4 flex w-[calc(100%-2rem)] items-center justify-between gap-4 bg-white px-4 py-4 text-sm"
              onClick={() => {
                setDraft(state.comment);
                setCommentOpen(true);
              }}
            >
              <span className="shrink-0">备注</span>
              <span className="ml-auto truncate text-gray-400">
                {state.comment || '口味、偏好等要求'}
              </span>
              <ChevronRight size={18} className="shrink-0 text-gray-400" />
            </button>
          </>
        )}
        {error && <Notice error>{error}</Notice>}
      </div>
      <footer className="checkout-footer">
        <span className="text-xl text-orange-600">￥{formatMoney(totals.amountCents)}</span>
        <Button disabled={pending || !totals.quantity} onClick={submit}>
          {pending ? '正在提交…' : '提交订单'}
        </Button>
      </footer>
      {commentOpen && (
        <Modal title="备注" onClose={() => setCommentOpen(false)}>
          <div className="p-4">
            <textarea
              autoFocus
              aria-label="订单备注"
              placeholder="请输入备注"
              maxLength={50}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="w-full resize-none rounded border border-gray-200 p-3 text-sm outline-orange-400"
              rows={3}
            />
            <p className="mt-1 text-right text-xs text-gray-400">{draft.length}/50</p>
            <Button
              className="mt-3 w-full"
              onClick={() => {
                dispatch({ type: 'comment', value: draft });
                setCommentOpen(false);
              }}
            >
              确认
            </Button>
          </div>
        </Modal>
      )}
    </main>
  );
}
