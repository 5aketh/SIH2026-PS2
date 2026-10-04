import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router';
import { AnnouncerProvider } from './context/AnnouncerContext';
import { WizardProvider } from './context/WizardContext';
import PackWiseBridge from './components/PackWiseBridge';
import ScrollToTop from './components/ScrollToTop';
import LandingPage from './pages/LandingPage';
import WizardLayout from './pages/wizard/WizardLayout';
import FoodStep from './pages/wizard/FoodStep';
import JourneyStep from './pages/wizard/JourneyStep';
import RunningStep from './pages/wizard/RunningStep';
import ResultPage from './pages/wizard/ResultPage';
import ReportPage from './pages/wizard/ReportPage';
import ToolLayout from './pages/tools/ToolLayout';
import BuilderPage from './pages/tools/BuilderPage';
import WhatIfPage from './pages/tools/WhatIfPage';
import MaterialsPage from './pages/tools/MaterialsPage';
import MaterialDetailPage from './pages/tools/MaterialDetailPage';

/** Redirect that keeps the query string (e.g. ?category=). */
function KeepQuery({ to }) {
  return <Navigate to={to + useLocation().search} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AnnouncerProvider>
        <WizardProvider>
          <PackWiseBridge />
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/analyze" element={<WizardLayout />}>
              <Route index element={<Navigate to="food" replace />} />
              <Route path="food" element={<FoodStep />} />
              <Route path="journey" element={<JourneyStep />} />
              {/* Earlier five-step URLs. */}
              <Route path="commodity" element={<KeepQuery to="/analyze/food" />} />
              <Route path="profile" element={<Navigate to="/analyze/food" replace />} />
              <Route path="conditions" element={<Navigate to="/analyze/journey" replace />} />
              <Route path="priorities" element={<Navigate to="/analyze/journey" replace />} />
              <Route path="running" element={<RunningStep />} />
              <Route path="result" element={<ResultPage />} />
              <Route path="report" element={<ReportPage />} />
            </Route>
            <Route element={<ToolLayout />}>
              <Route path="/builder" element={<BuilderPage />} />
              <Route path="/what-if" element={<WhatIfPage />} />
              <Route path="/materials" element={<MaterialsPage />} />
              <Route path="/materials/:materialId" element={<MaterialDetailPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WizardProvider>
      </AnnouncerProvider>
    </BrowserRouter>
  );
}
