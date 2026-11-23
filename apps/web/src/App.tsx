import { useEffect, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import type { AuthStatus } from '@scanorder/contracts';
import { CartProvider } from './CartProvider';
import { CustomerSessionContext } from './CustomerSession';
import { api } from './api';
import { Button, Notice } from './components';
import { AdminApp } from './pages/admin/AdminApp';
import { Choose } from './pages/Choose';
import { Entry } from './pages/Entry';
import { OrderDetail, OrderList } from './pages/Orders';
import { ShopDetail } from './pages/ShopDetail';
import { SubmitOrder } from './pages/SubmitOrder';

function CustomerLogin({ status, onLogin }: { status: AuthStatus; onLogin: () => Promise<void> }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function login() {
    setPending(true);
    setError('');
    try {
      await onLogin();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '登录失败，请重试');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="page-shell items-center justify-center px-5">
      <section className="white-card w-full text-center">
        <p className="text-xs tracking-[0.2em] text-orange-500">SCANORDER</p>
        <h1 className="mt-3 text-2xl font-semibold text-gray-900">顾客登录</h1>
        <p className="mt-3 text-sm text-gray-500">使用默认顾客账号开始点餐并查看订单</p>
        <div className="mt-5 rounded-lg bg-orange-50 px-4 py-3 text-left text-sm text-gray-700">
          <span className="text-xs text-gray-500">当前账号</span>
          <strong className="mt-1 block">{status.displayName ?? '顾客'}</strong>
        </div>
        {error && <Notice error>{error}</Notice>}
        <Button className="mt-5 w-full" onClick={login} disabled={pending}>
          {pending ? '正在登录…' : '登录并开始点餐'}
        </Button>
      </section>
    </main>
  );
}

function CustomerApp() {
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .customerAuth()
      .then(setAuth)
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure.message : '无法连接顾客登录服务'),
      );
  }, []);

  async function login() {
    setAuth(await api.loginCustomer());
  }

  async function logout() {
    await api.logoutCustomer();
    setAuth({ enabled: true, authenticated: false, displayName: null });
  }

  if (error)
    return (
      <div className="customer-root">
        <main className="page-shell items-center justify-center px-5">
          <Notice error>{error}</Notice>
        </main>
      </div>
    );
  if (!auth)
    return (
      <div className="customer-root">
        <main className="page-shell items-center justify-center px-5">
          <Notice>正在确认登录状态…</Notice>
        </main>
      </div>
    );
  if (!auth.enabled)
    return (
      <div className="customer-root">
        <main className="page-shell items-center justify-center px-5">
          <Notice error>顾客登录入口未开启，请联系商家</Notice>
        </main>
      </div>
    );
  if (!auth.authenticated)
    return (
      <div className="customer-root">
        <CustomerLogin status={auth} onLogin={login} />
      </div>
    );

  return (
    <CartProvider>
      <CustomerSessionContext.Provider value={{ displayName: auth.displayName ?? '顾客', logout }}>
        <div className="customer-root">
          <Routes>
            <Route path="/" element={<Entry />} />
            <Route path="/choose" element={<Choose />} />
            <Route path="/submitOrder" element={<SubmitOrder />} />
            <Route path="/orderList" element={<OrderList />} />
            <Route path="/listDetail" element={<OrderDetail />} />
            <Route path="/shopDetail" element={<ShopDetail />} />
            <Route
              path="*"
              element={
                <main className="page-shell items-center justify-center gap-5">
                  <h1>页面不存在</h1>
                  <Link to="/" className="text-orange-600">
                    返回首页
                  </Link>
                </main>
              }
            />
          </Routes>
        </div>
      </CustomerSessionContext.Provider>
    </CartProvider>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<CustomerApp />} />
    </Routes>
  );
}
