# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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
