# PackWise — AI-Powered Sustainable Food Packaging Decision Engine

PackWise is an intelligent decision-support system designed to determine the optimal packaging solution for any food product under given storage, transport, and commercial constraints. 

By combining **Machine Learning pattern inference** with **closed-form mass-transfer physics**, PackWise evaluates deterioration risks, calculates exact oxygen/moisture barrier targets, and recommends the most cost-effective and sustainable packaging materials.

---

## 🌟 Why PackWise Standout? (Key Differentiators)

Most packaging tools rely on generic static lookup tables or simplified rules. PackWise sets a new benchmark through four core innovations:

### 1. Grounded in Official Indian Government Datasets
Instead of relying on synthetic assumptions or western food profiles, PackWise integrates official scientific datasets directly into its ML training pipeline:
* **ICMR - National Institute of Nutrition (IFCT 2017):** Features exact chemical profiles (moisture %, fat %, pH, water activity) for over 520 Indian food items.
* **ICAR - CIPHET (Central Institute of Post-Harvest Engineering & Technology):** Provides post-harvest respiration rates, chilling injury thresholds, and storage lifespans tailored for tropical agricultural produce.
* **FSSAI Packaging Regulations (2018):** Enforces legal food-contact material compliance and migration limits.
* **Open Government Data (data.gov.in / Agmarknet):** Informs Indian cold chain temperature baselines and ambient transport parameters.

### 2. Hybrid AI Engine (ML + Physics Safety Net)
PackWise features a dual-engine architecture:
* **Data-Driven ML Recommender:** A multi-output pipeline (`RandomForestClassifier` + `GradientBoostingRegressor`) trained on chemical and environmental parameters to instantly predict optimal packaging structures.
* **Rule- & Physics-Based Engine:** A fallback mass-transfer engine solving backward differential equations for Oxygen Transmission Rate (OTR) and Water Vapor Transmission Rate (WVTR) to guarantee scientific validity.

### 3. Automated One-Time Startup Training
No complex MLOps setup required. When the FastAPI backend boots up, it checks for a trained model binary. If missing, it automatically trains the model on the local ICMR-NIN dataset **once** during startup via FastAPI lifespan hooks and caches it for instant zero-latency inference.

### 4. End-to-End Decision Transparency
PackWise does not act as a black box. Every recommendation includes:
* Plain-language failure mode explanations;
* Environmental footprint calculations (g CO₂e and recyclability rating);
* Comparative analysis of ruled-out candidates and trade-offs.

---

## 🏗️ System Architecture
```
                   ┌──────────────────────────────────┐
                   │    React 19 Frontend (Vite)      │
                   └─────────────────┬────────────────┘
                                     │ REST API
                                     ▼
                   ┌──────────────────────────────────┐
                   │       FastAPI Backend API        │
                   └─────────────────┬────────────────┘
                                     │
               ┌─────────────────────┴─────────────────────────┐
               ▼                                               ▼
┌─────────────────────────────┐                 ┌─────────────────────────────┐
│   ML Engine (scikit-learn)  │                 │   Physics & Rules Engine    │
│  • ICMR-NIN Feature Vector  │                 │  • Mass-transfer models     │
│  • Random Forest Predictor  │                 │  • OTR / WVTR Solvers       │
│  • Gradient Boosting Reg.   │                 │  • Gatekeeper Rules         │
└──────────────┬──────────────┘                 └──────────────┬──────────────┘
               │                                               │
               └───────────────────────┬───────────────────────┘
                                       │
                                       ▼
                    ┌──────────────────────────────────┐
                    │  SQLite / SQLAlchemy Storage     │
                    └──────────────────────────────────┘
```

---

## 📂 Project Structure
```
.
├── backend/
│   ├── app/
│   │   ├── api/          # Consolidated API routes & Pydantic schemas
│   │   ├── core/         # DB connection, settings, & error handlers
│   │   ├── data/         # ICMR-NIN, CIPHET, FSSAI, & knowledge seed files
│   │   ├── engine/       # ML models, physics calculations, & pipeline
│   │   ├── services/     # PDF generation & database seeding
│   │   └── main.py       # Application setup & startup lifespan handler
│   ├── artifacts/        # Saved ML model binaries (.joblib)
│   ├── requirements.txt  # Python dependencies
│   └── packwise.db       # SQLite database
├── src/                  # React Frontend (Components, Views, Styles)
├── SPEC.md               # Detailed system specification
└── README.md
```
---

## 🚀 Getting Started

### Prerequisites
* **Node.js** v18+ and `npm`
* **Python** 3.10+

---

### 1. Backend Setup

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/macOS:
source venv/bin/activate
# On Windows:
venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env  # Ensure ML_ENABLED=true
Ensure your downloaded dataset (icmr_nin_ifct2017.csv) is placed inside backend/app/data/.

# Start the FastAPI backend server
uvicorn app.main:app --reload
Note: On first startup, the backend will automatically train the ML model on the ICMR-NIN dataset and save the trained model to backend/artifacts/packaging_recommender.joblib.
```
### 2. Frontend Setup
```Bash
# Open a new terminal and navigate to root directory
npm install

# Start Vite development server
npm run dev
Open http://localhost:5173 in your browser.

⚙️ Environment Variables (backend/.env)
Code snippet
DATABASE_URL=sqlite:///./packwise.db
AUTO_MIGRATE=true
ML_ENABLED=true
ML_ARTIFACT_PATH=backend/artifacts/packaging_recommender.joblib
CORS_ORIGINS=http://localhost:5173,[http://127.0.0.1:5173](http://127.0.0.1:5173)
📊 API Documentation
When the backend is running, interactive Swagger API docs are available at:

Swagger UI: http://localhost:8000/docs

ReDoc: http://localhost:8000/redoc