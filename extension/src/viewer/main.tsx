import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ExtensionApp } from './ExtensionApp';
import '@app/styles/index.css';
import './viewer.css';

const root = document.getElementById('root');
if (!root) throw new Error('ルート要素 #root が見つかりません。');

createRoot(root).render(
  <StrictMode>
    <ExtensionApp />
  </StrictMode>,
);
