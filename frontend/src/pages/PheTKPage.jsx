import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Play, Home, Terminal, Image as ImageIcon, Loader2, 
  Download, Maximize2, X, ChevronLeft, Dna, Check, FileCode, Trash2,
  Upload, Settings, AlertTriangle, Table, RefreshCw, BarChart2, Eye,
  ChevronRight, FileSpreadsheet, AlertCircle
} from 'lucide-react';

const API_BASE = 'http://localhost:3002';

export default function PheTKPage() {
  const navigate = useNavigate();
  
  // Pipeline State
  const [runId, setRunId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle, initialized, uploaded, configured, mapping, mapped, stats_running, analyzed, plotting, completed, failed
  const [activeStep, setActiveStep] = useState(1);
  const [logs, setLogs] = useState('');
  const [isError, setIsError] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  
  // File upload states
  const [phenotypeFile, setPhenotypeFile] = useState(null);
  const [genotypeFile, setGenotypeFile] = useState(null);
  const [phenotypeHeaders, setPhenotypeHeaders] = useState([]);
  const [genotypeHeaders, setGenotypeHeaders] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  
  // Configuration states
  const [config, setConfig] = useState({
    phecode_version: '1.2',
    icd_version: 'US',
    id_col: '',
    icd_col: '',
    vocab_col: '',
    date_col: '',
    independent_var: '',
    covariates: [],
    sex_col: '',
    cohort_id_col: '',
    male_as_one: true,
    min_cases: 5,
    min_phecode_count: 2
  });
  
  // Execution Outputs
  const [mappingSummary, setMappingSummary] = useState(null);
  const [statsSummary, setStatsSummary] = useState(null);
  const [findings, setFindings] = useState([]);
  const [plotUrl, setPlotUrl] = useState(null);
  
  // UI states
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [history, setHistory] = useState([]);
  const [packagesStatus, setPackagesStatus] = useState({});
  const [lightboxItem, setLightboxItem] = useState(null);
  const [logsOpen, setLogsOpen] = useState(true);
  
  // Table sorting & pagination
  const [sortField, setSortField] = useState('p_value');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Initialize or fetch history on load
  useEffect(() => {
    fetchHistory();
    fetchPackages();
    initializeRun();
  }, []);

  const initializeRun = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/phetk/pipeline/initialize`);
      setRunId(res.data.runId);
      setStatus('initialized');
      setActiveStep(1);
      setPhenotypeFile(null);
      setGenotypeFile(null);
      setPhenotypeHeaders([]);
      setGenotypeHeaders([]);
      setMappingSummary(null);
      setStatsSummary(null);
      setFindings([]);
      setPlotUrl(null);
      setLogs('Pipeline session initialized.');
    } catch (err) {
      console.error('Failed to initialize run:', err);
      setLogs('Error: Failed to initialize pipeline run.');
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/phetk/pipeline/history`);
      setHistory(res.data);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  };

  const fetchPackages = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/packages`);
      setPackagesStatus(res.data);
    } catch (err) {
      console.error('Failed to load packages status:', err);
    }
  };

  const loadPastRun = async (pastRunId) => {
    setIsRunning(true);
    setLogs(`Loading past run ${pastRunId}...`);
    try {
      const res = await axios.get(`${API_BASE}/api/phetk/pipeline/results/${pastRunId}`);
      const { runInfo, topFindings } = res.data;
      
      setRunId(runInfo.runId);
      setStatus(runInfo.status);
      setConfig(runInfo.config || {});
      setPhenotypeFile(runInfo.phenotypeName ? { name: runInfo.phenotypeName } : null);
      setGenotypeFile(runInfo.genotypeName ? { name: runInfo.genotypeName } : null);
      setMappingSummary(runInfo.mapping_summary || null);
      setStatsSummary(runInfo.stats_summary || null);
      setFindings(topFindings || []);
      
      if (runInfo.status === 'completed') {
        setPlotUrl(`${API_BASE}/api/phetk/pipeline/download/${runInfo.runId}/manhattan_plot.png`);
        setActiveStep(4);
      } else if (runInfo.status === 'analyzed' || runInfo.status === 'no_results') {
        setPlotUrl(null);
        setActiveStep(3);
      } else if (runInfo.status === 'mapped') {
        setPlotUrl(null);
        setActiveStep(3);
      } else {
        setPlotUrl(null);
        setActiveStep(1);
      }
      
      setLogs(`Run ${pastRunId} successfully loaded.`);
      setIsError(false);
    } catch (err) {
      console.error('Failed to load past run:', err);
      setLogs(`Error loading past run: ${err.message}`);
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  const deleteRun = async (targetRunId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to permanently delete this run and its generated files from local storage?')) return;
    try {
      await axios.delete(`${API_BASE}/api/phetk/pipeline/run/${targetRunId}`);
      if (runId === targetRunId) {
        initializeRun();
      }
      fetchHistory();
    } catch (err) {
      console.error('Failed to delete run:', err);
      alert('Failed to delete run files.');
    }
  };

  // Step 1: Upload Files
  const handleFileUpload = (e, fileType) => {
    const file = e.target.files[0];
    if (!file) return;

    if (fileType === 'phenotype') {
      setPhenotypeFile(file);
    } else {
      setGenotypeFile(file);
    }
  };

  const uploadAndParseHeaders = async () => {
    if (!phenotypeFile || !genotypeFile) {
      alert('Please select both phenotype and genotype files.');
      return;
    }
    
    setIsUploading(true);
    setLogs('Uploading files and reading headers...');
    
    try {
      const readAsText = (file) => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = (error) => reject(error);
          reader.readAsText(file);
        });
      };
      
      const phenotypeContent = await readAsText(phenotypeFile);
      const genotypeContent = await readAsText(genotypeFile);
      
      const res = await axios.post(`${API_BASE}/api/phetk/pipeline/upload`, {
        runId,
        phenotypeContent,
        phenotypeName: phenotypeFile.name,
        genotypeContent,
        genotypeName: genotypeFile.name
      });
      
      setPhenotypeHeaders(res.data.phenotypeHeaders);
      setGenotypeHeaders(res.data.genotypeHeaders);
      
      // Pre-populate column settings
      const phenoH = res.data.phenotypeHeaders;
      const genoH = res.data.genotypeHeaders;
      setConfig(prev => ({
        ...prev,
        id_col: phenoH.find(h => h.toLowerCase() === 'person_id' || h.toLowerCase() === 'patient_id') || phenoH[0] || '',
        icd_col: phenoH.find(h => h.toLowerCase() === 'icd' || h.toLowerCase() === 'icd_code') || phenoH[1] || '',
        vocab_col: phenoH.find(h => h.toLowerCase() === 'vocabulary_id' || h.toLowerCase() === 'vocab') || '',
        date_col: phenoH.find(h => h.toLowerCase() === 'date' || h.toLowerCase() === 'event_date') || '',
        independent_var: genoH.find(h => h.toLowerCase() === 'genotype' || h.toLowerCase().includes('genotype_val')) || genoH[1] || '',
        sex_col: genoH.find(h => h.toLowerCase() === 'sex' || h.toLowerCase() === 'gender') || genoH[2] || '',
        cohort_id_col: genoH.find(h => h.toLowerCase() === 'person_id' || h.toLowerCase() === 'patient_id' || h.toLowerCase() === 'subject_id') || genoH[0] || '',
        covariates: genoH.filter(h => (h.toLowerCase() === 'age' || h.toLowerCase() === 'sex' || h.toLowerCase() === 'gender') && h.toLowerCase() !== 'patient_id' && h.toLowerCase() !== 'person_id')
      }));
      
      setStatus('uploaded');
      setLogs('Files uploaded successfully. Headers successfully parsed.');
    } catch (err) {
      console.error('File upload failed:', err);
      setLogs(`Error: File upload failed. ${err.message}`);
      setIsError(true);
    } finally {
      setIsUploading(false);
    }
  };

  // Step 2: Configure & Mapping
  const saveConfig = async () => {
    try {
      await axios.post(`${API_BASE}/api/phetk/pipeline/configure`, {
        runId,
        config
      });
    } catch (err) {
      console.error('Failed to save config:', err);
    }
  };

  const runMapping = async () => {
    setIsRunning(true);
    setStatus('mapping');
    setLogs('Step 2: Mapping ICD codes to Phecodes using DuckDB/Polars engines...');
    
    await saveConfig();
    
    try {
      const res = await axios.post(`${API_BASE}/api/phetk/pipeline/step2-map`, { runId });
      setMappingSummary(res.data.summary);
      setStatus('mapped');
      setLogs(`Step 2 Mapping Completed successfully in ${res.data.timeMs}ms!\nUnique Participants: ${res.data.summary.unique_participants}\nUnique Phecodes Mapped: ${res.data.summary.unique_phecodes}\nTotal clinical billing code entries mapping events: ${res.data.summary.total_records}`);
      setActiveStep(3);
      setIsError(false);
      fetchHistory();
    } catch (err) {
      console.error('Mapping failed:', err);
      setLogs(`Step 2 Mapping Failed:\n${err.response?.data?.error || err.message}`);
      setStatus('failed');
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 3: Run Regressions
  const runRegression = async () => {
    setIsRunning(true);
    setStatus('stats_running');
    setLogs('Step 3: Loading cohorts and calculating genetic associations via Statsmodels Logistic/Cox regressions...');
    
    try {
      const res = await axios.post(`${API_BASE}/api/phetk/pipeline/step3-stats`, { runId });
      const { summary } = res.data;
      
      if (summary.status === 'no_results') {
        setStatus('no_results');
        setFindings([]);
        setStatsSummary(summary);
        setLogs(`Step 3 Complete (No findings):\n${summary.message}`);
      } else {
        setFindings(summary.top_findings || []);
        setStatus('analyzed');
        setStatsSummary(summary);
        setLogs(`Step 3 Association Completed successfully in ${res.data.timeMs}ms!\nTested Phecodes: ${summary.tested_count}\nSignificantly Mapped Associations (Above Bonferroni): ${summary.above_bonferroni}`);
        setActiveStep(4);
      }
      setIsError(false);
      fetchHistory();
    } catch (err) {
      console.error('Stats regression failed:', err);
      setLogs(`Step 3 Statistics Failed:\n${err.response?.data?.error || err.message}`);
      setStatus('failed');
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  // Step 4: Run Visualization
  const runVisualization = async () => {
    setIsRunning(true);
    setStatus('plotting');
    setLogs('Step 4: Compiling statistical coefficients and plotting Manhattan association plot...');
    
    try {
      const res = await axios.post(`${API_BASE}/api/phetk/pipeline/step4-visualize`, { runId });
      setPlotUrl(`${API_BASE}${res.data.plotUrl}?t=${Date.now()}`);
      setStatus('completed');
      setLogs('Step 4 Visualization Completed! Manhattan plot generated successfully.');
      setIsError(false);
      fetchHistory();
    } catch (err) {
      console.error('Visualization failed:', err);
      setLogs(`Step 4 Visualization Failed:\n${err.response?.data?.error || err.message}`);
      setStatus('failed');
      setIsError(true);
    } finally {
      setIsRunning(false);
    }
  };

  // Multi-select covariates handler
  const handleCovariateChange = (h) => {
    setConfig(prev => {
      const updated = prev.covariates.includes(h)
        ? prev.covariates.filter(c => c !== h)
        : [...prev.covariates, h];
      return { ...prev, covariates: updated };
    });
  };

  // Sorting Table
  const requestSort = (field) => {
    let direction = 'asc';
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc';
    }
    setSortField(field);
    setSortDirection(direction);
  };

  const sortedFindings = [...findings].sort((a, b) => {
    let valA = a[sortField];
    let valB = b[sortField];
    
    if (valA === undefined || valA === null) valA = '';
    if (valB === undefined || valB === null) valB = '';
    
    if (typeof valA === 'number' && typeof valB === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    }
    return sortDirection === 'asc' 
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  const paginatedFindings = sortedFindings.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(sortedFindings.length / itemsPerPage);

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '▲' : '▼';
  };

  return (
    <div className="runner-layout" style={{ background: 'var(--neo-bg)', color: 'var(--neo-text-dark)' }}>
      {/* Primary Sidebar */}
      <div className="sidebar" style={{ background: '#e0e5ec', borderRight: '1px solid rgba(163, 177, 198, 0.4)' }}>
        <div className="sidebar-icon" onClick={() => navigate('/')} title="Go back to Home">
          <Home size={22} color="var(--neo-text-muted)" />
        </div>
        <div 
          className={`sidebar-icon ${drawerOpen ? 'active' : ''}`} 
          onClick={() => setDrawerOpen(!drawerOpen)} 
          title="Toggle Runs History Drawer"
        >
          <FileCode size={22} color="var(--neo-text-muted)" />
        </div>
      </div>

      {/* History Drawer Slider */}
      <div className={`template-drawer ${drawerOpen ? '' : 'collapsed'}`} style={{ background: '#e0e5ec', borderRight: '1px solid rgba(163, 177, 198, 0.4)' }}>
        <div className="drawer-header" style={{ borderBottom: '1px solid rgba(163, 177, 198, 0.3)' }}>
          <span className="drawer-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--neo-text-dark)' }}>
            <Dna size={16} color="#3b82f6" /> Pipeline Runs
          </span>
          <button 
            className="console-btn" 
            style={{ padding: '0.2rem', background: 'transparent', border: 'none' }} 
            onClick={() => setDrawerOpen(false)}
          >
            <ChevronLeft size={16} color="var(--neo-text-muted)" />
          </button>
        </div>

        {/* Previous Runs List */}
        <div className="template-list">
          <button 
            className="neumorphic-btn btn-primary" 
            style={{ margin: '0.5rem 0.25rem 0.75rem 0.25rem', padding: '0.45rem', fontSize: '0.8rem', display: 'flex', gap: '0.35rem', justifyContent: 'center' }} 
            onClick={initializeRun}
          >
            <RefreshCw size={14} /> New Analysis Run
          </button>

          <div style={{ fontSize: '0.7rem', padding: '0 0.5rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
            History
          </div>

          <div className="scroll-container" style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.65rem', padding: '0.25rem' }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1rem 0.5rem', fontSize: '0.75rem', color: 'var(--neo-text-muted)' }}>
                No runs recorded.
              </div>
            ) : (
              history.map((run) => (
                <div 
                  key={run.runId} 
                  className={`template-card ${runId === run.runId ? 'active' : ''}`}
                  style={{ 
                    padding: '0.65rem',
                    background: '#e0e5ec',
                    boxShadow: runId === run.runId ? 'var(--neo-shadow-pressed)' : 'var(--neo-shadow-raised)',
                    border: '1px solid rgba(255, 255, 255, 0.4)',
                    position: 'relative'
                  }}
                  onClick={() => loadPastRun(run.runId)}
                >
                  <div className="template-name" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--neo-text-dark)', fontSize: '0.75rem', fontWeight: '600' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>
                      Run {run.runId.substring(0, 8)}
                    </span>
                    <span style={{ 
                      fontSize: '0.6rem', 
                      padding: '0.1rem 0.3rem', 
                      borderRadius: '4px',
                      background: run.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                      color: run.status === 'completed' ? '#10b981' : '#f59e0b'
                    }}>
                      {run.status}
                    </span>
                  </div>
                  <div className="template-desc" style={{ fontSize: '0.65rem', color: 'var(--neo-text-muted)', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>{new Date(run.created_at).toLocaleDateString()}</span>
                    <button 
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', padding: '0.15rem' }} 
                      onClick={(e) => deleteRun(run.runId, e)}
                      title="Delete run folder"
                    >
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Library Environment Details */}
        <div style={{ padding: '1rem', borderTop: '1px solid rgba(163, 177, 198, 0.2)' }}>
          <div className="drawer-title" style={{ marginBottom: '0.75rem', fontSize: '0.75rem', color: 'var(--neo-text-muted)' }}>Environment Status</div>
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
                    fontSize: '0.7rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    background: '#e0e5ec',
                    boxShadow: 'var(--neo-shadow-sunken)',
                    color: installed ? '#10b981' : '#ef4444'
                  }}
                >
                  <span style={{ fontWeight: '600' }}>{lib}</span>
                  <span style={{ fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {installed ? <Check size={10} /> : <X size={10} />}
                    {installed ? 'Ready' : 'Missing'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Workspace split panel layout */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        
        {/* Workspace Header & Step Navigator */}
        <div style={{ padding: '1rem 1.5rem', background: '#e0e5ec', borderBottom: '1px solid rgba(163, 177, 198, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--neo-text-dark)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Dna color="#3b82f6" size={20} /> PheTK Pipeline Workspace
            </span>
            <span style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', borderRadius: '4px', fontWeight: 'bold' }}>
              Local Pipeline v0.3
            </span>
          </div>

          {/* Stepper buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {[
              { num: 1, name: 'Data & Config' },
              { num: 2, name: 'Mapping' },
              { num: 3, name: 'Statistics' },
              { num: 4, name: 'Visualization' }
            ].map(step => (
              <button 
                key={step.num}
                onClick={() => {
                  // Only allow navigation to steps already configured or available
                  if (step.num === 1) setActiveStep(1);
                  else if (step.num === 2 && (status !== 'initialized' && status !== 'idle')) setActiveStep(2);
                  else if (step.num === 3 && (status === 'mapped' || status === 'analyzed' || status === 'completed')) setActiveStep(3);
                  else if (step.num === 4 && status === 'completed') setActiveStep(4);
                }}
                disabled={
                  (step.num === 2 && (status === 'initialized' || status === 'idle')) ||
                  (step.num === 3 && (status !== 'mapped' && status !== 'analyzed' && status !== 'completed')) ||
                  (step.num === 4 && status !== 'completed')
                }
                style={{ 
                  padding: '0.4rem 0.8rem',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                  background: '#e0e5ec',
                  boxShadow: activeStep === step.num ? 'var(--neo-shadow-pressed)' : 'var(--neo-shadow-raised)',
                  color: activeStep === step.num ? '#3b82f6' : 'var(--neo-text-dark)',
                  opacity: (step.num === 2 && (status === 'initialized' || status === 'idle')) ||
                           (step.num === 3 && (status !== 'mapped' && status !== 'analyzed' && status !== 'completed')) ||
                           (step.num === 4 && status !== 'completed') ? 0.5 : 1
                }}
              >
                {step.num}. {step.name}
              </button>
            ))}
          </div>
        </div>

        {/* Step Content Area */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          
          {/* LEFT PANEL: Wizard Settings / Actions */}
          <div style={{ width: '40%', padding: '1.5rem', overflowY: 'auto', borderRight: '1px solid rgba(163, 177, 198, 0.3)', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* STEP 1: Upload & Config */}
            {activeStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <Upload size={18} color="#3b82f6" /> Step 1: Upload Data & Configurations
                </div>
                
                {/* File selectors */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {/* Phenotype ICD file */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--neo-text-muted)' }}>Phenotype (Clinical ICD Codes File)</span>
                    <label style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: '#e0e5ec', 
                      boxShadow: 'var(--neo-shadow-raised)', 
                      border: '1px dashed rgba(163,177,198,0.8)',
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <FileSpreadsheet size={24} color="#3b82f6" />
                      <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                        {phenotypeFile ? phenotypeFile.name : 'Choose ICD Phenotype CSV/TSV'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--neo-text-muted)' }}>
                        Expected columns: patient_id, ICD code, vocabulary_id
                      </span>
                      <input type="file" onChange={(e) => handleFileUpload(e, 'phenotype')} style={{ display: 'none' }} accept=".csv,.tsv,.txt" />
                    </label>
                  </div>

                  {/* Genotype Trait file */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--neo-text-muted)' }}>Genotype (Participant Trait/Covariates File)</span>
                    <label style={{ 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: '#e0e5ec', 
                      boxShadow: 'var(--neo-shadow-raised)', 
                      border: '1px dashed rgba(163,177,198,0.8)',
                      cursor: 'pointer', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}>
                      <FileSpreadsheet size={24} color="#10b981" />
                      <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                        {genotypeFile ? genotypeFile.name : 'Choose Genotype Cohort CSV/TSV'}
                      </span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--neo-text-muted)' }}>
                        Contains patient identifiers, traits, age, gender, etc.
                      </span>
                      <input type="file" onChange={(e) => handleFileUpload(e, 'genotype')} style={{ display: 'none' }} accept=".csv,.tsv,.txt" />
                    </label>
                  </div>

                  {phenotypeFile && genotypeFile && (status === 'initialized' || status === 'failed') && (
                    <button 
                      onClick={uploadAndParseHeaders} 
                      disabled={isUploading}
                      className="neumorphic-btn btn-primary"
                      style={{ padding: '0.6rem', fontSize: '0.85rem' }}
                    >
                      {isUploading ? <Loader2 size={16} className="spin-anim" /> : <Upload size={16} />}
                      <span>{isUploading ? 'Parsing datasets...' : 'Upload & Parse Headers'}</span>
                    </button>
                  )}
                </div>

                {/* Configurations mapping section (Visible after upload success) */}
                {(status === 'uploaded' || status === 'configured' || status === 'mapped' || status === 'analyzed' || status === 'completed') && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem', padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-sunken)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--neo-text-muted)' }}>
                      <Settings size={14} /> Pipeline Configurations
                    </div>

                    {/* Phecode version */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>Phecode Version</span>
                      <select 
                        value={config.phecode_version} 
                        onChange={(e) => setConfig({ ...config, phecode_version: e.target.value })}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.75rem', fontWeight: '600' }}
                      >
                        <option value="1.2">v1.2 (ICD-9 Mapping)</option>
                        <option value="X">vX (ICD-10 Mapping)</option>
                      </select>
                    </div>

                    {/* ICD Version */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '600' }}>ICD Version</span>
                      <select 
                        value={config.icd_version} 
                        onChange={(e) => setConfig({ ...config, icd_version: e.target.value })}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '8px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.75rem', fontWeight: '600' }}
                      >
                        <option value="US">US Clinical Modification</option>
                        <option value="WHO">WHO Standard Edition</option>
                      </select>
                    </div>

                    {/* Column mappings for phenotype */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(163,177,198,0.3)', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase' }}>Phenotype Column Mapping</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Patient ID Column</span>
                        <select 
                          value={config.id_col}
                          onChange={(e) => setConfig({ ...config, id_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          {phenotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>ICD Code Column</span>
                        <select 
                          value={config.icd_col}
                          onChange={(e) => setConfig({ ...config, icd_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          {phenotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Vocabulary ID (Opt)</span>
                        <select 
                          value={config.vocab_col}
                          onChange={(e) => setConfig({ ...config, vocab_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          <option value="">-- None (Auto-Default) --</option>
                          {phenotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Date Column (Opt)</span>
                        <select 
                          value={config.date_col}
                          onChange={(e) => setConfig({ ...config, date_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          <option value="">-- None (Auto-Default) --</option>
                          {phenotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* Column mappings for genotype */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(163,177,198,0.3)', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase' }}>Genotype Column Mapping</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Participant ID Column</span>
                        <select 
                          value={config.cohort_id_col}
                          onChange={(e) => setConfig({ ...config, cohort_id_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          {genotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Genotype column</span>
                        <select 
                          value={config.independent_var}
                          onChange={(e) => setConfig({ ...config, independent_var: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          {genotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Sex/Gender column</span>
                        <select 
                          value={config.sex_col}
                          onChange={(e) => setConfig({ ...config, sex_col: e.target.value })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '60%' }}
                        >
                          <option value="">-- None --</option>
                          {genotypeHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Male value representation</span>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', cursor: 'pointer' }}>
                          <input 
                            type="checkbox" 
                            checked={config.male_as_one} 
                            onChange={(e) => setConfig({ ...config, male_as_one: e.target.checked })} 
                          />
                          Male is 1 (Female is 0)
                        </label>
                      </div>

                      {/* Covariates multi-select list */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem' }}>Covariates (Select multiples)</span>
                        <div style={{ 
                          maxHeight: '100px', 
                          overflowY: 'auto', 
                          border: '1px solid #c8d0d8', 
                          borderRadius: '6px', 
                          padding: '0.35rem',
                          background: '#e0e5ec',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.25rem'
                        }}>
                          {genotypeHeaders.map(h => (
                            <label key={h} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', cursor: 'pointer' }}>
                              <input 
                                type="checkbox" 
                                checked={config.covariates.includes(h)} 
                                onChange={() => handleCovariateChange(h)} 
                                disabled={h === config.independent_var}
                              />
                              {h}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Statistical thresholds */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid rgba(163,177,198,0.3)', paddingTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase' }}>Statistical Filters</div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Min Cases (Threshold)</span>
                        <input 
                          type="number" 
                          value={config.min_cases} 
                          onChange={(e) => setConfig({ ...config, min_cases: Number(e.target.value) })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '25%', textAlign: 'center' }} 
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem' }}>Min Phecode Count</span>
                        <input 
                          type="number" 
                          value={config.min_phecode_count} 
                          onChange={(e) => setConfig({ ...config, min_phecode_count: Number(e.target.value) })}
                          style={{ padding: '0.25rem 0.5rem', borderRadius: '6px', border: '1px solid #c8d0d8', background: '#e0e5ec', fontSize: '0.7rem', width: '25%', textAlign: 'center' }} 
                        />
                      </div>
                    </div>

                    <button 
                      onClick={() => { runMapping(); }} 
                      className="neumorphic-btn btn-primary"
                      style={{ padding: '0.55rem', fontSize: '0.8rem', width: '100%', marginTop: '0.5rem' }}
                    >
                      <ChevronRight size={15} /> Save & Proceed to Mapping
                    </button>

                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Mapping Action */}
            {activeStep === 2 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <Dna size={18} color="#3b82f6" /> Step 2: ICD-to-Phecode Mapping
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--neo-text-muted)', lineHeight: '1.4' }}>
                  This step translates billing diagnosis codes (like ICD-9 or ICD-10) into clinically-grouped "Phecodes". It aggregates records per patient, calculating event dates to prepare the cohort-phecode matrix.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-sunken)', fontSize: '0.75rem' }}>
                  <div><strong>Phecode Version:</strong> v{config.phecode_version}</div>
                  <div><strong>ICD Dictionary:</strong> {config.icd_version}</div>
                  <div><strong>Mapping fields:</strong> {config.id_col} → person_id, {config.icd_col} → ICD</div>
                </div>

                <button 
                  onClick={runMapping} 
                  disabled={isRunning}
                  className="neumorphic-btn btn-primary"
                  style={{ padding: '0.65rem', fontSize: '0.85rem' }}
                >
                  {isRunning ? <Loader2 size={16} className="spin-anim" /> : <Play size={16} />}
                  <span>{isRunning ? 'Running Mapping...' : 'Execute Mapping Step'}</span>
                </button>

                {mappingSummary && (
                  <button 
                    onClick={() => setActiveStep(3)} 
                    className="neumorphic-btn btn-secondary"
                    style={{ padding: '0.55rem', fontSize: '0.8rem' }}
                  >
                    <span>Proceed to Step 3: Statistics</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            )}

            {/* STEP 3: Statistics Action */}
            {activeStep === 3 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <Table size={18} color="#10b981" /> Step 3: Association Statistics
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--neo-text-muted)', lineHeight: '1.4' }}>
                  Calculates regression models (logistic or Cox models) correlating patients' genetic trait (independent variable) against all mapped Phecode phenotypes, controlling for age, sex, or other selected covariates.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-sunken)', fontSize: '0.75rem' }}>
                  <div><strong>Independent Trait:</strong> {config.independent_var}</div>
                  <div><strong>Covariates:</strong> {config.covariates.join(', ') || 'None'}</div>
                  <div><strong>Sex Variable:</strong> {config.sex_col || 'None'}</div>
                  <div><strong>Min Cases:</strong> {config.min_cases} patients</div>
                </div>

                <button 
                  onClick={runRegression} 
                  disabled={isRunning}
                  className="neumorphic-btn btn-primary"
                  style={{ padding: '0.65rem', fontSize: '0.85rem', background: '#10b981', boxShadow: '0 4px 20px 0 rgba(16, 185, 129, 0.3)' }}
                >
                  {isRunning ? <Loader2 size={16} className="spin-anim" /> : <Play size={16} />}
                  <span>{isRunning ? 'Running Associations...' : 'Run Statistical Regressions'}</span>
                </button>

                {statsSummary && statsSummary.status !== 'no_results' && (
                  <button 
                    onClick={() => {
                      if (status === 'completed') {
                        setActiveStep(4);
                      } else {
                        runVisualization();
                      }
                    }} 
                    disabled={isRunning}
                    className="neumorphic-btn btn-secondary"
                    style={{ padding: '0.55rem', fontSize: '0.8rem' }}
                  >
                    <span>Proceed to Step 4: Manhattan Plot</span>
                    <ChevronRight size={15} />
                  </button>
                )}
              </div>
            )}

            {/* STEP 4: Visualization Action */}
            {activeStep === 4 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 'bold', fontSize: '0.9rem' }}>
                  <BarChart2 size={18} color="#a855f7" /> Step 4: Manhattan Visualization
                </div>

                <p style={{ fontSize: '0.75rem', color: 'var(--neo-text-muted)', lineHeight: '1.4' }}>
                  Compiles regression p-values and outputs a comprehensive Manhattan plot layout grouping phenotype categories with Bonferroni statistical significance bars.
                </p>

                <button 
                  onClick={runVisualization} 
                  disabled={isRunning}
                  className="neumorphic-btn btn-primary"
                  style={{ padding: '0.65rem', fontSize: '0.85rem', background: '#a855f7', boxShadow: '0 4px 20px 0 rgba(168, 85, 247, 0.3)' }}
                >
                  {isRunning ? <Loader2 size={16} className="spin-anim" /> : <Eye size={16} />}
                  <span>{isRunning ? 'Creating Plot...' : 'Re-Generate Manhattan Plot'}</span>
                </button>

                {/* Download links */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid rgba(163,177,198,0.3)', paddingTop: '1rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase' }}>Export Results Bundle</div>
                  
                  <a 
                    href={`${API_BASE}/api/phetk/pipeline/download/${runId}/phecode_counts.tsv`} 
                    download="phecode_counts.tsv"
                    className="neumorphic-btn btn-secondary"
                    style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-start', gap: '0.5rem' }}
                  >
                    <Download size={14} /> 1. Mapped Phecode Counts (TSV)
                  </a>

                  <a 
                    href={`${API_BASE}/api/phetk/pipeline/download/${runId}/results.tsv`} 
                    download="results.tsv"
                    className="neumorphic-btn btn-secondary"
                    style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-start', gap: '0.5rem' }}
                  >
                    <Download size={14} /> 2. Statistical Findings (TSV)
                  </a>

                  {plotUrl && (
                    <a 
                      href={`${API_BASE}/api/phetk/pipeline/download/${runId}/manhattan_plot.png`} 
                      download="manhattan_plot.png"
                      className="neumorphic-btn btn-secondary"
                      style={{ padding: '0.45rem', fontSize: '0.75rem', display: 'flex', justifyContent: 'flex-start', gap: '0.5rem' }}
                    >
                      <Download size={14} /> 3. Manhattan Plot (PNG)
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Error notifications */}
            {isError && (
              <div style={{ padding: '0.75rem', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: '0.5rem', alignItems: 'flex-start', fontSize: '0.75rem' }}>
                <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '0.1rem' }} />
                <div>
                  <div style={{ fontWeight: 'bold' }}>Execution Error</div>
                  <div style={{ opacity: 0.9 }}>Check the logs pane on the right for full trace details.</div>
                </div>
              </div>
            )}

          </div>

          {/* RIGHT PANEL: Outputs & Previews */}
          <div style={{ width: '60%', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#eef2f5' }}>
            
            {/* Header tab controller */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(163, 177, 198, 0.3)', background: '#e0e5ec', padding: '0 1rem' }}>
              <div 
                style={{ 
                  padding: '0.9rem 1.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderBottom: !logsOpen ? '2px solid #3b82f6' : '2px solid transparent',
                  color: !logsOpen ? '#3b82f6' : 'var(--neo-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onClick={() => setLogsOpen(false)}
              >
                {activeStep === 1 && <FileSpreadsheet size={15} />}
                {activeStep === 2 && <Dna size={15} />}
                {activeStep === 3 && <Table size={15} />}
                {activeStep === 4 && <ImageIcon size={15} />}
                {activeStep === 1 && 'Dataset Previews'}
                {activeStep === 2 && 'Mapping Report'}
                {activeStep === 3 && `Association Findings (${findings.length})`}
                {activeStep === 4 && 'Manhattan Visualizer'}
              </div>
              <div 
                style={{ 
                  padding: '0.9rem 1.25rem',
                  fontSize: '0.8rem',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  borderBottom: logsOpen ? '2px solid #3b82f6' : '2px solid transparent',
                  color: logsOpen ? '#3b82f6' : 'var(--neo-text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem'
                }}
                onClick={() => setLogsOpen(true)}
              >
                <Terminal size={15} /> Environment logs
              </div>
            </div>

            {/* Content wrapper */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem' }}>
              
              {/* If Logs tab is open */}
              {logsOpen ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <button 
                      className="console-btn" 
                      onClick={() => {
                        navigator.clipboard.writeText(logs);
                        alert('Copied to clipboard');
                      }}
                      style={{ background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      Copy
                    </button>
                    <button 
                      className="console-btn" 
                      onClick={() => setLogs('')}
                      style={{ background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '6px', padding: '0.25rem 0.5rem', fontSize: '0.7rem' }}
                    >
                      Clear
                    </button>
                  </div>
                  <pre 
                    style={{ 
                      flex: 1, 
                      padding: '1rem', 
                      borderRadius: '12px', 
                      background: '#1e293b', 
                      color: isError ? '#f87171' : '#34d399', 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: '0.75rem', 
                      whiteSpace: 'pre-wrap', 
                      overflowY: 'auto',
                      border: '1px solid rgba(0,0,0,0.1)'
                    }}
                  >
                    {logs || 'Pipeline processes messages output logs will generate here.'}
                  </pre>
                </div>
              ) : (
                /* Otherwise, display step-specific output reviews */
                <div>
                  {/* Step 1 Previews */}
                  {activeStep === 1 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {phenotypeFile ? (
                        <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', border: '1px solid rgba(255,255,255,0.4)' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Check size={16} color="#10b981" /> Phenotype ICD File Selected</h4>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neo-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div><strong>Name:</strong> {phenotypeFile.name}</div>
                            <div><strong>Size:</strong> {(phenotypeFile.size / 1024).toFixed(1)} KB</div>
                            {phenotypeHeaders.length > 0 && <div style={{ gridColumn: 'span 2' }}><strong>Columns Found:</strong> {phenotypeHeaders.join(', ')}</div>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neo-text-muted)', fontSize: '0.8rem' }}>
                          Please select an ICD Phenotype code file on the left.
                        </div>
                      )}

                      {genotypeFile ? (
                        <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', border: '1px solid rgba(255,255,255,0.4)' }}>
                          <h4 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Check size={16} color="#10b981" /> Genotype Trait File Selected</h4>
                          <div style={{ fontSize: '0.75rem', color: 'var(--neo-text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                            <div><strong>Name:</strong> {genotypeFile.name}</div>
                            <div><strong>Size:</strong> {(genotypeFile.size / 1024).toFixed(1)} KB</div>
                            {genotypeHeaders.length > 0 && <div style={{ gridColumn: 'span 2' }}><strong>Columns Found:</strong> {genotypeHeaders.join(', ')}</div>}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--neo-text-muted)', fontSize: '0.8rem' }}>
                          Please select a Genotype Cohort traits file on the left.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2 Mapping Output */}
                  {activeStep === 2 && (
                    <div>
                      {mappingSummary ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                          {/* Key metrics cards */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                            <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', textAlign: 'center' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#3b82f6' }}>{mappingSummary.unique_participants}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Unique Cohorts</div>
                            </div>
                            <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', textAlign: 'center' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#10b981' }}>{mappingSummary.unique_phecodes}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Mapped Phecodes</div>
                            </div>
                            <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', textAlign: 'center' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '800', color: '#f59e0b' }}>{mappingSummary.total_records}</div>
                              <div style={{ fontSize: '0.65rem', fontWeight: 'bold', color: 'var(--neo-text-muted)', textTransform: 'uppercase', marginTop: '0.25rem' }}>Total Event Rows</div>
                            </div>
                          </div>

                          {/* Top mapped codes table */}
                          {mappingSummary.top_phecodes && (
                            <div style={{ padding: '1rem', borderRadius: '12px', background: '#e0e5ec', boxShadow: 'var(--neo-shadow-raised)', border: '1px solid rgba(255,255,255,0.4)' }}>
                              <h4 style={{ fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>Top Mapped Phecode Phenotypes</h4>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                                <thead>
                                  <tr style={{ borderBottom: '1px solid rgba(163,177,198,0.4)', textAlign: 'left', color: 'var(--neo-text-muted)' }}>
                                    <th style={{ padding: '0.4rem 0.25rem' }}>Phecode</th>
                                    <th style={{ padding: '0.4rem 0.25rem', textAlign: 'right' }}>Event Instances Count</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(mappingSummary.top_phecodes).map(([code, val]) => (
                                    <tr key={code} style={{ borderBottom: '1px solid rgba(163,177,198,0.2)' }}>
                                      <td style={{ padding: '0.4rem 0.25rem', fontFamily: 'var(--font-mono)' }}>{code}</td>
                                      <td style={{ padding: '0.4rem 0.25rem', textAlign: 'right', fontWeight: 'bold' }}>{val}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--neo-text-muted)' }}>
                          <Dna size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                          <p>No mapped data available yet.</p>
                          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Click "Execute Mapping Step" to run translation.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 3 Findings Table */}
                  {activeStep === 3 && (
                    <div>
                      {status === 'no_results' && (
                        <div style={{ padding: '2rem', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', fontSize: '0.75rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <AlertTriangle size={20} />
                          <div>
                            <div style={{ fontWeight: 'bold' }}>No Regressions Converged</div>
                            <div>{statsSummary?.message || 'Check filters.'}</div>
                          </div>
                        </div>
                      )}

                      {findings.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                          {/* Summary numbers */}
                          {statsSummary && (
                            <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: 'var(--neo-text-muted)', fontWeight: 'bold' }}>
                              <span>Total Tested codes: <span style={{ color: 'var(--neo-text-dark)' }}>{statsSummary.tested_count}</span></span>
                              <span>•</span>
                              <span>Significant associations (Above Bonferroni): <span style={{ color: '#10b981' }}>{statsSummary.above_bonferroni}</span></span>
                            </div>
                          )}

                          {/* Data Table */}
                          <div style={{ 
                            borderRadius: '12px', 
                            background: '#e0e5ec', 
                            boxShadow: 'var(--neo-shadow-raised)', 
                            border: '1px solid rgba(255,255,255,0.4)',
                            overflow: 'hidden'
                          }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                              <thead>
                                <tr style={{ background: '#d2d9e4', borderBottom: '1px solid rgba(163,177,198,0.4)', color: 'var(--neo-text-muted)' }}>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }} onClick={() => requestSort('phecode')}>Phecode {getSortIcon('phecode')}</th>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer' }} onClick={() => requestSort('phecode_string')}>Description {getSortIcon('phecode_string')}</th>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer', textAlign: 'right' }} onClick={() => requestSort('cases')}>Cases {getSortIcon('cases')}</th>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer', textAlign: 'right' }} onClick={() => requestSort('controls')}>Controls {getSortIcon('controls')}</th>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer', textAlign: 'right' }} onClick={() => requestSort('beta')}>Beta {getSortIcon('beta')}</th>
                                  <th style={{ padding: '0.65rem 0.5rem', cursor: 'pointer', textAlign: 'right' }} onClick={() => requestSort('p_value')}>p-value {getSortIcon('p_value')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {paginatedFindings.map((row, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid rgba(163,177,198,0.2)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.1)' }}>
                                    <td style={{ padding: '0.5rem', fontFamily: 'var(--font-mono)' }}>{row.phecode}</td>
                                    <td style={{ padding: '0.5rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '160px' }} title={row.phecode_string}>{row.phecode_string || '-'}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.cases}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{row.controls}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{typeof row.beta === 'number' ? row.beta.toFixed(3) : '-'}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: (row.p_value || 1) < 0.05 / findings.length ? 'bold' : 'normal', color: (row.p_value || 1) < 0.05 / findings.length ? '#10b981' : 'inherit' }}>
                                      {typeof row.p_value === 'number' ? row.p_value.toExponential(3) : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', background: '#d2d9e4', borderTop: '1px solid rgba(163,177,198,0.4)', fontSize: '0.7rem' }}>
                                <button 
                                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} 
                                  disabled={currentPage === 1}
                                  style={{ padding: '0.25rem 0.5rem', background: '#e0e5ec', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                                >
                                  Prev
                                </button>
                                <span>Page {currentPage} of {totalPages}</span>
                                <button 
                                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} 
                                  disabled={currentPage === totalPages}
                                  style={{ padding: '0.25rem 0.5rem', background: '#e0e5ec', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '4px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                                >
                                  Next
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--neo-text-muted)' }}>
                          <Table size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                          <p>No regression statistical findings table ready.</p>
                          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Run statistics to execute regressions.</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 4 Plot Output */}
                  {activeStep === 4 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
                      {plotUrl ? (
                        <div style={{ width: '100%' }}>
                          <div className="media-item" style={{ 
                            background: '#e0e5ec', 
                            boxShadow: 'var(--neo-shadow-raised)', 
                            border: '1px solid rgba(255,255,255,0.4)',
                            borderRadius: '12px'
                          }}>
                            <div className="media-preview-container" style={{ background: '#f5f7fa', padding: '0.5rem' }}>
                              <img 
                                src={plotUrl} 
                                alt="Manhattan Plot Results" 
                                style={{ borderRadius: '6px', maxHeight: '380px' }}
                                onClick={() => setLightboxItem({ url: plotUrl, filename: 'manhattan_plot.png' })}
                              />
                              <div className="media-item-overlay">
                                <button 
                                  className="overlay-action-btn" 
                                  onClick={() => setLightboxItem({ url: plotUrl, filename: 'manhattan_plot.png' })}
                                  title="Fullscreen view"
                                >
                                  <Maximize2 size={14} />
                                </button>
                                <a 
                                  className="overlay-action-btn" 
                                  href={plotUrl} 
                                  download="manhattan_plot.png"
                                  title="Download Plot"
                                >
                                  <Download size={14} />
                                </a>
                              </div>
                            </div>
                            <div className="media-title-bar" style={{ display: 'flex', justifyContent: 'space-between', padding: '0.65rem' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>Manhattan Plot Output</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--neo-text-muted)' }}>
                          <ImageIcon size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                          <p>No plots generated yet.</p>
                          <p style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>Execute Step 4 to plot Manhattan coefficients.</p>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              )}

            </div>

          </div>

        </div>

      </div>

      {/* Lightbox zoom modal */}
      {lightboxItem && (
        <div className="lightbox" onClick={() => setLightboxItem(null)}>
          <button className="lightbox-close" onClick={() => setLightboxItem(null)}>
            <X size={20} />
          </button>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()} style={{ background: '#f5f7fa', padding: '1rem' }}>
            <img src={lightboxItem.url} alt={lightboxItem.filename} style={{ border: 'none' }} />
          </div>
          <div className="lightbox-title" style={{ color: 'white' }}>{lightboxItem.filename}</div>
        </div>
      )}
    </div>
  );
}
