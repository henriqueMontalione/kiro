import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { WalletProvider } from './context/WalletContext';
import { DashboardProvider } from './context/DashboardContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <WalletProvider>
        <DashboardProvider>
          <App />
        </DashboardProvider>
      </WalletProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
