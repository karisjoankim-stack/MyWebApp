# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.3.0] - 2026-07-03

### Added
- **Step-by-Step Modular Pipeline UI**: Completely refactored the PheTK analysis workspace into a 4-step wizard (Data & Config, Mapping, Statistics, Visualization).
- **Python Execution CLI (`phetk_pipeline.py`)**: Designed a decoupled modular CLI script running individual tasks (ICD-to-Phecode translation, statistical regression, Manhattan plotting) with single-line JSON summary outputs.
- **Dynamic Configuration Dropdowns**: Added auto-detection and custom mapping selections for patient identifiers, ICD code columns, vocabulary IDs, date columns, genotype variables of interest, and sex covariates.
- **Sortable & Paginated Results Table**: Added a neomorphic-themed interactive table to inspect statistical findings on the fly.
- **Run Directory Pruning (Cleanup)**: Added a "Delete Run" feature to clean up files under `backend/runs/<runId>` recursively from local disks.

### Fixed
- **Large Dataset Payload Limit**: Increased Express JSON body parser and URL-encoded limits to **50MB** to allow uploading large sample files (like 10% Kaggle EHR data) without triggering HTTP `413` errors.
- **Sex Variable Naming Mismatch**: Fixed statistical regression KeyErrors caused by case discrepancies when aligning sex variables during regression fitting.

## [0.2.1] - 2026-06-23

### Security
- Restricted CORS configuration in Express server to only allow the frontend origin to prevent cross-site remote code execution.
- Added a 10-second script execution timeout for running Python code to prevent infinite loop resource exhaustion.
- Configured backend Docker container to run as a non-privileged `appuser` system user.

### Fixed
- Mocked Python's standard `input()` prompts in the PheTK "Built-in Demo" to run non-interactively, resolving execution hangs and timeouts.

## [0.2.0] - 2026-06-23

### Added
- **Neomorphic UI Redesign**: Restructured the landing page into a clean split-pane design using soft Neomorphic extruded/sunken cards, pill buttons, and a rotating desaturated mesh gradient backdrop glow.
- **PheTK Interactive Workspace**: Added a dedicated `/phetk` workspace route pre-configured with genetic association analysis, simulated studies, and custom Manhattan plots.
- **Dockerized Dependencies**: Integrated `phetk` and `statsmodels` inside the containerized backend environment.
- **Environment Package Checking**: Added support for monitoring `phetk` and `statsmodels` libraries in the sidebar package status panel.

## [0.1.0] - 2026-06-15

### Added
- **Monaco Code Editor**: Fully integrated code editor in the React UI with syntax highlighting.
- **Python Execution Sandbox**: Backend Node/Express API to safely execute Python scripts locally and capture exit code, runtime, stdout, and stderr.
- **Auto-Media Capturing**: Script output directory scanning to extract and serve dynamically generated media files (e.g., matplotlib figures or PIL images).
- **Environment Package Auditor**: Real-time checking of installed Python dependencies (`numpy`, `pandas`, `matplotlib`, `pillow`, `scipy`, `scikit-learn`, `requests`) in the runtime environment.
- **Run History**: Storage and loading of recent runs, including script execution code history.
- **Docker Compose Orchestration**: Containerized services for simple development setup (`backend` and `frontend` service orchestrations).
