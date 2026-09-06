import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Sparkles,
  TrendingUp,
  Compass,
  CheckCircle2,
  AlertCircle,
  Maximize2,
  Download,
  Building2,
  TreePine,
  Wheat,
  Factory
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from "recharts";
import { Shell } from "@/components/shell";
import {
  getGisSummary,
  getGisFilters,
  getGisParcels,
  type GisSummaryResult,
  type GisFiltersResult,
  type GisParcel
} from "@/lib/api";

const RISK_COLORS: Record<string, string> = {
  Low: "#10b981",
  Medium: "#f59e0b",
  High: "#f43f5e",
};

function getMarkerColor(risk: string) {
  return RISK_COLORS[risk] || "#64748b";
}

export function GisMapPage() {
  const [summary, setSummary] = useState<GisSummaryResult | null>(null);
  const [filters, setFilters] = useState<GisFiltersResult>({
    districts: [],
    taluks_by_district: {},
    risk_categories: [],
    delay_status: [],
  });
  const [parcels, setParcels] = useState<GisParcel[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter states
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts");
  const [selectedTaluk, setSelectedTaluk] = useState("All Taluks");
  const [selectedRisk, setSelectedRisk] = useState("All Risk Categories");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedParcel, setSelectedParcel] = useState<GisParcel | null>(null);

  // Available taluks depending on selected district
  const availableTaluks = useMemo(() => {
    if (selectedDistrict === "All Districts") return [];
    return filters.taluks_by_district[selectedDistrict] || [];
  }, [selectedDistrict, filters]);

  // Initial load: summary & filters
  useEffect(() => {
    async function initData() {
      try {
        setLoading(true);
        const [sumRes, filRes] = await Promise.all([
          getGisSummary().catch(() => null),
          getGisFilters().catch(() => ({
            districts: [],
            taluks_by_district: {},
            risk_categories: [],
            delay_status: [],
          })),
        ]);
        if (sumRes) setSummary(sumRes);
        setFilters(filRes);
      } catch (err: any) {
        setError("Could not connect to GIS backend service.");
      } finally {
        setLoading(false);
      }
    }
    initData();
  }, []);

  // Fetch parcels on filter change
  useEffect(() => {
    let active = true;
    async function fetchParcels() {
      try {
        setLoading(true);
        const res = await getGisParcels({
          district: selectedDistrict,
          taluk: selectedTaluk,
          risk_category: selectedRisk,
          search: searchQuery,
          limit: 600,
        });
        if (active) {
          setParcels(res.parcels);
          setTotalCount(res.total);
          if (res.parcels.length > 0 && !selectedParcel) {
            setSelectedParcel(res.parcels[0]);
          }
        }
      } catch (err: any) {
        if (active) setError(err.message || "Failed to load parcels.");
      } finally {
        if (active) setLoading(false);
      }
    }
    const debouncer = setTimeout(fetchParcels, 200);
    return () => {
      active = false;
      clearTimeout(debouncer);
    };
  }, [selectedDistrict, selectedTaluk, selectedRisk, searchQuery]);

  // Handle district selection change
  const handleDistrictChange = (d: string) => {
    setSelectedDistrict(d);
    setSelectedTaluk("All Taluks");
  };

  // Leaflet map refs and state
  const [baseMap, setBaseMap] = useState<"streets" | "satellite">("streets");
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersGroupRef = useRef<L.LayerGroup | null>(null);
  const circleMapRef = useRef<Map<string, L.CircleMarker>>(new Map());

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [11.1271, 78.6569], // Central Tamil Nadu
      zoom: 7,
      minZoom: 6,
      maxZoom: 18,
      zoomControl: false,
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const tileUrl =
      baseMap === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const tiles = L.tileLayer(tileUrl, {
      attribution:
        baseMap === "satellite"
          ? "Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    tileLayerRef.current = tiles;
    markersGroupRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
      tileLayerRef.current = null;
      markersGroupRef.current = null;
    };
  }, []);

  // Swap Tile Layer on baseMap change
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    mapInstanceRef.current.removeLayer(tileLayerRef.current);

    const tileUrl =
      baseMap === "satellite"
        ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

    const newTiles = L.tileLayer(tileUrl, {
      attribution:
        baseMap === "satellite"
          ? "Tiles &copy; Esri"
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newTiles;
  }, [baseMap]);

  // Synchronize Leaflet markers with parcels
  useEffect(() => {
    if (!mapInstanceRef.current || !markersGroupRef.current) return;
    markersGroupRef.current.clearLayers();
    circleMapRef.current.clear();

    if (parcels.length === 0) return;

    const latLngs: [number, number][] = [];

    parcels.forEach((p) => {
      if (!p.latitude || !p.longitude) return;

      const lat = Number(p.latitude);
      const lng = Number(p.longitude);
      latLngs.push([lat, lng]);

      const color = getMarkerColor(p.Predicted_Risk_Category);
      const isSelected = selectedParcel?.Land_ID === p.Land_ID;

      const circle = L.circleMarker([lat, lng], {
        radius: isSelected ? 9 : 6,
        fillColor: color,
        color: isSelected ? "#38bdf8" : "#ffffff",
        weight: isSelected ? 2.5 : 1,
        opacity: 0.95,
        fillOpacity: 0.85,
      });

      circle.bindPopup(`
        <div style="font-family: system-ui, sans-serif; min-width: 170px; padding: 2px;">
          <div style="font-weight: 700; font-size: 13px; color: #0f172a; margin-bottom: 3px;">
            ${p.Land_ID} · ${p.Village}
          </div>
          <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
            ${p.Taluk}, ${p.District}
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
            <span style="color: #64748b;">Survey No:</span>
            <span style="font-weight: 600; color: #0f172a;">${p.Survey_No}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 2px;">
            <span style="color: #64748b;">Predicted Risk:</span>
            <span style="font-weight: 700; color: ${color};">${p.Predicted_Risk_Category}</span>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 11px;">
            <span style="color: #64748b;">Predicted Delay:</span>
            <span style="font-weight: 600; color: #0f172a;">${p.Predicted_Delay_Days} d</span>
          </div>
        </div>
      `);

      circle.on("click", () => {
        setSelectedParcel(p);
      });

      circle.addTo(markersGroupRef.current!);
      circleMapRef.current.set(p.Land_ID, circle);
    });

    if (latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }
  }, [parcels]);

  // Handle selected parcel change
  useEffect(() => {
    if (!selectedParcel || !mapInstanceRef.current) return;
    const marker = circleMapRef.current.get(selectedParcel.Land_ID);
    if (marker) {
      marker.openPopup();
      circleMapRef.current.forEach((m, id) => {
        const isSel = id === selectedParcel.Land_ID;
        m.setStyle({
          radius: isSel ? 9 : 6,
          color: isSel ? "#38bdf8" : "#ffffff",
          weight: isSel ? 2.5 : 1,
        });
      });
    }
  }, [selectedParcel]);

  // Analytics: District counts
  const districtChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of parcels) {
      counts[p.District] = (counts[p.District] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([district, count]) => ({ district, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [parcels]);

  // Analytics: Land use distribution
  const riskChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of parcels) {
      counts[p.Predicted_Risk_Category] = (counts[p.Predicted_Risk_Category] || 0) + 1;
    }
    return Object.entries(counts).map(([type, count]) => ({
      type,
      count,
      color: getMarkerColor(type),
    }));
  }, [parcels]);

  return (
    <Shell>
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end">
        <div>
          <div className="eyebrow flex items-center gap-2 text-cyan-400">
            <Compass size={14} /> Tamil Nadu Geospatial Intelligence
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-slate-100 md:text-4xl">
            GIS Land Acquisition Map
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Interactive parcel visualization, cadastral clusters, land-use zoning, and compensation analytics.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            Live GIS Engine Online
          </div>
          <button
            onClick={() => {
              setSelectedDistrict("All Districts");
              setSelectedTaluk("All Taluks");
              setSelectedRisk("All Risk Categories");
              setSearchQuery("");
            }}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RefreshCw size={13} /> Reset Filters
          </button>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="eyebrow text-slate-400">Loaded Parcels</div>
          <div className="mt-1 font-display text-2xl font-bold text-cyan-300">
            {totalCount.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {summary ? `of ${summary.total_parcels.toLocaleString()} total` : "Ground parcels"}
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="eyebrow text-slate-400">Active Districts</div>
          <div className="mt-1 font-display text-2xl font-bold text-slate-100">
            {summary ? summary.districts : "20"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Tamil Nadu region</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="eyebrow text-slate-400">Mapped Records</div>
          <div className="mt-1 font-display text-2xl font-bold text-amber-300">
            {summary ? `${(summary.total_parcels).toLocaleString()} records` : "--"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Gazette records mapped</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur-sm">
          <div className="eyebrow text-slate-400">Avg Recorded Duration</div>
          <div className="mt-1 font-display text-2xl font-bold text-emerald-400">
            {summary?.avg_acquisition_days != null ? `${summary.avg_acquisition_days.toFixed(1)} d` : "--"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Average recorded duration</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 shadow-sm backdrop-blur-sm col-span-2 sm:col-span-1">
          <div className="eyebrow text-slate-400">Coordinate Source</div>
          <div className="mt-1 font-display text-2xl font-bold text-violet-300">
            {summary ? "Approximate" : "--"}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Village/district coordinates</div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-4 backdrop-blur-md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Search */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">
              Search Parcel ID / Village
            </label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-3 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. 101, Chennai, Oragadam..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/80 pl-9 pr-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* District Select */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">District</label>
            <select
              value={selectedDistrict}
              onChange={(e) => handleDistrictChange(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
            >
              <option value="All Districts">All Districts (Tamil Nadu)</option>
              {filters.districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          {/* Taluk Select */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Taluk / Tehsil</label>
            <select
              value={selectedTaluk}
              onChange={(e) => setSelectedTaluk(e.target.value)}
              disabled={selectedDistrict === "All Districts"}
              className={`h-10 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400 ${
                selectedDistrict === "All Districts" ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <option value="All Taluks">
                {selectedDistrict === "All Districts" ? "Select District first" : "All Taluks"}
              </option>
              {availableTaluks.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Risk Select */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-400">Predicted Risk</label>
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="h-10 w-full rounded-md border border-slate-700 bg-slate-900/80 px-3 text-xs text-slate-200 outline-none focus:border-cyan-400"
            >
              <option value="All Risk Categories">All Risk Categories</option>
              {filters.risk_categories.map((risk) => (
                <option key={risk} value={risk}>
                  {risk}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Interactive Map & Inspector Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Map Canvas */}
        <div className="rounded-xl border border-slate-800 bg-[#090f1d] p-5 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Layers size={16} className="text-cyan-400" />
              <h2 className="text-sm font-bold text-slate-200">Interactive GIS Map View</h2>
              <span className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-300">
                {parcels.length} parcels plotted
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-cyan-400" /> Click parcel marker to inspect
            </div>
          </div>

          {/* Interactive Leaflet GIS Map */}
          <div className="relative mt-4 h-[460px] w-full overflow-hidden rounded-lg border border-slate-800 bg-[#050b14]">
            {/* Real Map Canvas */}
            <div ref={mapContainerRef} className="h-full w-full z-0" />

            {/* Base map switcher: Streets & Satellite */}
            <div className="absolute top-3 right-3 z-[400] flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-950/90 p-1 backdrop-blur-md shadow-lg">
              <button
                type="button"
                onClick={() => setBaseMap("streets")}
                className={`rounded px-3 py-1 text-[11px] font-semibold transition ${
                  baseMap === "streets"
                    ? "bg-cyan-400 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🗺️ Streets
              </button>
              <button
                type="button"
                onClick={() => setBaseMap("satellite")}
                className={`rounded px-3 py-1 text-[11px] font-semibold transition ${
                  baseMap === "satellite"
                    ? "bg-cyan-400 text-slate-950 shadow"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🛰️ Satellite
              </button>
            </div>

            {/* Compass & Real Layer Badge */}
            <div className="absolute left-3 top-3 z-[400] rounded-md border border-slate-700/80 bg-slate-950/90 px-2.5 py-1.5 text-xs backdrop-blur-md shadow-lg">
              <div className="flex items-center gap-1.5 font-bold text-slate-200">
                <Compass size={14} className="text-cyan-400" /> Tamil Nadu Cadastre
              </div>
              <div className="mt-0.5 text-[10px] text-slate-400">
                OpenStreetMap / ESRI World Imagery
              </div>
            </div>

            {/* Map Legend */}
            <div className="absolute bottom-3 left-3 right-3 z-[400] flex flex-wrap items-center gap-4 rounded-md border border-slate-700/80 bg-slate-950/90 px-3 py-2 text-[11px] backdrop-blur-md shadow-lg">
              <span className="font-semibold text-slate-400">Predicted Risk:</span>
              {Object.entries(RISK_COLORS).map(([type, color]) => (
                <span key={type} className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  {type} Risk
                </span>
              ))}
              <span className="ml-auto text-[10px] text-slate-400">
                Click any circle marker to view details & popup
              </span>
            </div>
          </div>
        </div>

        {/* Selected Parcel Inspector */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="eyebrow text-cyan-400">Parcel Intelligence Inspector</div>
              <span className="rounded bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                {selectedParcel ? selectedParcel.Land_ID : "Select a record"}
              </span>
            </div>

            {selectedParcel ? (
              <div className="mt-4 space-y-4 text-xs">
                <div>
                  <div className="text-lg font-bold text-slate-100">
                    {selectedParcel.Village}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-slate-400">
                    <MapPin size={12} className="text-cyan-400" />
                    {selectedParcel.Taluk}, {selectedParcel.District}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-900/60 p-3">
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">
                      Survey No
                    </span>
                    <div className="mt-0.5 font-mono font-bold text-slate-200">
                      {selectedParcel.Survey_No}
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">
                      Area Size
                    </span>
                    <div className="mt-0.5 font-bold text-amber-300">
                      {selectedParcel.Extent_Hectares.toFixed(3)} ha
                    </div>
                  </div>
                </div>

                <div className="space-y-2 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Land Type:</span>
                    <span
                      className="font-semibold"
                      style={{ color: getMarkerColor(selectedParcel.Predicted_Risk_Category) }}
                    >
                      {selectedParcel.Land_Type}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Soil Type:</span>
                    <span className="font-semibold text-slate-200">{selectedParcel.Soil_Type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Recorded Delay:</span>
                    <span className="font-semibold text-slate-200">
                      {selectedParcel.Acquisition_Days} days ({selectedParcel.Delay_Status})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Coordinates:</span>
                    <span className="font-mono text-cyan-300">
                      {selectedParcel.latitude.toFixed(4)}, {selectedParcel.longitude.toFixed(4)}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                    Model Prediction
                  </div>
                  <div className="mt-2 flex justify-between text-xs">
                    <span className="text-slate-400">Predicted risk:</span>
                    <span className="font-semibold text-slate-200">
                      {selectedParcel.Predicted_Risk_Category}
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="text-slate-400">Predicted delay:</span>
                    <span className="font-bold text-emerald-300">
                      {selectedParcel.Predicted_Delay_Days.toFixed(1)} days
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-48 items-center justify-center text-center text-xs text-slate-500">
                Click on any parcel on the map to view detailed survey metrics.
              </div>
            )}
          </div>

          <div className="mt-4 border-t border-slate-800 pt-3">
            <a
              href="/risk-predictor"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-cyan-300"
            >
              <Sparkles size={14} /> Analyze Delay Risk in Predictor
            </a>
          </div>
        </div>
      </div>

      {/* Geospatial Analytics Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-md">
          <div className="eyebrow text-slate-400">Geospatial Distribution</div>
          <h3 className="mt-1 text-sm font-bold text-slate-200">Top Districts by Acquisition Parcels</h3>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={districtChartData} layout="vertical">
                <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis
                  dataKey="district"
                  type="category"
                  width={110}
                  tick={{ fontSize: 11, fill: "#cbd5e1" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="#38bdf8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-md">
          <div className="eyebrow text-slate-400">Model Risk Breakdown</div>
          <h3 className="mt-1 text-sm font-bold text-slate-200">Predicted Risk Categories Across Records</h3>
          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData}>
                <XAxis dataKey="type" tick={{ fontSize: 10, fill: "#94a3b8" }} interval={0} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip
                  contentStyle={{
                    background: "#0f172a",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {riskChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Cadastral Records Table */}
      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/70 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <div className="eyebrow text-slate-400">Cadastral Register</div>
              <h3 className="mt-1 text-sm font-bold text-slate-200">
              Scored Land Records ({parcels.length})
            </h3>
          </div>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3">Land ID</th>
                <th className="py-2.5 px-3">Survey No</th>
                <th className="py-2.5 px-3">District</th>
                <th className="py-2.5 px-3">Taluk</th>
                <th className="py-2.5 px-3">Village</th>
                <th className="py-2.5 px-3">Land Type</th>
                <th className="py-2.5 px-3">Risk</th>
                <th className="py-2.5 px-3">Predicted Delay</th>
                <th className="py-2.5 px-3">Recorded Days</th>
                <th className="py-2.5 px-3 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {parcels.slice(0, 20).map((p) => (
                <tr
                  key={p.Land_ID}
                  onClick={() => setSelectedParcel(p)}
                  className={`cursor-pointer transition hover:bg-slate-800/40 ${
                    selectedParcel?.Land_ID === p.Land_ID ? "bg-cyan-500/10" : ""
                  }`}
                >
                  <td className="py-2 px-3 font-mono font-bold text-cyan-300">{p.Land_ID}</td>
                  <td className="py-2 px-3 font-mono text-slate-400">{p.Survey_No}</td>
                  <td className="py-2 px-3">{p.District}</td>
                  <td className="py-2 px-3">{p.Taluk}</td>
                  <td className="py-2 px-3">{p.Village}</td>
                  <td className="py-2 px-3">
                    <span
                      className="rounded px-2 py-0.5 text-[10px] font-semibold"
                      style={{
                        backgroundColor: `${getMarkerColor(p.Predicted_Risk_Category)}22`,
                        color: getMarkerColor(p.Predicted_Risk_Category),
                      }}
                    >
                      {p.Land_Type}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-semibold text-amber-300">{p.Predicted_Risk_Category}</td>
                  <td className="py-2 px-3 text-slate-400">{p.Predicted_Delay_Days.toFixed(1)} days</td>
                  <td className="py-2 px-3 font-bold text-emerald-400">{p.Acquisition_Days} days</td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedParcel(p);
                      }}
                      className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-bold text-cyan-300 hover:bg-cyan-400 hover:text-slate-950"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Shell>
  );
}
