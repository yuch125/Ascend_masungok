import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/mobile-product.css';
import './styles/reference-theme.css';
import './styles/timeline.css';
import './styles/capture-app.css';
import './styles/tablet.css';
import './styles/ascend-mobile.css';
import { registerAppWorker } from './pwa/register';
registerAppWorker();
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
