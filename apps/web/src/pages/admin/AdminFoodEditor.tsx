import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { formatMoney, yuanToCents } from '@scanorder/contracts';
import type { AdminCategory, Food } from '@scanorder/contracts';
import { api } from '../../api';
import { Modal } from '../../components';
import { AdminMessage } from './AdminCommon';

export function AdminFoodEditor({
  food,
  categories,
  onClose,
  onSaved,
}: {
  food: Food | null;
  categories: AdminCategory[];
  onClose: () => void;
  onSaved: (message: string) => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(food?.imageUrl ?? '');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(
    () => () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function chooseImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setError('');
    if (
      selected &&
      (selected.size > 5 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(selected.type))
    ) {
      setFile(null);
      setError('请选择5 MB以内的 JPEG、PNG 或 WebP 图片');
      event.target.value = '';
      return;
    }
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : (food?.imageUrl ?? ''));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const values = new FormData(event.currentTarget);
    const body = new FormData();
    body.set('categoryId', String(values.get('categoryId') ?? ''));
    body.set('name', String(values.get('name') ?? '').trim());
    body.set('description', String(values.get('description') ?? '').trim());
    body.set('recommended', String(values.get('recommended') === 'on'));
    try {
      body.set('priceCents', String(yuanToCents(String(values.get('price') ?? ''))));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '价格格式不正确');
      return;
    }
    if (file) body.set('image', file);
    if (!food && !file) {
      setError('请选择商品图片');
      return;
    }
    setPending(true);
    try {
      if (food) await api.updateFood(food.id, body);
      else await api.createFood(body);
      await onSaved(food ? '商品已更新' : '商品已新增，当前为下架状态');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '保存失败，请重试');
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal title={food ? '编辑商品' : '新增商品'} onClose={onClose}>
      <form onSubmit={submit} className="p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="admin-field">
            <span>商品名称</span>
            <input
              name="name"
              required
              maxLength={100}
              defaultValue={food?.name ?? ''}
              placeholder="请输入商品名称"
            />
          </label>
          <label className="admin-field">
            <span>分类</span>
            <select name="categoryId" required defaultValue={food?.categoryId ?? ''}>
              <option value="" disabled>
                请选择分类
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="admin-field">
            <span>价格（元）</span>
            <input
              name="price"
              type="number"
              min="0"
              max="100000"
              step="0.01"
              required
              defaultValue={food ? formatMoney(food.priceCents) : ''}
            />
          </label>
          <label className="admin-field">
            <span>图片</span>
            <div className="flex items-center gap-3">
              {preview ? (
                <img
                  src={preview}
                  alt="商品图片预览"
                  className="h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <span className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  <ImagePlus size={22} />
                </span>
              )}
              <label className="admin-secondary-button cursor-pointer">
                选择图片
                <input
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={chooseImage}
                />
              </label>
            </div>
          </label>
        </div>
        <label className="admin-field">
          <span>商品描述</span>
          <textarea
            name="description"
            required
            maxLength={1000}
            rows={4}
            defaultValue={food?.description ?? ''}
            placeholder="描述口味、份量或食材"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            name="recommended"
            type="checkbox"
            defaultChecked={food?.recommended ?? false}
            className="h-4 w-4 accent-orange-500"
          />
          设为老板推荐
        </label>
        <p className="mt-3 text-xs text-slate-400">图片支持 JPEG、PNG、WebP，最大 5 MB。</p>
        {error && (
          <div className="mt-4">
            <AdminMessage error>{error}</AdminMessage>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="admin-secondary-button" onClick={onClose}>
            取消
          </button>
          <button className="admin-primary-button" disabled={pending}>
            {pending ? '正在保存…' : '保存商品'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
