import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes/AppRoutes';
import { AppDataProvider } from './context/AppDataContext';
import { CartProvider } from './context/CartContext';

function App() {
  return (
    <AppDataProvider>
      <CartProvider>
        <BrowserRouter>
          <AppRoutes />
          <ToastContainer position="bottom-right" />
        </BrowserRouter>
      </CartProvider>
    </AppDataProvider>
  );
}

export default App;
