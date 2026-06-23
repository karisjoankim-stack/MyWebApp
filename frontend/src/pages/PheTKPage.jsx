import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { 
  Play, Home, Terminal, Image as ImageIcon, Loader2, 
  Copy, Download, Maximize2, X, ChevronLeft, Dna, Check, FileCode, Trash2
} from 'lucide-react';

const PHETK_TEMPLATES = [
  {
    id: "phetk_demo",
    name: "1. Built-in Demo",
    tag: "PheTK Demo",
    desc: "Import and execute the package quick start demo routine to verify environments.",
    code: `# PheTK Built-in Demo (Non-Interactive)
# Since the server environment does not have an interactive terminal,
# we mock the input() function to auto-answer the demo's configuration prompts.
import builtins

demo_answers = [
    "",          # Welcome screen: Press Enter
    "binary",    # Variable type: binary or continuous
    "yes",       # Include both sexes: yes or no
    "",          # Cohort preview: Press Enter
    "",          # Count preview: Press Enter
    "",          # Run PheWAS: Press Enter
]

def automated_input(prompt=""):
    print(prompt)
    answer = demo_answers.pop(0) if demo_answers else ""
    print(f">> Automatically answered: {answer}\\n")
    return answer

builtins.input = automated_input

from phetk import demo
demo.run()
`
  },
  {
    id: "phetk_phewas",
    name: "2. Simulated PheWAS Study",
    tag: "Association",
    desc: "Generate synthetic cohort/phecode CSV data, initialize the PheWAS analyzer, run logistic regression associations, and print summary stats.",
    code: `# Simulated PheWAS Study
import pandas as pd
import numpy as np
from phetk.phewas import PheWAS

# 1. Generate synthetic cohort data (genotype and covariates)
print("Generating simulated biobank cohort...")
cohort_data = {
    'sample_id': [f"S{i}" for i in range(1, 101)],
    'genotype_val': np.random.choice([0, 1, 2], size=100, p=[0.7, 0.25, 0.05]),
    'age': np.random.randint(40, 80, size=100),
    'sex': np.random.choice([0, 1], size=100)
}
pd.DataFrame(cohort_data).to_csv('cohort.csv', index=False)
print("Saved cohort.csv")

# 2. Generate synthetic ICD / phecode counts data
print("Generating simulated phecode count data...")
phecode_data = {
    'sample_id': [f"S{i}" for i in range(1, 101)] * 5,
    'phecode': np.repeat(['250.2', '401.1', '272.1', '411.2', '300.1'], 100),
    'count': np.random.choice([0, 1, 2, 3], size=500, p=[0.8, 0.12, 0.05, 0.03])
}
pd.DataFrame(phecode_data).to_csv('phecode_counts.csv', index=False)
print("Saved phecode_counts.csv")

# 3. Run the association analysis
print("\\nInitializing PheWAS analysis...")
try:
    phewas = PheWAS(cohort_path='cohort.csv', phecode_counts_path='phecode_counts.csv')
    results = phewas.run(
        covariates=['age', 'sex'],
        independent_variable='genotype_val'
    )
    print("\\n--- PheWAS Association Results ---")
    print(results.to_string(index=False))
except Exception as e:
    print(f"Error during analysis: {e}")
    print("\\nAttempting basic statistical run instead...")
    # Fallback basic analysis
    df_cohort = pd.read_csv('cohort.csv')
    df_counts = pd.read_csv('phecode_counts.csv')
    merged = pd.merge(df_cohort, df_counts, on='sample_id')
    summary = merged.groupby('phecode')['count'].mean()
    print(summary)
`
  },
  {
    id: "phetk_plot",
    name: "3. Manhattan Plot",
    tag: "Visualization",
    desc: "Generate mock study output coefficients and plot a custom styled PheWAS Manhattan plot with color categories and significance bars.",
    code: `# Manhattan Plot Generation
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

print("Generating mock PheWAS results for visualization...")
categories = ['Infectious', 'Neoplasms', 'Endocrine', 'Hematopoietic', 'Mental', 'Neurological', 'Circulatory', 'Respiratory', 'Digestive', 'Genitourinary']
data = {
    'phecode': [f"{100+i}.{j}" for i in range(10) for j in range(10)],
    'category': np.repeat(categories, 10),
    'p_value': np.random.uniform(0.00001, 0.9, size=100),
    'beta': np.random.uniform(-1.5, 1.5, size=100)
}
df = pd.DataFrame(data)
df['-log10_p'] = -np.log10(df['p_value'])

print("Creating Manhattan plot with custom palette...")
plt.figure(figsize=(9, 4.5), dpi=150)
colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e', '#a855f7']

for i, cat in enumerate(categories):
    cat_data = df[df['category'] == cat]
    plt.scatter(cat_data.index, cat_data['-log10_p'], color=colors[i % len(colors)], label=cat, s=35, alpha=0.8, edgecolors='none')

# Add threshold line
plt.axhline(y=-np.log10(0.05), color='#ef4444', linestyle='--', alpha=0.7, label='p = 0.05')
plt.axhline(y=-np.log10(0.005), color='#8b5cf6', linestyle=':', alpha=0.7, label='Bonferroni')

plt.title("PheWAS Manhattan Plot Output", fontsize=14, color='#0f172a', pad=15)
plt.xlabel("Phenotype Category Group", color='#475569')
plt.ylabel("-log10(p-value)", color='#475569')
plt.xticks([])
plt.grid(True, linestyle=':', alpha=0.3)
plt.legend(bbox_to_anchor=(1.02, 1), loc='upper left', fontsize='x-small')
plt.tight_layout()

plt.savefig("manhattan_plot.png", facecolor='#f0f3f6')
print("Plot successfully saved as manhattan_plot.png!")
`
  }
];

export default function PheTKPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Editor States
  const [code, setCode] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);
  
  // Console / Output States
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState('');
  const [isError, setIsError] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Metrics
  const [executionTime, setExecutionTime] = useState(null);
  const [editorLinesCount, setEditorLinesCount] = useState(0);
  const [editorCharsCount, setEditorCharsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [lightboxItem, setLightboxItem] = useState(null);
  const [packagesStatus, setPackagesStatus] = useState({});

  // Load initial code template
  useEffect(() => {
    if (location.state && location.state.code) {
      setCode(location.state.code);
    } else {
      setCode(PHETK_TEMPLATES[0].code);
    }
  }, [location.state]);

  // Track metrics
  useEffect(() => {
    const lines = code.split('\n').length;
    setEditorLinesCount(lines);
    setEditorCharsCount(code.length);
  }, [code]);

  // ESC key for lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Check packages on backend
  useEffect(() => {
    const fetchPackages = async () => {
      try {
        const res = await axios.get('http://localhost:3002/api/packages');
        setPackagesStatus(res.data);
      } catch (err) {
        console.error('Failed to load packages status:', err);
      }
    };
    fetchPackages();
  }, []);

  const runCode = async () => {
    setIsRunning(true);
    setLogs('Running PheTK script in environment...');
    setIsError(false);
    setMediaFiles([]);
    setExecutionTime(null);
    setActiveTab('logs');

    try {
      const response = await axios.post('http://localhost:3002/api/run', { code });
      const { stdout, stderr, mediaFiles: newMedia, exitCode, executionTimeMs } = response.data;
      
      let finalLogs = stdout || '';
      if (stderr) {
        finalLogs += (finalLogs ? '\n' : '') + stderr;
      }
      
      setLogs(finalLogs || 'Execution completed with empty output.');
      setIsError(exitCode !== 0);
      setExecutionTime(executionTimeMs);
      
      const absoluteMedia = newMedia.map(m => ({
        ...m,
        url: `http://localhost:3002${m.url}`
      }));
      setMediaFiles(absoluteMedia);
      
      if (absoluteMedia.some(m => m.type === 'image')) {
        setActiveTab('plots');
      }
    } catch (error) {
      setLogs(`Execution failed: ${error.message}\n${error.response?.data?.error || ''}`);
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const copyLogsToClipboard = () => {
    if (!logs) return;
    navigator.clipboard.writeText(logs);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadLogs = () => {
    if (!logs) return;
    const element = document.createElement("a");
    const file = new Blob([logs], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `phetk_execution_${Date.now()}.log`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const images = mediaFiles.filter(m => m.type === 'image');

  return (
    <div className="runner-layout">
      {/* Primary Icon Sidebar */}
      <div className="sidebar">
        <div className="sidebar-icon active-brand" onClick={() => navigate('/')} title="Go back to Home">
          <Home size={22} />
        </div>
        <div 
          className={`sidebar-icon ${drawerOpen ? 'active' : ''}`} 
          onClick={() => setDrawerOpen(!drawerOpen)} 
          title="Toggle Templates Drawer"
        >
          <FileCode size={22} />
        </div>
      </div>

      {/* Templates Drawer */}
      <div className={`template-drawer ${drawerOpen ? '' : 'collapsed'}`}>
        <div className="drawer-header">
          <span className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Dna size={16} color="#3b82f6" /> PheTK Workspace
          </span>
          <button 
            className="console-btn" 
            style={{ padding: '0.2rem' }} 
            onClick={() => setDrawerOpen(false)}
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Load Templates */}
        <div className="template-list">
          {PHETK_TEMPLATES.map((tmpl) => (
            <div 
              key={tmpl.id} 
              className="template-card"
              onClick={() => setCode(tmpl.code)}
            >
              <div className="template-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{tmpl.name}</span>
                <span className="lesson-tag" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px' }}>
                  {tmpl.tag}
                </span>
              </div>
              <div className="template-desc">{tmpl.desc}</div>
            </div>
          ))}
        </div>

        {/* Library Environment Details */}
        <div style={{ padding: '1rem', borderTop: '1px solid rgba(163, 177, 198, 0.2)' }}>
          <div className="drawer-title" style={{ marginBottom: '0.75rem', fontSize: '0.75rem' }}>Workspace Status</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {['phetk', 'statsmodels', 'pandas', 'numpy', 'matplotlib'].map((lib) => {
              const installed = packagesStatus[lib === 'matplotlib' ? 'matplotlib' : lib];
              return (
                <div 
                  key={lib} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.65rem',
                    borderRadius: '8px',
                    background: installed ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: installed ? '#10b981' : '#ef4444',
                    border: `1px solid ${installed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
                  }}
                >
                  <span style={{ fontWeight: '600' }}>{lib}</span>
                  <span style={{ fontSize: '0.65rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {installed ? <Check size={12} /> : <X size={12} />}
                    {installed ? 'Ready' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Code Editor Pane */}
      <div className="editor-pane">
        <div className="pane-header">
          <div className="pane-title-container">
            <span className="pane-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Dna size={16} /> PheTK Analysis
            </span>
            <span className="tag-badge">PheWAS v0.2+</span>
          </div>
          <button 
            className="neumorphic-btn btn-primary" 
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }} 
            onClick={runCode} 
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 size={15} className="spin-anim" />
            ) : (
              <Play size={15} />
            )}
            <span>{isRunning ? 'Analyzing...' : 'Run Analysis'}</span>
          </button>
        </div>
        
        {/* Monaco Editor */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{ 
              minimap: { enabled: false }, 
              fontSize: 14,
              fontFamily: "var(--font-mono)",
              lineHeight: 20,
              padding: { top: 10, bottom: 10 }
            }}
          />
        </div>

        {/* Editor Status Bar */}
        <div className="editor-status-bar">
          <div className="status-left">
            <span>
              <span className={`status-indicator ${isRunning ? 'running' : 'ready'}`}></span>
              {isRunning ? 'Running Analysis...' : 'Workspace Ready'}
            </span>
            {executionTime !== null && (
              <span style={{ color: '#10b981' }}>
                Executed in {executionTime}ms
              </span>
            )}
          </div>
          <div className="status-right">
            <span>Lines: {editorLinesCount}</span>
            <span>Chars: {editorCharsCount}</span>
            <span>UTF-8</span>
          </div>
        </div>
      </div>

      {/* Output Console Pane */}
      <div className="output-pane">
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'logs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('logs')}
          >
            <Terminal size={15} /> Logs
          </div>
          <div 
            className={`tab ${activeTab === 'plots' ? 'active' : ''}`} 
            onClick={() => setActiveTab('plots')}
          >
            <ImageIcon size={15} /> Plots ({images.length})
          </div>
          <button 
            className="console-btn" 
            style={{ marginLeft: 'auto', alignSelf: 'center', marginRight: '0.5rem', padding: '0.35rem 0.75rem', gap: '0.25rem' }} 
            onClick={() => { setLogs(''); setMediaFiles([]); setExecutionTime(null); }}
          >
            <Trash2 size={13} /> Clear
          </button>
        </div>
        
        {/* Tab Contents */}
        <div className="output-content">
          {activeTab === 'logs' && (
            <div className="console-container">
              <div className="console-actions">
                <button className="console-btn" onClick={copyLogsToClipboard} disabled={!logs}>
                  {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="console-btn" onClick={downloadLogs} disabled={!logs}>
                  <Download size={13} /> Logs
                </button>
              </div>
              <div className={`log-viewer ${isError ? 'error' : ''}`}>
                {logs || 'Press "Run Analysis" to run your genetic association code.'}
              </div>
            </div>
          )}
          
          {activeTab === 'plots' && (
            <div>
              {images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--neo-text-muted)' }}>
                  <ImageIcon size={48} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No plots generated yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    Save plots using <code>plt.savefig("plot.png")</code>
                  </p>
                </div>
              ) : (
                <div className="media-gallery">
                  {images.map((img, i) => (
                    <div key={i} className="media-item">
                      <div className="media-preview-container">
                        <img 
                          src={img.url} 
                          alt={img.filename} 
                          onClick={() => setLightboxItem(img)} 
                        />
                        <div className="media-item-overlay">
                          <button 
                            className="overlay-action-btn" 
                            onClick={() => setLightboxItem(img)} 
                            title="Fullscreen View"
                          >
                            <Maximize2 size={14} />
                          </button>
                          <a 
                            className="overlay-action-btn" 
                            href={img.url} 
                            download={img.filename} 
                            title="Download Plot"
                          >
                            <Download size={14} />
                          </a>
                        </div>
                      </div>
                      <div className="media-title-bar">
                        <div className="media-name">{img.filename}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lightbox zooming modal */}
      {lightboxItem && (
        <div className="lightbox" onClick={() => setLightboxItem(null)}>
          <button className="lightbox-close" onClick={() => setLightboxItem(null)}>
            <X size={20} />
          </button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxItem.url} alt={lightboxItem.filename} />
          </div>
          <div className="lightbox-title">{lightboxItem.filename}</div>
        </div>
      )}
    </div>
  );
}
