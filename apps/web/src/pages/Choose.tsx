import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ClipboardList, Plus, ShoppingCart, Trash2, Utensils } from 'lucide-react';
import { formatMoney, SHOP } from '@scanorder/contracts';
import type { Food } from '@scanorder/contracts';
import { api } from '../api';
import { useCart } from '../CartProvider';
import { FoodImage, LoadingError, Modal, Notice, Quantity } from '../components';
import { useResource } from '../useResource';

export function Choose() {
  const resource = useResource(api.foods);
  const { state, dispatch, totals } = useCart();
  const navigate = useNavigate();
  const [category, setCategory] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [preview, setPreview] = useState<Food | null>(null);
  const foods = resource.data ?? [];
  const categories = [...new Set(foods.map((food) => food.category))];
  const selected = category && categories.includes(category) ? category : categories[0];
  const recommended = foods.filter((food) => food.recommended);
  const add = (food: Food) => dispatch({ type: 'add', food });
  return (
    <main className="choose-page">
      <header className="flex shrink-0 items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2 text-sm">
          <Utensils size={20} />
          <span>
            桌台{' '}
            <strong>
              {state.tableNumber} · {state.guestCount}
            </strong>{' '}
            位
          </span>
        </div>
        <Link to="/orderList" className="icon-button" aria-label="订单列表">
          <ClipboardList size={22} />
        </Link>
      </header>
      <section className="shrink-0 px-4 pb-3">
        <h1 className="text-base font-bold">{SHOP.name}</h1>
        <div className="mt-2 flex items-center justify-between gap-2 text-xs text-gray-500">
          <p>{SHOP.welcome}</p>
          <Link to="/shopDetail" className="flex shrink-0 items-center gap-1">
            展开全部
            <ChevronDown size={13} />
          </Link>
        </div>
      </section>
      <LoadingError {...resource} />
      {!resource.loading && !resource.error && foods.length === 0 && (
        <Notice>暂无菜品，请稍后再来</Notice>
      )}
      {recommended.length > 0 && (
        <section className="shrink-0 bg-gray-50 py-3" aria-label="老板推荐">
          <h2 className="mb-2 px-4 text-xs text-gray-500">老板推荐</h2>
          <div className="recommend-strip">
            {recommended.map((food) => (
              <article key={food.id} className="recommend-card">
                <button
                  className="block"
                  aria-label={`预览${food.name}`}
                  onClick={() => setPreview(food)}
                >
                  <FoodImage src={food.imageUrl} name={food.name} className="h-[110px] w-[110px]" />
                </button>
                <div className="px-2 pt-2 pb-2">
                  <h3 className="truncate text-xs">{food.name}</h3>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-orange-600">
                      ￥{formatMoney(food.priceCents)}
                    </span>
                    <button
                      className="quantity-button"
                      aria-label={`选购${food.name}`}
                      onClick={() => add(food)}
                    >
                      <Plus size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      {foods.length > 0 && (
        <section className="menu-area" aria-label="菜品菜单">
          <nav className="category-list" aria-label="菜品分类">
            {categories.map((name) => (
              <button
                key={name}
                aria-pressed={selected === name}
                className={selected === name ? 'active' : ''}
                onClick={() => setCategory(name)}
              >
                {name}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto px-3">
            <h2 className="sticky top-0 bg-white pt-3 pb-2 text-sm font-medium">{selected}</h2>
            {foods
              .filter((food) => food.category === selected)
              .map((food) => (
                <article key={food.id} className="menu-item">
                  <button
                    className="shrink-0"
                    aria-label={`预览${food.name}`}
                    onClick={() => setPreview(food)}
                  >
                    <FoodImage
                      src={food.imageUrl}
                      name={food.name}
                      className="h-[76px] w-[76px] rounded"
                    />
                  </button>
                  <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                    <div>
                      <h3 className="text-sm font-medium">{food.name}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-gray-400">{food.description}</p>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm text-orange-600">
                        ￥{formatMoney(food.priceCents)}
                      </span>
                      <button
                        className="quantity-button"
                        aria-label={`选购${food.name}`}
                        onClick={() => add(food)}
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
          </div>
        </section>
      )}
      <footer className="cart-footer">
        <button
          className="cart-icon"
          aria-label="查看购物车"
          disabled={!totals.quantity}
          onClick={() => setCartOpen(!cartOpen)}
        >
          <ShoppingCart size={26} />
          {totals.quantity > 0 && <span className="cart-badge">{totals.quantity}</span>}
        </button>
        <span className="flex-1 text-sm">
          {totals.quantity ? `￥${formatMoney(totals.amountCents)}` : '未选购商品'}
        </span>
        <button
          className="finish-button"
          disabled={!totals.quantity}
          onClick={() => navigate('/submitOrder')}
        >
          选好了
        </button>
      </footer>
      {cartOpen && totals.quantity > 0 && (
        <Modal
          title={`已选${totals.quantity}份`}
          className="cart-modal"
          onClose={() => setCartOpen(false)}
        >
          <div className="flex justify-end px-4 pt-3">
            <button
              className="flex items-center gap-1 text-xs text-gray-500"
              onClick={() => {
                dispatch({ type: 'clear' });
                setCartOpen(false);
              }}
            >
              <Trash2 size={14} />
              清空购物车
            </button>
          </div>
          <div className="max-h-[45dvh] overflow-y-auto p-4">
            {state.items.map(({ food, quantity }) => (
              <div key={food.id} className="flex items-center justify-between gap-2 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{food.name}</p>
                  <p className="mt-1 text-xs text-orange-600">
                    ￥{formatMoney(food.priceCents * quantity)}
                  </p>
                </div>
                <Quantity
                  name={food.name}
                  value={quantity}
                  onChange={(delta) => dispatch({ type: 'quantity', id: food.id, delta })}
                />
              </div>
            ))}
          </div>
        </Modal>
      )}
      {preview && (
        <Modal title={preview.name} preview onClose={() => setPreview(null)}>
          <img
            src={preview.imageUrl}
            alt={preview.name}
            className="max-h-[75dvh] w-full object-contain"
          />
        </Modal>
      )}
    </main>
  );
}
