# ACQUISIGHT

> **Intelligent Land Acquisition Risk Prediction & Geospatial Governance Platform**  
> *Developed for Smart India Hackathon (SIH) & Revenue Administration Innovation*

ACQUISIGHT is an end-to-end operational decision-support system designed to preempt litigation delays, ensure statutory timeline compliance under RFCTLARR 2013, and provide revenue officers with explainable AI risk assessments and live GIS satellite overlays.

---

## 🌟 Key Features

- **🗺️ Interactive GIS & Geospatial Intelligence**:
  - Dual base map engine: OpenStreetMap vector street layout + Esri World Imagery high-res satellite.
  - Live revenue survey boundary polygons, parcel pins, and risk-tier choropleth (Green: Low, Yellow: Moderate, Red: Critical).
  - Spatial filtering by Taluk, Village, Land Classification, and Survey Number.
- **🤖 Predictive ML & Delay Estimation**:
  - Continuous regression pipeline forecasting project delay in days.
  - Multi-class classification pipeline categorizing risk into Low, Medium, High, and Critical.
  - Safe automated retraining worker with performance evaluation and rollback guards.
- **📊 Explainable AI (SHAP)**:
  - Transparent feature importance breakdowns identifying top drivers of acquisition delays (court disputes, compensation awards, multiple owners).
  - Prescriptive mitigation checklists for revenue officers.
- **⚡ Modern Responsive UI**:
  - Built with React 18, Vite, Tailwind CSS, Lucide icons, and Recharts.
  - Dark mode and light mode support with fluid micro-animations.
- **🔐 Enterprise Security**:
  - Firebase Authentication with role-based access control (RBAC).

---

## 🏗️ Architecture

```
ACQUISIGHT/
├── api/                  # FastAPI Python backend services
│   ├── auth.py           # Officer authentication & RBAC
│   ├── chat_service.py   # AI Copilot grounded on land records
│   ├── explainability.py # SHAP & feature importance engine
│   ├── main.py           # REST endpoints & middleware
│   ├── repository.py     # Case persistence & database abstraction
│   └── retrain_service.py# Safe ML retraining pipeline
├── data/                 # Cleaned land acquisition datasets & GIS parcels
├── frontend/             # React 18 + Vite + Tailwind frontend application
├── models/               # Pre-trained Scikit-Learn pipelines & metadata
├── src/                  # Data preparation & model training scripts
├── ACQUISIGHT_Presentation.html  # Interactive presentation deck (Browser/PDF)
├── ACQUISIGHT_SIH_Pitch_Deck.pptx# Official 16:9 widescreen PowerPoint deck
├── generate_pitch_deck.py        # Presentation generator automation
├── Procfile              # Cloud process definition (Render/Railway)
├── render.yaml           # 1-click Render blueprint specification
└── requirements.txt      # Python dependencies
```

---

## 🚀 Quick Start (Local Development)

### 1. Start the Backend API

```powershell
# Activate your virtual environment (if using .venv)
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the FastAPI server
uvicorn api.main:app --reload --port 8000
```
- API Docs: `http://localhost:8000/docs`

### 2. Start the Frontend Application

```powershell
cd frontend
npm install
npm run dev
```
- Open `http://localhost:5173` in your browser.

---

## 🌐 Deployment Guide

### Deploying the Frontend (Vercel)
1. Import the repository into [Vercel](https://vercel.com).
2. Set **Root Directory** to `frontend`.
3. Set **Framework** to `Vite`.
4. Deploy (the included `vercel.json` ensures full SPA routing support).

### Deploying the Backend (Render / Railway)
1. Create a new Web Service on [Render](https://render.com).
2. Connect your repository.
3. Build Command: `pip install -r requirements.txt`
4. Start Command: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`

---

## 📽️ Presentations

- **PowerPoint**: Open [`ACQUISIGHT_SIH_Pitch_Deck.pptx`](./ACQUISIGHT_SIH_Pitch_Deck.pptx) in Microsoft PowerPoint.
- **Web Pitch Deck**: Open [`ACQUISIGHT_Presentation.html`](./ACQUISIGHT_Presentation.html) in any web browser (`◀`/`▶` to navigate, `F` for fullscreen, or print to PDF).
