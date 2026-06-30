import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { bootstrapLocalDataSeed } from './shared/utils/bootstrapLocalDataSeed';
import './shared/styles/global.css';
import './shared/styles/components.css';
import './shared/styles/form-experience.css';

bootstrapLocalDataSeed();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
