import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Code2, Play, Dna, ArrowRight, Terminal, BookOpen, Shield } from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="landing-layout-root animate-fade-in">
      {/* Mesh Glow Backgrounds */}
      <div className="landing-bg-glow-top"></div>
      <div className="landing-bg-glow-bottom"></div>

      {/* Sticky Header Nav */}
      <header className="landing-header">
        <div className="landing-nav-container">
          <div className="brand-logo-area" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
            <div className="neomorphic-logo">
              <Code2 size={24} color="#3b82f6" />
            </div>
            <span className="brand-name">Python Runner</span>
          </div>

          <nav className="landing-nav" aria-label="Main Navigation">
            <button 
              className="nav-link-btn" 
              onClick={() => navigate('/home')}
              aria-label="Go to Dashboard Home"
            >
              Dashboard
            </button>
            <button 
              className="nav-link-btn" 
              onClick={() => navigate('/runner')}
              aria-label="Go to Python Code Editor"
            >
              Python Editor
            </button>
            <button 
              className="nav-link-btn" 
              onClick={() => navigate('/phetk')}
              aria-label="Go to PheTK Bio-pipeline Analysis"
            >
              PheTK Analysis
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="landing-main">
        {/* Hero Section */}
        <section className="landing-hero" aria-labelledby="hero-title">
          <h1 id="hero-title" className="landing-title">
            Welcome to <span className="text-gradient">Python Runner</span>
          </h1>
          <p className="landing-subtitle">
            A premium, modern development ecosystem engineered for interactive Python script execution, instant matplotlib data visualization, and advanced biological phenotype-genotype association analysis.
          </p>
          <div className="hero-action-buttons">
            <button 
              className="neumorphic-btn btn-primary" 
              onClick={() => navigate('/home')}
              aria-label="Get Started with Python Runner Dashboard"
            >
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </section>

        {/* Feature Cards/Pillars Grid */}
        <section className="pillars-section" aria-labelledby="pillars-title">
          <h2 id="pillars-title" className="visually-hidden">Application Pillars</h2>
          <div className="pillars-grid">
            {/* Pillar 1: Python Playground */}
            <div className="pillar-card neomorphic-panel">
              <div className="pillar-header">
                <div className="pillar-icon-wrapper blue-glow">
                  <Terminal size={24} color="#00d2ff" />
                </div>
                <h3 className="pillar-title">Python Editor & Playground</h3>
              </div>
              <p className="pillar-description">
                Write, execute, and inspect Python code in real-time. Automatically generate graphs, run built-in interactive lessons, and view immediate execution performance logs.
              </p>
              <button 
                className="pillar-action-btn" 
                onClick={() => navigate('/runner')}
                aria-label="Launch Python Script Runner Playground"
              >
                Launch Editor <ArrowRight size={16} />
              </button>
            </div>

            {/* Pillar 2: PheTK Analysis */}
            <div className="pillar-card neomorphic-panel">
              <div className="pillar-header">
                <div className="pillar-icon-wrapper green-glow">
                  <Dna size={24} color="#10b981" />
                </div>
                <h3 className="pillar-title">PheTK Bio-pipeline</h3>
              </div>
              <p className="pillar-description">
                Run advanced phenotypic-genotypic pipeline computations. Upload genotype/phenotype CSV files, trigger processing steps, and dynamically visualize genomic and phenotypic charts.
              </p>
              <button 
                className="pillar-action-btn" 
                onClick={() => navigate('/phetk')}
                aria-label="Open PheTK Pipeline Analyzer"
              >
                Launch Analyzer <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <p>&copy; {new Date().getFullYear()} Python Runner. Empowering scientific workflows.</p>
      </footer>
    </div>
  );
}
