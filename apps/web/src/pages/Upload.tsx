import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { yuanToCents } from '@scanorder/contracts';
import { api } from '../api';
import { Button, Header, Notice } from '../components';

export function Upload() {
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submitting = useRef(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    setError('');
    setSuccess(false);
    if (
      image &&
      (image.size > 5 * 1024 * 1024 ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(image.type))
    ) {
      setError('请选择5 MB以内的 JPEG、PNG 或 WebP 图片');
      setFile(null);
      setPreview('');
      event.target.value = '';
      return;
    }
    setFile(image ?? null);
    setPreview(image ? URL.createObjectURL(image) : '');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError('');
    setSuccess(false);
    if (!file) {
      setError('请选择菜品图片');
      return;
    }
    const values = new FormData(event.currentTarget);
    let priceCents: number;
    try {
      priceCents = yuanToCents(String(values.get('price')));
    } catch (failure) {
      setError((failure as Error).message);
      return;
    }
    const body = new FormData();
    for (const key of ['category', 'name', 'description'])
      body.set(key, String(values.get(key) ?? '').trim());
    body.set('priceCents', String(priceCents));
    body.set('recommended', String(values.get('recommended') === 'on'));
    body.set('image', file);
    submitting.current = true;
    setPending(true);
    try {
      await api.createFood(body);
      formRef.current?.reset();
      setFile(null);
      setPreview('');
      setSuccess(true);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '添加失败，请重试');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <main className="page-shell">
      <Header title="上传菜品" />
      <div className="page-scroll">
        <form ref={formRef} onSubmit={submit} className="bg-white px-4">
          <fieldset disabled={pending}>
            <label className="form-row">
              <span>种类</span>
              <input name="category" required maxLength={50} placeholder="请输入菜品种类" />
            </label>
            <label className="form-row">
              <span>名称</span>
              <input name="name" required maxLength={100} placeholder="请输入菜品名称" />
            </label>
            <div className="form-row items-start">
              <span className="pt-3">图片</span>
              <label className="upload-picker">
                <input
                  type="file"
                  name="image"
                  aria-label="菜品图片"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={selectImage}
                  className="sr-only"
                />
                {preview ? (
                  <img src={preview} alt="待上传图片" className="h-20 w-20 object-cover" />
                ) : (
                  <span className="flex h-20 w-20 flex-col items-center justify-center gap-1 bg-gray-50 text-gray-400">
                    <ImagePlus size={25} />
                    <span className="text-xs">选择图片</span>
                  </span>
                )}
              </label>
            </div>
            <label className="form-row">
              <span>价格</span>
              <input
                name="price"
                type="number"
                min="0"
                max="100000"
                step="0.01"
                inputMode="decimal"
                required
                placeholder="请输入价格（元）"
              />
            </label>
            <label className="form-row">
              <span>描述</span>
              <textarea
                name="description"
                required
                maxLength={1000}
                rows={2}
                placeholder="请输入菜品描述"
              />
            </label>
            <label className="form-row">
              <span>是否推荐</span>
              <input
                name="recommended"
                type="checkbox"
                className="h-5 w-5 flex-none accent-orange-500"
              />
            </label>
            <p className="mt-4 text-xs text-gray-400">图片支持 JPEG、PNG、WebP，最大5 MB</p>
            {error && <Notice error>{error}</Notice>}
            {success && <Notice>添加成功</Notice>}
            <Button type="submit" className="my-6 w-full rounded-full" disabled={pending}>
              {pending ? '正在上传…' : '提交'}
            </Button>
          </fieldset>
        </form>
      </div>
    </main>
  );
}
