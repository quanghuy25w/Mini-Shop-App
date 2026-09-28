import { BrowserRouter } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AppRoutes from './routes/AppRoutes';
import { AppDataProvider } from './context/AppDataContext';
import { CartProvider } from './context/CartContext';
import { AuthProvider } from './context/AuthContext';
import { WorkSessionProvider } from './context/WorkSessionContext';

function App() {
  return (
    <AppDataProvider>
      <CartProvider>
        <AuthProvider>
          <WorkSessionProvider>
            <BrowserRouter>
              <AppRoutes />
              <ToastContainer position="bottom-right" />
            </BrowserRouter>
          </WorkSessionProvider>
        </AuthProvider>
      </CartProvider>
    </AppDataProvider>
  );
}

export default App;
