import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Play, Code2, Terminal, Image as ImageIcon, Video, ArrowRight,
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
  const lines = codeText.split('\n');
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

export default function LandingPage() {
  const navigate = useNavigate();
  const [recentCode, setRecentCode] = useState('Loading...');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    fetch('http://localhost:3001/api/recent-code')
      .then(res => res.json())
      .then(data => setRecentCode(data.code))
      .catch(err => setRecentCode('# Failed to load recent code'));

    fetch('http://localhost:3001/api/history')
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
    <div className="landing-container">
      <div className="landing-content animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <div className="feature-icon-wrapper" style={{ width: '56px', height: '56px', borderRadius: '12px' }}>
            <Code2 size={32} />
          </div>
        </div>
        <h1 className="hero-title">Python Script<br />Runner Playground</h1>
        <p className="hero-subtitle">
          Active Python development environment.
        </p>

        {/* Floating Code Preview Card */}
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
            <pre style={{ margin: 0, padding: 0, background: 'transparent', color: '#e2e8f0', fontFamily: 'var(--font-mono)', whiteSpace: 'pre-wrap', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <code>{highlightPython(recentCode)}</code>
            </pre>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.25rem', justifyContent: 'center', marginTop: '2rem' }}>
          <button className="btn btn-primary" onClick={() => navigate('/runner')}>
            <Play size={18} /> Launch Editor <ArrowRight size={16} />
          </button>
        </div>

        {/* Features Grid */}
        <div className="features-section">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Terminal size={20} />
            </div>
            <h3 className="feature-title">Raw execution</h3>
            <p className="feature-desc">See immediate stdout and stderr logs in a specialized high-contrast developer console.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <ImageIcon size={20} />
            </div>
            <h3 className="feature-title">Data Plotting</h3>
            <p className="feature-desc">Generate plots with matplotlib and save as PNG. They automatically render in the Plots tab.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <Video size={20} />
            </div>
            <h3 className="feature-title">MP4 Animations</h3>
            <p className="feature-desc">Generate videos and play them back dynamically inside the high-performance media wrapper.</p>
          </div>
        </div>

        {/* Dashboard and Learn Sections */}
        <div className="dashboard-grid">
          {/* Left Column: Learn Python */}
          <div className="section-container">
            <div className="section-header">
              <BookOpen size={20} color="var(--accent)" />
              <span className="section-title">Learn Python Interactive</span>
            </div>
            <div className="section-subtitle">Select a topic below to load its exercise and write code in the playground editor.</div>
            <div className="scroll-container">
              {LESSONS.map((lesson) => (
                <div 
                  key={lesson.id} 
                  className="lesson-card"
                  onClick={() => navigate('/runner', { state: { code: lesson.code } })}
                >
                  <div className="lesson-title-bar">
                    <span className="lesson-name">{lesson.name}</span>
                    <span className="lesson-tag">{lesson.tag}</span>
                  </div>
                  <div className="lesson-desc">{lesson.desc}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: Run History Dashboard */}
          <div className="section-container">
            <div className="section-header">
              <History size={20} color="var(--primary)" />
              <span className="section-title">Your Execution History</span>
            </div>
            <div className="section-subtitle">Quickly reload or review your most recent execution runs and their performance.</div>
            <div className="scroll-container">
              {loadingHistory ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0' }}>Loading history...</div>
              ) : history.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem 0', textAlign: 'center' }}>
                  No recent runs found. Try launching the editor and running code!
                </div>
              ) : (
                history.map((run) => {
                  const dateStr = new Date(run.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isSuccess = run.exitCode === 0;
                  return (
                    <div 
                      key={run.runId} 
                      className="history-item"
                      onClick={() => navigate('/runner', { state: { code: run.code } })}
                      title="Click to reload this script in the editor"
                    >
                      <div className="history-item-left">
                        <div className="status-icon-wrapper">
                          {isSuccess ? (
                            <CheckCircle size={15} color="var(--success)" />
                          ) : (
                            <XCircle size={15} color="var(--error)" />
                          )}
                        </div>
                        <div className="history-meta">
                          <span className="history-code-preview">
                            {run.code.trim().split('\n')[0] || 'untitled.py'}
                          </span>
                          <span className="history-time-info">{dateStr}</span>
                        </div>
                      </div>
                      <div className="history-item-right">
                        <Clock size={12} />
                        <span>{run.executionTimeMs}ms</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
