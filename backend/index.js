const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const ALLOWED_ORIGIN = process.env.FRONTEND_URL || 'http://localhost:5180';
app.use(cors({
  origin: ALLOWED_ORIGIN
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

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

    // Execute script with a 10-second timeout to prevent infinite loops
    const startTime = process.hrtime();
    exec('python3 main.py', { 
      cwd: runDir,
      timeout: 10000, // 10 seconds limit
      killSignal: 'SIGTERM'
    }, async (error, stdout, stderr) => {
      const diff = process.hrtime(startTime);
      const executionTimeMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

      // Append custom error message if execution was killed by a timeout
      let customStderr = stderr;
      if (error && error.signal === 'SIGTERM') {
        customStderr += '\n[Execution Error: Script exceeded the 10-second timeout limit and was terminated.]';
      }
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
          stderr: customStderr,
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
  const packages = ['numpy', 'pandas', 'matplotlib', 'PIL', 'scipy', 'sklearn', 'requests', 'phetk', 'statsmodels'];
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

// --- PheTK Pipeline API Endpoints ---

// Run helper
const runPipelineStep = (argsList) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'phetk_pipeline.py');
    const cmd = `python3 "${scriptPath}" ${argsList.join(' ')}`;
    exec(cmd, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error(`Script error for cmd [${cmd}]:`, stderr);
        try {
          const jsonOut = JSON.parse(stdout.trim());
          if (jsonOut && jsonOut.status === 'error') {
            return reject(new Error(jsonOut.message));
          }
        } catch (_) {}
        return reject(new Error(stderr || error.message));
      }
      try {
        const lines = stdout.trim().split('\n');
        const lastLine = lines[lines.length - 1];
        const result = JSON.parse(lastLine);
        if (result.status === 'error') {
          return reject(new Error(result.message));
        }
        resolve(result);
      } catch (parseErr) {
        reject(new Error(`Failed to parse Python script output: ${stdout}`));
      }
    });
  });
};

const detectDelimiter = (content) => {
  const firstLine = content.split('\n')[0] || '';
  if (firstLine.includes('\t')) return '\t';
  if (firstLine.includes(';')) return ';';
  return ',';
};

const getHeaders = (content) => {
  const firstLine = (content.split('\n')[0] || '').trim();
  if (!firstLine) return [];
  const sep = detectDelimiter(firstLine);
  return firstLine.split(sep).map(h => h.replace(/['"\r]/g, '').trim());
};

// Initialize Run
app.post('/api/phetk/pipeline/initialize', async (req, res) => {
  const runId = crypto.randomUUID();
  const runDir = path.join(RUNS_DIR, runId);
  try {
    await fs.mkdir(runDir, { recursive: true });
    const runInfo = {
      runId,
      status: 'initialized',
      created_at: Date.now(),
      config: {}
    };
    await fs.writeFile(path.join(runDir, 'run_info.json'), JSON.stringify(runInfo, null, 2));
    res.json({ runId });
  } catch (err) {
    console.error('Failed to initialize pipeline run:', err);
    res.status(500).json({ error: 'Failed to initialize pipeline run' });
  }
});

// Upload files and return headers
app.post('/api/phetk/pipeline/upload', async (req, res) => {
  const { runId, phenotypeContent, phenotypeName, genotypeContent, genotypeName } = req.body;
  if (!runId) return res.status(400).json({ error: 'No runId provided' });
  
  const runDir = path.join(RUNS_DIR, runId);
  try {
    const runInfoPath = path.join(runDir, 'run_info.json');
    let runInfo = {};
    try {
      runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    } catch (_) {
      runInfo = { runId, created_at: Date.now() };
    }

    let phenotypeHeaders = [];
    let genotypeHeaders = [];

    if (phenotypeContent) {
      const ext = phenotypeName && phenotypeName.endsWith('.tsv') ? '.tsv' : '.csv';
      const filepath = path.join(runDir, `phenotype${ext}`);
      await fs.writeFile(filepath, phenotypeContent);
      phenotypeHeaders = getHeaders(phenotypeContent);
      runInfo.phenotypeName = phenotypeName;
    }

    if (genotypeContent) {
      const ext = genotypeName && genotypeName.endsWith('.tsv') ? '.tsv' : '.csv';
      const filepath = path.join(runDir, `genotype${ext}`);
      await fs.writeFile(filepath, genotypeContent);
      genotypeHeaders = getHeaders(genotypeContent);
      runInfo.genotypeName = genotypeName;
    }

    runInfo.status = 'uploaded';
    await fs.writeFile(runInfoPath, JSON.stringify(runInfo, null, 2));

    res.json({
      runId,
      phenotypeHeaders,
      genotypeHeaders
    });
  } catch (err) {
    console.error('Failed to upload files:', err);
    res.status(500).json({ error: 'Failed to save files and parse headers' });
  }
});

// Save configuration
app.post('/api/phetk/pipeline/configure', async (req, res) => {
  const { runId, config } = req.body;
  if (!runId || !config) return res.status(400).json({ error: 'runId and config are required' });

  const runDir = path.join(RUNS_DIR, runId);
  const runInfoPath = path.join(runDir, 'run_info.json');
  try {
    const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    runInfo.config = config;
    runInfo.status = 'configured';
    await fs.writeFile(runInfoPath, JSON.stringify(runInfo, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to save config:', err);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Run Step 2 (Mapping)
app.post('/api/phetk/pipeline/step2-map', async (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId is required' });

  const runDir = path.join(RUNS_DIR, runId);
  const runInfoPath = path.join(runDir, 'run_info.json');
  
  try {
    const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    const config = runInfo.config || {};
    
    const startTime = Date.now();
    const args = [
      '--step', 'map',
      '--run-dir', `"${runDir}"`,
      '--phecode-version', `"${config.phecode_version || 'X'}"`,
      '--icd-version', `"${config.icd_version || 'US'}"`,
      '--id-col', `"${config.id_col || 'person_id'}"`,
      '--icd-col', `"${config.icd_col || 'ICD'}"`,
      '--vocab-col', `"${config.vocab_col || 'vocabulary_id'}"`,
      '--date-col', `"${config.date_col || 'date'}"`
    ];

    const result = await runPipelineStep(args);
    
    runInfo.status = 'mapped';
    runInfo.step2_time = Date.now() - startTime;
    runInfo.mapping_summary = result;
    await fs.writeFile(runInfoPath, JSON.stringify(runInfo, null, 2));
    
    res.json({
      success: true,
      timeMs: runInfo.step2_time,
      summary: result
    });
  } catch (err) {
    console.error('Step 2 Map error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run Step 3 (Statistics)
app.post('/api/phetk/pipeline/step3-stats', async (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId is required' });

  const runDir = path.join(RUNS_DIR, runId);
  const runInfoPath = path.join(runDir, 'run_info.json');

  try {
    const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    const config = runInfo.config || {};

    const startTime = Date.now();
    const args = [
      '--step', 'stats',
      '--run-dir', `"${runDir}"`,
      '--phecode-version', `"${config.phecode_version || 'X'}"`,
      '--icd-version', `"${config.icd_version || 'US'}"`,
      '--cohort-id-col', `"${config.cohort_id_col || 'person_id'}"`,
      '--independent-var', `"${config.independent_var}"`,
      '--covariates', `"${(config.covariates || []).join(',')}"`,
      '--sex-col', `"${config.sex_col || 'sex'}"`,
      '--male-as-one', `"${config.male_as_one !== undefined ? config.male_as_one : 'true'}"`,
      '--min-cases', `"${config.min_cases || 5}"`,
      '--min-phecode-count', `"${config.min_phecode_count || 2}"`
    ];

    const result = await runPipelineStep(args);

    runInfo.status = result.status === 'success' ? 'analyzed' : 'no_results';
    runInfo.step3_time = Date.now() - startTime;
    runInfo.stats_summary = {
      tested_count: result.tested_count || 0,
      above_bonferroni: result.above_bonferroni || 0,
      status: result.status,
      message: result.message
    };
    await fs.writeFile(runInfoPath, JSON.stringify(runInfo, null, 2));

    res.json({
      success: true,
      timeMs: runInfo.step3_time,
      summary: result
    });
  } catch (err) {
    console.error('Step 3 Stats error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Run Step 4 (Visualization)
app.post('/api/phetk/pipeline/step4-visualize', async (req, res) => {
  const { runId } = req.body;
  if (!runId) return res.status(400).json({ error: 'runId is required' });

  const runDir = path.join(RUNS_DIR, runId);
  const runInfoPath = path.join(runDir, 'run_info.json');

  try {
    const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    const config = runInfo.config || {};

    const startTime = Date.now();
    const args = [
      '--step', 'plot',
      '--run-dir', `"${runDir}"`,
      '--phecode-version', `"${config.phecode_version || 'X'}"`
    ];

    const result = await runPipelineStep(args);

    runInfo.status = result.status === 'success' ? 'completed' : 'no_results';
    runInfo.step4_time = Date.now() - startTime;
    await fs.writeFile(runInfoPath, JSON.stringify(runInfo, null, 2));

    res.json({
      success: true,
      timeMs: runInfo.step4_time,
      plotUrl: `/api/phetk/pipeline/download/${runId}/manhattan_plot.png`
    });
  } catch (err) {
    console.error('Step 4 Plot error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serves downloads for pipeline run outputs safely
app.get('/api/phetk/pipeline/download/:runId/:fileName', async (req, res) => {
  const { runId, fileName } = req.params;
  
  // Prevent directory traversal attacks
  const allowedFiles = [
    'phenotype.csv', 'phenotype.tsv',
    'genotype.csv', 'genotype.tsv',
    'standardized_phenotype.csv', 'standardized_genotype.csv',
    'phecode_counts.tsv', 'results.tsv', 'manhattan_plot.png'
  ];
  if (!allowedFiles.includes(fileName)) {
    return res.status(403).json({ error: 'Access denied to requested file.' });
  }

  const filePath = path.join(RUNS_DIR, runId, fileName);
  try {
    await fs.access(filePath);
    res.download(filePath, fileName);
  } catch (_) {
    res.status(404).json({ error: 'File not found.' });
  }
});

// Retrieve pipeline results (metadata, stats summary, findings)
app.get('/api/phetk/pipeline/results/:runId', async (req, res) => {
  const { runId } = req.params;
  const runDir = path.join(RUNS_DIR, runId);
  const runInfoPath = path.join(runDir, 'run_info.json');

  try {
    const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
    
    // Read results.tsv if present
    const resultsPath = path.join(runDir, 'results.tsv');
    let topFindings = [];
    try {
      await fs.access(resultsPath);
      const content = await fs.readFile(resultsPath, 'utf8');
      const lines = content.trim().split('\n');
      if (lines.length > 1) {
        const headers = lines[0].split('\t').map(h => h.trim());
        const dataRows = lines.slice(1).map(line => {
          const cells = line.split('\t');
          const rowObj = {};
          headers.forEach((h, idx) => {
            let val = cells[idx] !== undefined ? cells[idx].trim() : '';
            // Parse floats/ints where appropriate
            if (val !== '' && !isNaN(val)) {
              val = Number(val);
            }
            rowObj[h] = val;
          });
          return rowObj;
        });
        
        // Sort findings by p_value
        dataRows.sort((a, b) => (a.p_value || 1) - (b.p_value || 1));
        topFindings = dataRows.slice(0, 100);
      }
    } catch (_) {}

    res.json({
      runInfo,
      topFindings
    });
  } catch (err) {
    console.error('Failed to get pipeline results:', err);
    res.status(500).json({ error: 'Failed to load pipeline results' });
  }
});

// Retrieve pipeline run history
app.get('/api/phetk/pipeline/history', async (req, res) => {
  try {
    const runs = await fs.readdir(RUNS_DIR);
    const history = [];

    for (const runId of runs) {
      const runInfoPath = path.join(RUNS_DIR, runId, 'run_info.json');
      try {
        const runInfo = JSON.parse(await fs.readFile(runInfoPath, 'utf8'));
        history.push(runInfo);
      } catch (_) {
        // Skip runs that are not pipeline runs (e.g. general Python runner directories)
      }
    }

    // Sort newest first
    history.sort((a, b) => b.created_at - a.created_at);
    res.json(history);
  } catch (err) {
    console.error('Error fetching pipeline history:', err);
    res.status(500).json({ error: 'Failed to fetch pipeline history' });
  }
});

// Delete specific run folder from disk
app.delete('/api/phetk/pipeline/run/:runId', async (req, res) => {
  const { runId } = req.params;
  const runDir = path.join(RUNS_DIR, runId);
  try {
    await fs.rm(runDir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting run directory:', err);
    res.status(500).json({ error: 'Failed to delete execution folder' });
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
