
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import CustomerVisitPage from './pages/CustomerVisitPage';
import GiftApplicationPage from './pages/GiftApplicationPage';
import GiftApprovalPage from './pages/GiftApprovalPage';
import OperationDataPage from './pages/OperationDataPage';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<HomePage />} />
        <Route path="/customer-visit" element={<CustomerVisitPage />} />
        <Route path="/gift-application" element={<GiftApplicationPage />} />
        <Route path="/gift-approval" element={<GiftApprovalPage />} />
        <Route path="/operation-data" element={<OperationDataPage />} />
      </Routes>
    </Router>
  );
}

export default App;
