import { Link, Route, Routes } from 'react-router-dom';
import { CartProvider } from './CartProvider';
import { Entry } from './pages/Entry';
import { Choose } from './pages/Choose';
import { SubmitOrder } from './pages/SubmitOrder';
import { OrderDetail, OrderList } from './pages/Orders';
import { ShopDetail } from './pages/ShopDetail';
import { Upload } from './pages/Upload';

export function App() {
  return (
    <CartProvider>
      <Routes>
        <Route path="/" element={<Entry />} />
        <Route path="/choose" element={<Choose />} />
        <Route path="/submitOrder" element={<SubmitOrder />} />
        <Route path="/orderList" element={<OrderList />} />
        <Route path="/listDetail" element={<OrderDetail />} />
        <Route path="/shopDetail" element={<ShopDetail />} />
        <Route path="/upload" element={<Upload />} />
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
    </CartProvider>
  );
}
