import { useEffect, useState } from 'react';
import { Navigate, NavLink, useLocation } from 'react-router-dom';
import { ClipboardList, LayoutGrid, LogOut, Package, Tags } from 'lucide-react';
import type { AuthStatus } from '@scanorder/contracts';
import { api } from '../../api';
import { AdminCategories } from './AdminCategories';
import { AdminFoods } from './AdminFoods';
import { AdminOrders } from './AdminOrders';

function AdminLogin({ onLogin }: { onLogin: () => Promise<void> }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      await api.loginMerchant(username, password);
      await onLogin();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '登录失败，请重试');
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-5">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-7 shadow-2xl">
        <div className="mb-7">
          <p className="text-xs font-semibold tracking-[0.25em] text-orange-500">SCANORDER</p>
          <h1 className="mt-3 text-2xl font-semibold text-slate-900">商家后台</h1>
          <p className="mt-2 text-sm text-slate-500">管理菜单、分类和到店订单</p>
        </div>
        <label className="admin-field">
          <span>账号</span>
          <input
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />
        </label>
        <label className="admin-field">
          <span>密码</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <button className="admin-primary-button mt-5 w-full" disabled={pending}>
          {pending ? '正在登录…' : '登录后台'}
        </button>
      </form>
    </main>
  );
}

const navigation = [
  { to: '/admin/foods', label: '商品管理', icon: Package },
  { to: '/admin/categories', label: '分类管理', icon: Tags },
  { to: '/admin/orders', label: '订单管理', icon: ClipboardList },
];

export function AdminApp() {
  const location = useLocation();
  const [auth, setAuth] = useState<AuthStatus | null>(null);
  const [error, setError] = useState('');

  async function refreshAuth() {
    setAuth(await api.merchantAuth());
  }

  useEffect(() => {
    let active = true;
    api
      .merchantAuth()
      .then((value) => {
        if (active) setAuth(value);
      })
      .catch((failure: unknown) => {
        if (active) setError(failure instanceof Error ? failure.message : '无法连接后台服务');
      });
    return () => {
      active = false;
    };
  }, []);

  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        {error}
      </main>
    );
  if (!auth)
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        正在验证登录状态…
      </main>
    );
  if (!auth.authenticated) return <AdminLogin onLogin={refreshAuth} />;
  if (location.pathname === '/admin') return <Navigate to="/admin/foods" replace />;

  async function logout() {
    await api.logoutMerchant();
    setAuth((current) => current && { ...current, authenticated: false, displayName: null });
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col bg-slate-950 text-white md:flex">
        <div className="px-6 py-7">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <LayoutGrid className="text-orange-400" />
            ScanOrder
          </div>
          <p className="mt-1 text-xs text-slate-400">商家运营后台</p>
        </div>
        <nav className="space-y-1 px-3">
          {navigation.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-3 text-sm ${
                  isActive ? 'bg-orange-500 text-white' : 'text-slate-300 hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="md:pl-60">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-8">
          <nav className="flex gap-2 md:hidden">
            {navigation.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm ${isActive ? 'bg-orange-500 text-white' : 'text-slate-600'}`
                }
              >
                {label.replace('管理', '')}
              </NavLink>
            ))}
          </nav>
          <span className="hidden text-sm text-slate-500 md:block">{auth.displayName}</span>
          <button
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100"
            onClick={logout}
          >
            <LogOut size={16} />
            退出
          </button>
        </header>
        <main className="mx-auto max-w-7xl p-4 md:p-8">
          {location.pathname === '/admin/foods' ? (
            <AdminFoods />
          ) : location.pathname === '/admin/categories' ? (
            <AdminCategories />
          ) : location.pathname === '/admin/orders' ? (
            <AdminOrders />
          ) : (
            <Navigate to="/admin/foods" replace />
          )}
        </main>
      </div>
    </div>
  );
}
