import { useNavigate } from 'react-router-dom';
import { SHOP } from '@scanorder/contracts';
import { useCart } from '../CartProvider';
import { Button } from '../components';

export function Entry() {
  const { state, dispatch } = useCart();
  const navigate = useNavigate();
  return (
    <main className="entry-page">
      <div className="entry-brand">
        <div className="flex items-center justify-center gap-3">
          <span className="brand-square">美团</span>
          <span className="text-3xl font-bold">美团</span>
        </div>
        <p className="mt-5 text-center text-sm font-bold">欢迎来到{SHOP.name}</p>
      </div>
      <section className="entry-card">
        <h1 className="text-lg font-bold">客官，您几位？</h1>
        <p className="mt-3 text-sm text-gray-500">桌号：{state.tableNumber}</p>
        <div className="my-8 flex justify-between gap-1" aria-label="用餐人数">
          {[1, 2, 3, 4, 5].map((count) => (
            <button
              key={count}
              aria-pressed={state.guestCount === count}
              onClick={() => dispatch({ type: 'guests', value: count })}
              className={`guest-option ${state.guestCount === count ? 'selected' : ''}`}
            >
              {count}人
            </button>
          ))}
        </div>
        <Button className="w-full" onClick={() => navigate('/choose')}>
          开始点餐
        </Button>
      </section>
      <p className="entry-footer">美团餐饮系统提供技术支持</p>
    </main>
  );
}
