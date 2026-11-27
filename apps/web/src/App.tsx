import { Route, Routes } from 'react-router-dom';
import { AdminApp } from './pages/admin/AdminApp';
import { CustomerApp } from './pages/customer/CustomerApp';

export function App() {
  return (
    <Routes>
      <Route path="/admin/*" element={<AdminApp />} />
      <Route path="*" element={<CustomerApp />} />
    </Routes>
  );
}
