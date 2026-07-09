import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { 
  Play, Home, Terminal, Image as ImageIcon, Loader2, 
  Copy, Download, Maximize2, X, ChevronLeft, ChevronRight, Check, FileCode, Trash2
} from 'lucide-react';

export default function RunnerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Editor and Template States
  const [code, setCode] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(true);

  // Load code from state or fetch recent code
  useEffect(() => {
    if (location.state && location.state.code) {
      setCode(location.state.code);
    } else {
      axios.get('http://localhost:3002/api/recent-code')
        .then(res => setCode(res.data.code))
        .catch(err => setCode('# Write your Python code here...\nprint("Hello World!")'));
    }
  }, [location.state]);
  
  // Console / Output States
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState('');
  const [isError, setIsError] = useState(false);
  const [mediaFiles, setMediaFiles] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  
  // Metrics / Status States
  const [executionTime, setExecutionTime] = useState(null);
  const [editorLinesCount, setEditorLinesCount] = useState(0);
  const [editorCharsCount, setEditorCharsCount] = useState(0);
  const [copied, setCopied] = useState(false);
  
  // Lightbox modal state
  const [lightboxItem, setLightboxItem] = useState(null);

  // Calculate lines/chars on code change
  useEffect(() => {
    const lines = code.split('\n').length;
    setEditorLinesCount(lines);
    setEditorCharsCount(code.length);
  }, [code]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLightboxItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [packagesStatus, setPackagesStatus] = useState({});

  // Fetch package status on mount
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
    setLogs('Running Python script...');
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
      
      // Update media URLs
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
    element.download = `execution_output_${Date.now()}.log`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleClearOutput = () => {
    setLogs('');
    setMediaFiles([]);
    setExecutionTime(null);
  };

  const images = mediaFiles.filter(m => m.type === 'image');

  return (
    <div className="runner-layout">
      {/* Primary Icon Sidebar */}
      <div className="sidebar">
        <div 
          className="sidebar-icon active-brand" 
          onClick={() => navigate('/home')} 
          title="Go back to Dashboard"
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigate('/home'); }}
          aria-label="Go back to Dashboard"
        >
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

      {/* Slide-out Templates Drawer */}
      <div className={`template-drawer ${drawerOpen ? '' : 'collapsed'}`}>
        <div className="drawer-header">
          <span className="drawer-title">Python Environment</span>
          <button 
            className="console-btn" 
            style={{ padding: '0.2rem' }} 
            onClick={() => setDrawerOpen(false)}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        {/* Installed Python Libraries Status */}
        <div style={{ padding: '1rem', borderTop: '1px solid var(--border)' }}>
          <div className="drawer-title" style={{ marginBottom: '0.75rem', fontSize: '0.75rem' }}>Python Libraries</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            {Object.entries(packagesStatus).map(([name, installed]) => (
              <span 
                key={name} 
                style={{ 
                  fontSize: '0.65rem', 
                  padding: '0.2rem 0.55rem', 
                  borderRadius: '4px', 
                  backgroundColor: installed ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.04)',
                  color: installed ? 'var(--success)' : 'var(--text-muted)',
                  border: `1px solid ${installed ? 'rgba(16, 185, 129, 0.22)' : 'var(--border)'}`,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontWeight: '600'
                }}
              >
                <span 
                  style={{ 
                    width: '5px', 
                    height: '5px', 
                    borderRadius: '50%', 
                    backgroundColor: installed ? 'var(--success)' : 'var(--text-muted)',
                    display: 'inline-block'
                  }}
                />
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Code Editor Pane */}
      <div className="editor-pane">
        <div className="pane-header">
          <div className="pane-title-container">
            <span className="pane-title">Python Editor</span>
            <span className="tag-badge">Python 3.x</span>
          </div>
          <button 
            className="btn btn-primary" 
            style={{ padding: '0.45rem 1.1rem', fontSize: '0.85rem' }} 
            onClick={runCode} 
            disabled={isRunning}
          >
            {isRunning ? (
              <Loader2 size={15} className="spin-anim" />
            ) : (
              <Play size={15} />
            )}
            <span>{isRunning ? 'Executing...' : 'Run Code'}</span>
          </button>
        </div>
        
        {/* Monaco Editor Wrapper */}
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
              {isRunning ? 'Running Script...' : 'System Ready'}
            </span>
            {executionTime !== null && (
              <span style={{ color: 'var(--success)' }}>
                Done in {executionTime}ms
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

      {/* Output Console and Media Gallery Pane */}
      <div className="output-pane">
        {/* Navigation Tabs */}
        <div className="tabs">
          <div 
            className={`tab ${activeTab === 'logs' ? 'active' : ''}`} 
            onClick={() => setActiveTab('logs')}
          >
            <Terminal size={15} /> Outputs
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
            onClick={handleClearOutput}
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
                  {copied ? <Check size={13} color="var(--success)" /> : <Copy size={13} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button className="console-btn" onClick={downloadLogs} disabled={!logs}>
                  <Download size={13} /> Logs
                </button>
              </div>
              <div className={`log-viewer ${isError ? 'error' : ''}`}>
                {logs || 'Press "Run Code" to compile and execute your Python script.'}
              </div>
            </div>
          )}
          
          {activeTab === 'plots' && (
            <div>
              {images.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <ImageIcon size={48} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                  <p>No plots generated yet.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '0.4rem' }}>
                    Save plots using <code>plt.savefig("filename.png")</code>
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

      {/* Fullscreen Lightbox Zoom Modal */}
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
