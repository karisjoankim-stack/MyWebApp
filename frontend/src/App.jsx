import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RunnerPage from './pages/RunnerPage';
import PheTKPage from './pages/PheTKPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/runner" element={<RunnerPage />} />
        <Route path="/phetk" element={<PheTKPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
