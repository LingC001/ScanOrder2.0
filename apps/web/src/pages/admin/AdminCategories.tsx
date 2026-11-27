import { useState } from 'react';
import type { FormEvent } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import type { AdminCategory } from '@scanorder/contracts';
import { api } from '../../api';
import { Modal } from '../../shared/Modal';
import { useResource } from '../../shared/useResource';
import { AdminMessage, AdminPageHeader, EmptyState } from './AdminCommon';

type Editor = { mode: 'create'; category?: undefined } | { mode: 'edit'; category: AdminCategory };

export function AdminCategories() {
  const resource = useResource(api.adminCategories);
  const categories = resource.data ?? [];
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [name, setName] = useState('');
  const [pending, setPending] = useState(false);

  function openCreate() {
    setName('');
    setMessage('');
    setEditor({ mode: 'create' });
  }

  function openEdit(category: AdminCategory) {
    setName(category.name);
    setMessage('');
    setEditor({ mode: 'edit', category });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      if (editor?.mode === 'edit') await api.updateCategory(editor.category.id, { name });
      else await api.createCategory({ name });
      setEditor(null);
      setMessage(editor?.mode === 'edit' ? '分类已更新' : '分类已新增');
      resource.retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败');
    } finally {
      setPending(false);
    }
  }

  async function move(category: AdminCategory, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const other = categories[index + direction];
    if (!other) return;
    setError('');
    try {
      await Promise.all([
        api.updateCategory(category.id, { sortOrder: other.sortOrder }),
        api.updateCategory(other.id, { sortOrder: category.sortOrder }),
      ]);
      setMessage('分类顺序已更新');
      resource.retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '排序失败');
    }
  }

  async function remove(category: AdminCategory) {
    if (!window.confirm(`确认删除分类“${category.name}”？`)) return;
    setError('');
    try {
      await api.deleteCategory(category.id);
      setMessage('分类已删除');
      resource.retry();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '删除失败');
    }
  }

  return (
    <>
      <AdminPageHeader
        title="分类管理"
        description="分类名称全局唯一，移动端按这里的顺序展示。"
        action={
          <button className="admin-primary-button" onClick={openCreate}>
            <Plus size={17} />
            新增分类
          </button>
        }
      />
      {message && <AdminMessage>{message}</AdminMessage>}
      {(error || resource.error) && <AdminMessage error>{error || resource.error}</AdminMessage>}
      <section className="admin-card">
        {resource.loading ? (
          <EmptyState>正在加载分类…</EmptyState>
        ) : categories.length === 0 ? (
          <EmptyState>暂无分类，请先新增分类。</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>排序</th>
                  <th>分类名称</th>
                  <th>商品数</th>
                  <th className="text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category, index) => (
                  <tr key={category.id}>
                    <td className="w-36">
                      <div className="flex items-center gap-1">
                        <span className="w-6 text-xs text-slate-400">{index + 1}</span>
                        <button
                          className="admin-secondary-button h-8 min-h-8 px-2"
                          disabled={index === 0}
                          aria-label={`上移${category.name}`}
                          onClick={() => move(category, -1)}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          className="admin-secondary-button h-8 min-h-8 px-2"
                          disabled={index === categories.length - 1}
                          aria-label={`下移${category.name}`}
                          onClick={() => move(category, 1)}
                        >
                          <ArrowDown size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="font-medium text-slate-900">{category.name}</td>
                    <td>{category.foodCount}</td>
                    <td>
                      <div className="flex justify-end gap-2">
                        <button
                          className="admin-secondary-button"
                          onClick={() => openEdit(category)}
                        >
                          <Pencil size={14} />
                          编辑
                        </button>
                        <button
                          className="admin-danger-button"
                          disabled={category.foodCount > 0}
                          title={category.foodCount ? '请先移走关联商品' : undefined}
                          onClick={() => remove(category)}
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editor && (
        <Modal
          title={editor.mode === 'edit' ? '编辑分类' : '新增分类'}
          onClose={() => setEditor(null)}
        >
          <form onSubmit={save} className="p-5">
            <label className="admin-field">
              <span>分类名称</span>
              <input
                autoFocus
                required
                maxLength={50}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="例如：热菜"
              />
            </label>
            {error && <AdminMessage error>{error}</AdminMessage>}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="admin-secondary-button"
                onClick={() => setEditor(null)}
              >
                取消
              </button>
              <button className="admin-primary-button" disabled={pending}>
                {pending ? '正在保存…' : '保存'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
