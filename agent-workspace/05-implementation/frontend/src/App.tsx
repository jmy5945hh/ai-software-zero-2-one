import React from 'react';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { BrowserRouter as Router } from 'react-router-dom';
import AppRoutes from './routes/AppRoutes';
import AIAssistant from './components/AIAssistant';
import './styles/App.css';

const App: React.FC = () => {
  return (
    <ConfigProvider locale={zhCN}>
      <Router>
        <div className="App">
          <AppRoutes />
          <AIAssistant />
        </div>
      </Router>
    </ConfigProvider>
  );
};

export default App;