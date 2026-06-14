const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const RUNS_DIR = path.join(__dirname, 'runs');

// Ensure runs directory exists
fs.mkdir(RUNS_DIR, { recursive: true }).catch(console.error);

// Serve static files (generated media)
app.use('/api/results', express.static(RUNS_DIR));

app.post('/api/run', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  const runId = crypto.randomUUID();
  const runDir = path.join(RUNS_DIR, runId);

  try {
    // Create execution directory
    await fs.mkdir(runDir, { recursive: true });

    // Write python script
    const scriptPath = path.join(runDir, 'main.py');
    await fs.writeFile(scriptPath, code);

    // Execute script
    const startTime = process.hrtime();
    exec('python3 main.py', { cwd: runDir }, async (error, stdout, stderr) => {
      const diff = process.hrtime(startTime);
      const executionTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);
      const exitCode = error ? error.code : 0;

      // Save metadata
      try {
        await fs.writeFile(path.join(runDir, 'meta.json'), JSON.stringify({
          timestamp: Date.now(),
          exitCode,
          executionTimeMs
        }));
      } catch (metaErr) {
        console.error('Failed to write meta.json:', metaErr);
      }

      try {
        // Read directory to find generated media files
        const files = await fs.readdir(runDir);
        
        // Filter out the script, meta file, and python cache
        const mediaFiles = files.filter(f => f !== 'main.py' && f !== 'meta.json' && !f.endsWith('.pyc') && f !== '__pycache__');
        
        // Construct URLs for media files
        const mediaUrls = mediaFiles.map(filename => ({
          filename,
          url: `/api/results/${runId}/${filename}`,
          type: filename.endsWith('.mp4') ? 'video' : (filename.endsWith('.png') || filename.endsWith('.jpg') ? 'image' : 'other')
        }));

        res.json({
          runId,
          stdout,
          stderr,
          mediaFiles: mediaUrls,
          exitCode,
          executionTimeMs
        });

        // Clean up old runs to protect storage
        pruneOldRuns().catch(console.error);
      } catch (err) {
        console.error('Error reading run directory:', err);
        res.status(500).json({ error: 'Failed to read execution results' });
      }
    });
  } catch (err) {
    console.error('Execution setup error:', err);
    res.status(500).json({ error: 'Execution setup failed' });
  }
});

app.get('/api/packages', async (req, res) => {
  const packages = ['numpy', 'pandas', 'matplotlib', 'PIL', 'scipy', 'sklearn', 'requests'];
  const status = {};
  
  const checkPackage = (pkg) => {
    return new Promise((resolve) => {
      exec(`python3 -c "import ${pkg}"`, (error) => {
        resolve({ name: pkg, installed: !error });
      });
    });
  };

  try {
    const results = await Promise.all(packages.map(checkPackage));
    results.forEach(r => {
      const displayName = r.name === 'PIL' ? 'pillow' : (r.name === 'sklearn' ? 'scikit-learn' : r.name);
      status[displayName] = r.installed;
    });
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: 'Failed to check package status' });
  }
});

const pruneOldRuns = async () => {
  try {
    const runs = await fs.readdir(RUNS_DIR);
    if (runs.length <= 15) return;

    const runStats = await Promise.all(runs.map(async (runId) => {
      const p = path.join(RUNS_DIR, runId);
      const stat = await fs.stat(p);
      return { runId, mtime: stat.mtimeMs, path: p };
    }));

    // Sort oldest first
    runStats.sort((a, b) => a.mtime - b.mtime);

    // Prune down to 15
    const deleteCount = runs.length - 15;
    const toDelete = runStats.slice(0, deleteCount);

    for (const run of toDelete) {
      await fs.rm(run.path, { recursive: true, force: true });
    }
    console.log(`Pruned ${deleteCount} old run directories.`);
  } catch (err) {
    console.error('Error pruning old runs:', err);
  }
};

app.get('/api/history', async (req, res) => {
  try {
    const runs = await fs.readdir(RUNS_DIR);
    const history = [];

    for (const runId of runs) {
      const runDir = path.join(RUNS_DIR, runId);
      try {
        const mainPyPath = path.join(runDir, 'main.py');
        const metaPath = path.join(runDir, 'meta.json');

        const code = await fs.readFile(mainPyPath, 'utf8');
        let meta = { timestamp: Date.now(), exitCode: 0, executionTimeMs: 0 };
        try {
          const metaContent = await fs.readFile(metaPath, 'utf8');
          meta = JSON.parse(metaContent);
        } catch (_) {
          const stat = await fs.stat(runDir);
          meta.timestamp = stat.mtimeMs;
        }

        history.push({
          runId,
          code,
          timestamp: meta.timestamp,
          exitCode: meta.exitCode,
          executionTimeMs: meta.executionTimeMs
        });
      } catch (err) {
        // Skip runs that have missing files or errors
      }
    }

    // Sort newest first
    history.sort((a, b) => b.timestamp - a.timestamp);
    res.json(history);
  } catch (err) {
    console.error('Error fetching history:', err);
    res.status(500).json({ error: 'Failed to fetch execution history' });
  }
});

app.get('/api/recent-code', async (req, res) => {
  try {
    const runs = await fs.readdir(RUNS_DIR);
    if (runs.length === 0) {
      return res.json({ code: '# No recent runs found.\nprint("Hello World!")' });
    }
    
    // Find the most recent run directory based on modified time
    const runStats = await Promise.all(runs.map(async (runId) => {
      const p = path.join(RUNS_DIR, runId);
      const stat = await fs.stat(p);
      return { runId, mtime: stat.mtimeMs };
    }));
    
    runStats.sort((a, b) => b.mtime - a.mtime);
    const mostRecentRunId = runStats[0].runId;
    
    // Read the main.py from the most recent run
    const code = await fs.readFile(path.join(RUNS_DIR, mostRecentRunId, 'main.py'), 'utf8');
    res.json({ code });
  } catch (err) {
    console.error('Error fetching recent code:', err);
    res.status(500).json({ error: 'Failed to fetch recent code' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
