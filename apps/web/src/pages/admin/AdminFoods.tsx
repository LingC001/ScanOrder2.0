import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, Pencil, Plus, RotateCcw, Search } from 'lucide-react';
import { formatMoney } from '@scanorder/contracts';
import type { Food, FoodStatus } from '@scanorder/contracts';
import { api } from '../../api';
import { useResource } from '../../shared/useResource';
import {
  AdminMessage,
  AdminPageHeader,
  EmptyState,
  FoodStatusBadge,
  Pagination,
} from './AdminCommon';
import { AdminFoodEditor } from './AdminFoodEditor';

export function AdminFoods() {
  const categories = useResource(api.adminCategories);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState<FoodStatus | ''>('');
  const [editor, setEditor] = useState<{ food: Food | null } | null>(null);
  const [message, setMessage] = useState('');
  const [operationError, setOperationError] = useState('');
  const [operating, setOperating] = useState('');

  const load = useCallback(
    (signal: AbortSignal) =>
      api.adminFoods(
        {
          page,
          pageSize: 20,
          search,
          categoryId: categoryId || undefined,
          status: status || undefined,
        },
        signal,
      ),
    [page, search, categoryId, status],
  );
  const foods = useResource(load);

  function filter(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function saved(text: string) {
    setEditor(null);
    setMessage(text);
    setOperationError('');
    foods.retry();
  }

  async function changeStatus(food: Food) {
    setOperating(food.id);
    setOperationError('');
    try {
      if (food.status === 'archived') await api.restoreFood(food.id);
      else await api.setFoodStatus(food.id, food.status === 'active' ? 'inactive' : 'active');
      setMessage(food.status === 'archived' ? '商品已恢复，当前为下架状态' : '商品状态已更新');
      foods.retry();
    } catch (failure) {
      setOperationError(failure instanceof Error ? failure.message : '操作失败');
    } finally {
      setOperating('');
    }
  }

  async function archive(food: Food) {
    if (!window.confirm(`确认归档“${food.name}”？归档后不会出现在顾客菜单。`)) return;
    setOperating(food.id);
    setOperationError('');
    try {
      await api.archiveFood(food.id);
      setMessage('商品已归档');
      foods.retry();
    } catch (failure) {
      setOperationError(failure instanceof Error ? failure.message : '归档失败');
    } finally {
      setOperating('');
    }
  }

  const unavailable = categories.loading || categories.error || foods.loading || foods.error;
  return (
    <>
      <AdminPageHeader
        title="商品管理"
        description="新增和恢复的商品默认下架，上架后才会出现在顾客菜单。"
        action={
          <button
            className="admin-primary-button"
            onClick={() => setEditor({ food: null })}
            disabled={!categories.data?.length}
            title={!categories.data?.length ? '请先新增分类' : undefined}
          >
            <Plus size={17} />
            新增商品
          </button>
        }
      />
      {message && <AdminMessage>{message}</AdminMessage>}
      {operationError && <AdminMessage error>{operationError}</AdminMessage>}
      {categories.error && <AdminMessage error>{categories.error}</AdminMessage>}
      {foods.error && <AdminMessage error>{foods.error}</AdminMessage>}
      <section className="admin-card mb-4">
        <form
          className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_180px_150px_auto]"
          onSubmit={filter}
        >
          <label className="admin-field mb-0">
            <span>商品名称</span>
            <div className="relative">
              <Search size={16} className="absolute top-3 left-3 text-slate-400" />
              <input
                className="pl-9"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="搜索商品"
              />
            </div>
          </label>
          <label className="admin-field mb-0">
            <span>分类</span>
            <select
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value);
                setPage(1);
              }}
            >
              <option value="">全部分类</option>
              {categories.data?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="admin-field mb-0">
            <span>状态</span>
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as FoodStatus | '');
                setPage(1);
              }}
            >
              <option value="">未归档</option>
              <option value="active">已上架</option>
              <option value="inactive">已下架</option>
              <option value="archived">已归档</option>
            </select>
          </label>
          <button className="admin-primary-button self-end" type="submit">
            查询
          </button>
        </form>
      </section>
      <section className="admin-card">
        {unavailable ? (
          <EmptyState>正在加载商品…</EmptyState>
        ) : foods.data?.items.length === 0 ? (
          <EmptyState>没有符合当前条件的商品。</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="admin-table min-w-[850px]">
                <thead>
                  <tr>
                    <th>商品</th>
                    <th>分类</th>
                    <th>价格</th>
                    <th>推荐</th>
                    <th>状态</th>
                    <th className="text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {foods.data?.items.map((food) => (
                    <tr key={food.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <img
                            src={food.imageUrl}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                          <div>
                            <p className="font-medium text-slate-900">{food.name}</p>
                            <p className="mt-1 line-clamp-1 max-w-64 text-xs text-slate-400">
                              {food.description}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>{food.categoryName}</td>
                      <td>￥{formatMoney(food.priceCents)}</td>
                      <td>{food.recommended ? '是' : '否'}</td>
                      <td>
                        <FoodStatusBadge status={food.status} />
                      </td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {food.status !== 'archived' && (
                            <button
                              className="admin-secondary-button"
                              onClick={() => setEditor({ food })}
                            >
                              <Pencil size={14} />
                              编辑
                            </button>
                          )}
                          <button
                            className="admin-secondary-button"
                            disabled={operating === food.id}
                            onClick={() => changeStatus(food)}
                          >
                            {food.status === 'archived' ? (
                              <>
                                <RotateCcw size={14} />
                                恢复
                              </>
                            ) : food.status === 'active' ? (
                              '下架'
                            ) : (
                              '上架'
                            )}
                          </button>
                          {food.status !== 'archived' && (
                            <button
                              className="admin-danger-button"
                              disabled={operating === food.id}
                              onClick={() => archive(food)}
                            >
                              <Archive size={14} />
                              归档
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={foods.data?.page ?? 1}
              totalPages={foods.data?.totalPages ?? 0}
              total={foods.data?.total ?? 0}
              onChange={setPage}
            />
          </>
        )}
      </section>
      {editor && categories.data && (
        <AdminFoodEditor
          food={editor.food}
          categories={categories.data}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </>
  );
}
