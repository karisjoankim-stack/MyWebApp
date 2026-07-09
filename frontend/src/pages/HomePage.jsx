import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Code2, Terminal, Image as ImageIcon, Dna,
  BookOpen, History, CheckCircle, XCircle, Clock
} from 'lucide-react';

const LESSONS = [
  {
    id: "lesson_1_numpy",
    name: "1. Intro to NumPy Array Operations",
    tag: "NumPy",
    desc: "Learn to instantiate 1D and 2D arrays, perform mathematical operations, and generate high-dimensional grids for calculation.",
    code: `# Lesson 1: NumPy Basics
import numpy as np

# Create a 1D range of values
x = np.arange(1, 11)
print("1D Array:", x)

# Perform element-wise operations
x_squared = x ** 2
print("Squared Values:", x_squared)

# Create a 2D matrix
matrix = np.arange(1, 10).reshape(3, 3)
print("\\n3x3 Matrix:\\n", matrix)
print("Matrix Mean:", matrix.mean())
`
  },
  {
    id: "lesson_2_matplotlib",
    name: "2. Data Plotting with Matplotlib",
    tag: "Matplotlib",
    desc: "Generate professional math diagrams, style layout properties, add gridlines, and save the result as an output image.",
    code: `# Lesson 2: Plotting with Matplotlib
import matplotlib.pyplot as plt
import numpy as np

# Generate sample sine wave data
x = np.linspace(0, 10, 100)
y = np.sin(x)

plt.figure(figsize=(7, 4), dpi=150)
plt.plot(x, y, color='#3b82f6', linewidth=2.5, label='sin(x)')

# Customize titles and legends
plt.title("Simple Sine Wave Chart", fontsize=14, color='white', pad=10)
plt.xlabel("X-Axis Values", color='#94a3b8')
plt.ylabel("Y-Axis Values", color='#94a3b8')
plt.xticks(color='#94a3b8')
plt.yticks(color='#94a3b8')
plt.grid(True, linestyle=':', alpha=0.3)
plt.legend(facecolor='#1e293b', labelcolor='white')
plt.tight_layout()

# Save the plot (it will automatically render in the Plots tab!)
plt.savefig("sine_wave_plot.png", facecolor='#101827')
print("Plot generated successfully and saved as sine_wave_plot.png!")
`
  },
  {
    id: "lesson_3_pandas",
    name: "3. Data Analysis with Pandas",
    tag: "Pandas",
    desc: "Learn to build tabular data structure dataframes, perform grouping operations, and compute mathematical aggregate stats.",
    code: `# Lesson 3: Pandas Data Analysis
import pandas as pd

# Load mock dictionary dataset
data = {
    'Student': ['Alice', 'Bob', 'Charlie', 'David', 'Eva'],
    'Score': [85, 92, 78, 90, 88],
    'Completed_Lessons': [4, 6, 2, 5, 5]
}

df = pd.DataFrame(data)

print("--- Class Gradebook Dataframe ---")
print(df.to_string(index=False))

# Calculate summary aggregates
avg_score = df['Score'].mean()
print(f"\\nAverage Score: {avg_score:.1f}")

# Filter high-performing students
high_achievers = df[df['Score'] >= 88]
print("\\nHigh Achievers:\\n", high_achievers.to_string(index=False))
`
  }
];

const highlightPython = (codeText) => {
  if (!codeText) return '';
  const lines = codeText.split('\n').slice(0, 20);
  return lines.map((line, lineIndex) => {
    const commentIndex = line.indexOf('#');
    let codePart = line;
    let commentPart = '';
    if (commentIndex !== -1) {
      codePart = line.substring(0, commentIndex);
      commentPart = line.substring(commentIndex);
    }

    const tokenRegex = /(".*?"|'.*?'|\b(?:import|from|as|for|in|def|class|return|if|elif|else|while|try|except|with|and|or|not|pass|break|continue|yield|lambda|print|True|False|None)\b|\b\d+(?:\.\d*)?j?\b|\b[a-zA-Z_][a-zA-Z0-9_]*\b|[^a-zA-Z0-9_\s]+|\s+)/g;
    const tokens = [];
    let match;
    let iterations = 0;
    while ((match = tokenRegex.exec(codePart)) !== null && iterations < 1000) {
      iterations++;
      const val = match[0];
      if (/^(".*?"|'.*?')$/.test(val)) {
        tokens.push(<span key={tokens.length} className="code-string">{val}</span>);
      } else if (/^\b(import|from|as|for|in|def|class|return|if|elif|else|while|try|except|with|and|or|not|pass|break|continue|yield|lambda)\b$/.test(val)) {
        tokens.push(<span key={tokens.length} className="code-keyword">{val}</span>);
      } else if (/^\b(zeros_like|zeros|shape|dtype|uint8|range|numpy|PIL|Image|print|True|False|None)\b$/.test(val)) {
        tokens.push(<span key={tokens.length} className="code-cyan">{val}</span>);
      } else if (/^\b\d+(?:\.\d*)?j?\b$/.test(val)) {
        tokens.push(<span key={tokens.length} className="code-number">{val}</span>);
      } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(val)) {
        const remaining = codePart.substring(tokenRegex.lastIndex);
        if (remaining.trim().startsWith('(')) {
          tokens.push(<span key={tokens.length} className="code-cyan">{val}</span>);
        } else {
          tokens.push(val);
        }
      } else {
        tokens.push(val);
      }
    }
    if (codePart && tokens.length === 0) {
      tokens.push(codePart);
    }
    return (
      <React.Fragment key={lineIndex}>
        {tokens}
        {commentPart && <span className="code-comment">{commentPart}</span>}
        {lineIndex < lines.length - 1 && '\n'}
      </React.Fragment>
    );
  });
};

export default function HomePage() {
  const navigate = useNavigate();
  const [recentCode, setRecentCode] = useState('Loading...');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3002/api/recent-code')
      .then(res => res.json())
      .then(data => setRecentCode(data.code))
      .catch(err => setRecentCode('# Failed to load recent code'));

    fetch('http://localhost:3002/api/history')
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setLoadingHistory(false);
      })
      .catch(err => {
        console.error(err);
        setLoadingHistory(false);
      });
  }, []);

  return (
    <div className="landing-split-container">
      {/* Left Pane: Brand & Control Area */}
      <div className="left-pane animate-slide-in">
        <div 
          className="brand-header" 
          onClick={() => navigate('/')} 
          style={{ cursor: 'pointer' }}
          title="Go back to welcome page"
        >
          <div className="neomorphic-logo">
            <Code2 size={22} color="#3b82f6" />
          </div>
          <span className="brand-name">Python Runner</span>
        </div>

        <div className="hero-section">
          <h1 className="hero-title">Python Script<br />Runner Playground</h1>
          <p className="hero-subtitle">
            A clean, modern development environment for learning, executing, and visualizing Python scripts.
          </p>
        </div>

        {/* Primary Action Buttons */}
        <div className="actions-container">
          <button className="neumorphic-btn btn-primary" onClick={() => navigate('/runner')}>
            <Play size={18} /> Launch Editor
          </button>
          <button className="neumorphic-btn btn-secondary" onClick={() => navigate('/phetk')}>
            <Dna size={18} /> PheTK Analysis
          </button>
        </div>

        {/* Features list */}
        <div className="neomorphic-features">
          <div className="neomorphic-feature-card">
            <div className="feature-icon-wrapper">
              <Terminal size={18} />
            </div>
            <div className="feature-info">
              <h4 className="feature-title">Raw Execution</h4>
              <p className="feature-desc">Immediate stdout/stderr logs in a specialized developer console.</p>
            </div>
          </div>
          <div className="neomorphic-feature-card">
            <div className="feature-icon-wrapper">
              <ImageIcon size={18} />
            </div>
            <div className="feature-info">
              <h4 className="feature-title">Data Plotting</h4>
              <p className="feature-desc">Generate plots with matplotlib and save as PNG to automatically render.</p>
            </div>
          </div>
        </div>

        {/* Dashboard Grid (Lessons & History) */}
        <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '2rem', marginTop: '1rem', width: '100%' }}>
          {/* Learn Python Section */}
          <div className="section-container neomorphic-panel">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem' }}>
              <BookOpen size={18} color="#3b82f6" />
              <span className="section-title" style={{ fontSize: '1rem', fontWeight: '700' }}>Learn Python Interactive</span>
            </div>
            <div className="section-subtitle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Select a topic below to load its exercise and write code in the playground editor.</div>
            <div className="scroll-container">
              {LESSONS.map((lesson) => (
                <div 
                  key={lesson.id} 
                  className="lesson-card neomorphic-item-button"
                  style={{ padding: '0.9rem', marginBottom: '0.75rem' }}
                  onClick={() => navigate('/runner', { state: { code: lesson.code } })}
                >
                  <div className="lesson-title-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <span className="lesson-name" style={{ fontSize: '0.85rem', fontWeight: '600' }}>{lesson.name}</span>
                    <span className="lesson-tag" style={{ fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>{lesson.tag}</span>
                  </div>
                  <div className="lesson-desc" style={{ fontSize: '0.75rem', lineHeight: '1.3' }}>{lesson.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Execution History Section */}
          <div className="section-container neomorphic-panel">
            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', paddingBottom: '0.5rem' }}>
              <History size={18} color="#10b981" />
              <span className="section-title" style={{ fontSize: '1rem', fontWeight: '700' }}>Execution History</span>
            </div>
            <div className="section-subtitle" style={{ fontSize: '0.75rem', marginBottom: '1rem' }}>Review or reload your most recent execution runs and their performance.</div>
            <div className="scroll-container">
              {loadingHistory ? (
                <div style={{ fontSize: '0.8rem', padding: '1rem 0' }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ fontSize: '0.8rem', padding: '1rem 0', textAlign: 'center' }}>
                  No recent runs found. Try launching the editor and running code!
                </div>
              ) : (
                history.map((run) => {
                  const dateStr = new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const isSuccess = run.exitCode === 0;
                  return (
                    <div 
                      key={run.runId} 
                      className="history-item neomorphic-item-button"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0.9rem', marginBottom: '0.6rem', minWidth: 0, width: '100%' }}
                      onClick={() => navigate('/runner', { state: { code: run.code } })}
                      title="Click to reload this script in the editor"
                    >
                      <div className="history-item-left" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0, flex: 1 }}>
                        <div className="status-icon-wrapper">
                          {isSuccess ? (
                            <CheckCircle size={14} color="#10b981" />
                          ) : (
                            <XCircle size={14} color="#ef4444" />
                          )}
                        </div>
                        <span className="history-code-preview" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'var(--font-mono)', minWidth: 0, flex: 1 }}>
                          {run.code.trim().split('\n')[0] || 'untitled.py'}
                        </span>
                      </div>
                      <div className="history-item-right" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--neo-text-muted)' }}>
                        <Clock size={11} />
                        <span>{run.executionTimeMs}ms</span>
                        <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>{dateStr}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane: Code Canvas & Ambient Glow */}
      <div className="right-pane">
        {/* Rotating Mesh Glow */}
        <div className="mesh-gradient-glow"></div>

        {/* Neumorphic Preview Canvas Card */}
        <div className="neomorphic-canvas animate-fade-in">
          <div className="code-preview-card">
            <div className="code-preview-header">
              <div className="dots">
                <span className="dot dot-red"></span>
                <span className="dot dot-yellow"></span>
                <span className="dot dot-green"></span>
              </div>
              <span className="preview-title">preview</span>
            </div>
            <div className="code-preview-body">
              <pre style={{ margin: 0, padding: 0, background: 'transparent', color: '#e2e8f0', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', fontSize: '0.825rem', lineHeight: '1.6' }}>
                <code>{highlightPython(recentCode)}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
