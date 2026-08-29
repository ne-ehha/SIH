# OceanVerif – Frontend

**Understand. Compare. Improve.**

Interactive ocean model diagnostic & experiment platform frontend for Smart India Hackathon (SIH).

## Technology Stack

- **React 19** – UI framework
- **TypeScript** – Type safety
- **Vite 8** – Build tool & dev server
- **CesiumJS** – 3D globe & geospatial visualization
- **Tailwind CSS** – Styling
- **Recharts** – Scientific charts (vertical profiles, etc.)
- **Zustand** – Lightweight state management

## Installation

```bash
# From the SIH/SIH directory
cd frontend

# Install dependencies
npm install

# Copy Cesium static assets (required for CesiumJS)
mkdir -p public/cesium
cp -r node_modules/cesium/Build/Cesium/Assets node_modules/cesium/Build/Cesium/ThirdParty node_modules/cesium/Build/Cesium/Widgets node_modules/cesium/Build/Cesium/Workers public/cesium/
```

## Running

```bash
# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create a `.env` file in the frontend root:

```
VITE_API_BASE_URL=http://localhost:8000
```

This configures the backend API URL. Defaults to `http://localhost:8000`.

## CesiumJS Configuration

CesiumJS is configured to:
- Load static assets from `/cesium/` in the public directory
- Render a dark-themed globe optimized for ocean visualization
- Support click-to-select coordinate interaction
- Display observation points as interactive markers

**Important:** Cesium static assets must be copied to `public/cesium/` before running. See installation steps above.

## Frontend Architecture

```
src/
├── app/              # App entry, routing
├── components/
│   ├── layout/       # Header, Sidebar, DashboardLayout
│   ├── globe/        # CesiumJS globe, markers, observation points
│   ├── selection/    # Selected location panel
│   ├── visualization/# 3D ocean view, depth/layer/variable controls
│   ├── comparison/   # Model vs observation, vertical profile, health
│   ├── discrepancy/  # Discrepancy heatmap
│   ├── diagnostics/  # Diagnostic analysis, solutions
│   ├── workflow/     # Investigation workflow (5-step)
│   └── common/       # LoadingState, EmptyState, ErrorState, Button
├── config/           # Regions, variables configuration
├── hooks/            # Custom React hooks
├── mocks/            # Mock data (observations, comparison, diagnostics)
├── services/         # API client & service layers
├── state/            # Zustand global store
├── types/            # TypeScript interfaces
├── utils/            # Coordinate formatting utilities
└── styles/           # Global CSS with Tailwind
```

## Switching from Mock Services to Real Backend

Currently, all data comes from mock files in `src/mocks/`. To integrate with the real FastAPI backend:

1. Update `VITE_API_BASE_URL` to point to your backend
2. Replace mock service implementations with `apiGet`/`apiPost` calls in:
   - `src/services/oceanService.ts`
   - `src/services/modelService.ts`
   - `src/services/observationService.ts`
   - `src/services/diagnosticsService.ts`

## Expected Backend Response Format

```typescript
// Success
{
  "status": "success",
  "data": { ... }
}

// Error
{
  "status": "error",
  "error": {
    "code": "DATA_UNAVAILABLE",
    "message": "No data available."
  }
}
```

## Current Frontend Capabilities

- ✅ Interactive CesiumJS globe with dark ocean theme
- ✅ Bay of Bengal default view with camera fly-to
- ✅ Click-to-select coordinates with dynamic marker
- ✅ Dynamic latitude/longitude display
- ✅ Dummy observation points on globe
- ✅ Sidebar: water bodies, data layers, time, depth, variable controls
- ✅ Selection information panel with all dynamic values
- ✅ View 3D Model modal with surface/depth/profile views
- ✅ Model vs Observation comparison (mock data)
- ✅ Vertical profile chart (Recharts, mock data)
- ✅ Discrepancy heatmap visualization (mock data)
- ✅ Diagnostic analysis panel (mock data)
- ✅ 5-step investigation workflow (mock data)
- ✅ Solutions/recommendations panel (mock data)
- ✅ Model health score card
- ✅ Loading/Empty/Error state components
- ✅ Responsive desktop-first layout
- ✅ Professional dark scientific aesthetic
- ✅ No hard-coded reference values
- ✅ Clean API service layer ready for backend integration

## What Remains for Backend Integration

- Replace mock data with real API responses
- Implement actual CesiumJS 3D ocean data visualization
- Wire up real-time observation data from Argo/gliders
- Connect diagnostic engine results
- Implement experiment comparison workflow
- Add real-time notifications and updates

## Scientific Integrity Note

The frontend **does not** perform scientific computations. All diagnostic conclusions, error analysis, and recommendations will come from the backend analysis engine. Mock data is used purely for UI development and demonstration purposes.
