import { Link } from 'react-router-dom';
import { ChevronUp, MapPin } from 'lucide-react';
import { SHOP } from '@scanorder/contracts';
import { Header } from '../components';

export function ShopDetail() {
  return (
    <main className="page-shell bg-white">
      <Header title="商家信息" />
      <div className="page-scroll px-5 pt-6 pb-20">
        <h1 className="text-lg font-bold">{SHOP.name}</h1>
        <h2 className="mt-6 text-sm font-bold">商家公告</h2>
        <p className="mt-3 text-xs text-gray-500">{SHOP.welcome}</p>
        <h2 className="mt-9 text-sm font-bold">商家信息</h2>
        <img
          src="/assets/shop.png"
          alt="小民大排档门店"
          className="mt-5 h-40 w-full object-cover"
        />
        <p className="mt-5 flex items-center gap-2 text-xs">
          <MapPin size={16} className="text-gray-400" />
          {SHOP.address}
        </p>
        <p className="mt-4 text-xs text-gray-500">营业时间：{SHOP.hours}</p>
        <p className="mt-3 text-xs text-gray-500">特色服务：免费WIFI</p>
        <p className="mt-3 text-xs text-gray-500">停车位：暂无数据</p>
      </div>
      <Link to="/choose" aria-label="收起商家信息" className="shop-collapse">
        <ChevronUp size={38} />
      </Link>
    </main>
  );
}
