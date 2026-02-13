import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const ETH_BOUNDS = [[3.4, 32.9], [14.9, 48.3]];

// Custom earthquake icon for legend and header
const EarthquakeIcon = ({ size = 24, color = "#ff6b6b", className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill={color}/>
    <path d="M12 6v4M9 8h6" stroke="white" strokeWidth="1.5"/>
  </svg>
);

const RecentIcon = ({ size = 24, color = "#ff4444" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill={color} />
    <path d="M12 6v6l4 2" stroke="white" strokeWidth="2" />
  </svg>
);

const HistoricalIcon = ({ size = 24, color = "#ffa500" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" fill={color} />
    <path d="M12 8v4l3 2" stroke="white" strokeWidth="2" />
  </svg>
);

const MagnitudeIcon = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 12h18M7 8l2 4-2 4M17 8l-2 4 2 4" stroke="#ff6b6b" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function EarthquakeDashboard() {
  const [earthquakes, setEarthquakes] = useState([]);
  const [startDate, setStartDate] = useState("2000-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [minMag, setMinMag] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const audioRef = useRef(null);

  const fetchEarthquakes = async () => {
    setIsLoading(true);
    try {
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2000-01-01&endtime=${new Date().toISOString().slice(0, 10)}&minlatitude=3.4&maxlatitude=14.9&minlongitude=32.9&maxlongitude=48.3`;
      const res = await fetch(url);
      const data = await res.json();
      
      const validFeatures = data.features.filter(f => 
        f && f.geometry && f.geometry.coordinates && 
        f.geometry.coordinates.length === 3 && f.properties && f.properties.time && f.id
      );
      
      setEarthquakes(validFeatures);
      
      const thirtyMinAgo = new Date();
      thirtyMinAgo.setMinutes(thirtyMinAgo.getMinutes() - 30);
      const recent = validFeatures.filter(f => 
        f.properties.time && new Date(f.properties.time) > thirtyMinAgo
      );
      setRecentCount(recent.length);
      setLastUpdated(new Date());

      if (recent.length > 0 && audioRef.current) {
        audioRef.current.play().catch(e => console.log("Audio play failed:", e));
      }
    } catch (err) {
      console.error("Error fetching earthquakes:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEarthquakes();
    const interval = setInterval(fetchEarthquakes, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredEarthquakes = earthquakes.filter(eq => {
    if (!eq || !eq.properties || !eq.geometry) return false;
    
    const eqTime = eq.properties.time ? new Date(eq.properties.time) : null;
    const eqMag = eq.properties.mag;
    
    if (!eqTime || eqMag === null || eqMag === undefined) return false;
    
    const isAfterStart = !startDate || eqTime >= new Date(startDate);
    const isBeforeEnd = !endDate || eqTime <= new Date(endDate);
    const isMagValid = eqMag >= minMag;
    
    return isAfterStart && isBeforeEnd && isMagValid;
  });

  const isRecent = (time) => {
    if (!time) return false;
    return new Date(time) > new Date(Date.now() - 2*24*60*60*1000);
  };

  const getMagnitudeColor = (mag) => {
    if (!mag && mag !== 0) return "#6c757d";
    if (mag >= 6) return "#dc3545";
    if (mag >= 5) return "#fd7e14";
    if (mag >= 4) return "#ffc107";
    return "#6c757d";
  };

  const formatDepth = (depth) => {
    if (depth === null || depth === undefined) return "Unknown";
    return depth.toFixed(1);
  };

  const formatMagnitude = (mag) => {
    if (mag === null || mag === undefined) return "N/A";
    return mag.toFixed(1);
  };

  const downloadCSV = () => {
    const headers = ['id','place','mag','time','lon','lat','depth','url'];
    const rows = filteredEarthquakes.map(eq => {
      const [lon, lat, depth] = eq.geometry.coordinates || [null, null, null];
      return [
        eq.id || '',
        eq.properties?.place || 'Unknown location',
        eq.properties?.mag !== null && eq.properties?.mag !== undefined ? eq.properties.mag : '',
        eq.properties?.time ? new Date(eq.properties.time).toISOString() : '',
        lon !== null ? lon : '',
        lat !== null ? lat : '',
        depth !== null ? depth : '',
        eq.properties?.url || ''
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `ethiopia_earthquakes_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ 
      height: "100vh", width: "100%", position: "relative", 
      fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif",
      backgroundColor: "#0a0e17", overflow: "hidden"
    }}>
      
      {/* Header with Icon */}
      <div style={{
        backgroundColor: "rgba(10, 20, 30, 0.95)", backdropFilter: "blur(8px)",
        color: "#fff", padding: "16px 24px", fontSize: "26px", fontWeight: "600",
        borderRadius: "0 0 12px 12px", position: "absolute", width: "calc(100% - 48px)",
        top: 0, left: 0, zIndex: 1000, display: "flex", alignItems: "center", gap: "16px",
        borderBottom: "3px solid #ff6b6b", boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
      }}>
        <EarthquakeIcon size={32} color="#ff6b6b" />
        <span>Ethiopia Earthquake Monitoring Dashboard</span>
        {isLoading && (
          <div style={{ marginLeft: "auto", fontSize: "16px", color: "#ffd93d" }}>🔄 Updating...</div>
        )}
        <div style={{ marginLeft: "auto", fontSize: "14px", color: "#a0a0a0" }}>
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* Notification Bell with Pulse Animation */}
      <div style={{
        position: "absolute", top: 80, right: 30, width: 56, height: 56,
        backgroundColor: recentCount > 0 ? "#ff4444" : "#4a4a4a", borderRadius: "50%",
        display: "flex", justifyContent: "center", alignItems: "center", color: "white",
        fontWeight: "bold", fontSize: "20px", cursor: "pointer", zIndex: 1000,
        boxShadow: recentCount > 0 ? "0 0 0 rgba(255, 68, 68, 0.4)" : "0 2px 6px rgba(0,0,0,0.3)",
        animation: recentCount > 0 ? "pulse 2s infinite" : "none", transition: "all 0.3s ease"
      }}
        title={`${recentCount} recent earthquake(s) in the last 30 minutes`}
        onClick={() => fetchEarthquakes()}>
        <span style={{ fontSize: "28px" }}>🔔</span>
        {recentCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, backgroundColor: "#ffd93d",
            color: "#000", borderRadius: "50%", width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "14px", fontWeight: "bold"
          }}>{recentCount}</span>
        )}
      </div>

      {/* Enhanced Filter Panel - All inputs equal width */}
      <div style={{
        position: "absolute", top: 150, right: 20, width: 260,
        backgroundColor: "rgba(20, 30, 40, 0.95)", backdropFilter: "blur(8px)",
        color: "#fff", padding: "20px", borderRadius: "16px", zIndex: 1000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <MagnitudeIcon size={24} />
          <h3 style={{ margin: 0, fontSize: "18px", fontWeight: "600" }}>Filter Earthquakes</h3>
        </div>
        
        <label style={{ fontSize: "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>Start Date:</label>
        <input 
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ width: "100%", marginBottom: "16px", borderRadius: "8px", 
            padding: "10px 12px", border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: "14px", boxSizing: "border-box"
          }} 
        />
        
        <label style={{ fontSize: "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>End Date:</label>
        <input 
          type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ width: "100%", marginBottom: "16px", borderRadius: "8px", 
            padding: "10px 12px", border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: "14px", boxSizing: "border-box"
          }} 
        />
        
        <label style={{ fontSize: "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>Min Magnitude:</label>
        <input 
          type="number" min="0" max="10" step="0.1" value={minMag} 
          onChange={e => setMinMag(parseFloat(e.target.value) || 0)}
          style={{ width: "100%", marginBottom: "20px", borderRadius: "8px", 
            padding: "10px 12px", border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: "14px", boxSizing: "border-box"
          }} 
        />
        
        <button onClick={downloadCSV} style={{
          width: "100%", padding: "12px", borderRadius: "8px", backgroundColor: "#43a047",
          color: "#fff", border: "none", cursor: "pointer", fontWeight: "600",
          fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center",
          gap: "8px", transition: "all 0.2s ease", boxSizing: "border-box"
        }} onMouseEnter={e => e.target.style.backgroundColor = "#2e7d32"}
           onMouseLeave={e => e.target.style.backgroundColor = "#43a047"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 16V4M8 12L12 16L16 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            <path d="M4 20H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Download CSV
        </button>
        
        <div style={{ marginTop: "16px", fontSize: "12px", color: "#aaa", textAlign: "center" }}>
          Showing {filteredEarthquakes.length} earthquakes
        </div>
      </div>

      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" />

      {/* Map Container */}
      <div style={{ height: "calc(100% - 80px)", width: "100%", marginTop: "80px", position: "relative" }}>
        <MapContainer bounds={ETH_BOUNDS} style={{ height: "100%", width: "100%", backgroundColor: "#0a1a2a" }}>
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {filteredEarthquakes.map(eq => {
            if (!eq.geometry?.coordinates || eq.geometry.coordinates.length < 3) return null;
            const [lon, lat, depth] = eq.geometry.coordinates;
            if (!lon || !lat || isNaN(lon) || isNaN(lat)) return null;
            const mag = eq.properties?.mag;
            const time = eq.properties?.time;
            if (mag === null || mag === undefined) return null;
            const isRecentEvent = isRecent(time);
            
            return (
              <CircleMarker key={eq.id} center={[lat, lon]} radius={Math.max(mag * 1.5, 4)}
                color={isRecentEvent ? "#ff4444" : getMagnitudeColor(mag)}
                weight={isRecentEvent ? 3 : 2}
                fillColor={isRecentEvent ? "#ff4444" : getMagnitudeColor(mag)} fillOpacity={0.7}>
                <Popup>
                  <div style={{ padding: "8px", maxWidth: "250px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                      <EarthquakeIcon size={20} color="#ff6b6b" />
                      <strong style={{ fontSize: "16px" }}>M{formatMagnitude(mag)}</strong>
                    </div>
                    <div style={{ marginBottom: "4px" }}>{eq.properties?.place || 'Unknown location'}</div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "4px" }}>
                      📍 Depth: {formatDepth(depth)} km
                    </div>
                    <div style={{ fontSize: "12px", color: "#666", marginBottom: "8px" }}>
                      🕐 {time ? new Date(time).toLocaleString() : 'Unknown time'}
                    </div>
                    {eq.properties?.url && (
                      <a href={eq.properties.url} target="_blank" rel="noopener noreferrer"
                        style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "#0066cc",
                          color: "white", textDecoration: "none", borderRadius: "4px", fontSize: "12px" }}>
                        View on USGS
                      </a>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>

      {/* Enhanced Legend with Icons */}
      <div style={{
        position: "absolute", bottom: 100, left: 30,
        backgroundColor: "rgba(20, 30, 40, 0.95)", backdropFilter: "blur(8px)",
        padding: "20px", borderRadius: "16px", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: 1000, color: "#fff", border: "1px solid rgba(255,255,255,0.1)", minWidth: "200px"
      }}>
        <h4 style={{ margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: "8px" }}>
          <EarthquakeIcon size={20} color="#ff6b6b" /> Map Legend
        </h4>
        
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <RecentIcon size={20} color="#ff4444" /> <span>Recent (Last 2 Days)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <HistoricalIcon size={20} color="#ffa500" /> <span>Historical</span>
          </div>
          
          <div style={{ marginTop: "8px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontSize: "14px", marginBottom: "8px", color: "#ccc" }}>Magnitude:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#6c757d" }}></div>
                <span style={{ fontSize: "12px" }}>&lt;4</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#ffc107" }}></div>
                <span style={{ fontSize: "12px" }}>4-5</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#fd7e14" }}></div>
                <span style={{ fontSize: "12px" }}>5-6</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: 12, height: 12, borderRadius: "50%", backgroundColor: "#dc3545" }}></div>
                <span style={{ fontSize: "12px" }}>&gt;6</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer with Professional Credits */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: "100%",
        backgroundColor: "rgba(10, 20, 30, 0.95)", backdropFilter: "blur(8px)",
        color: "#fff", padding: "16px", textAlign: "center", fontSize: "14px",
        borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 1000,
        display: "flex", justifyContent: "center", alignItems: "center", gap: "20px"
      }}>
        <span>© 2026 Produced by Aster Chalchisa</span>
        <span style={{ color: "#666" }}>|</span>
        <span>Data: USGS Earthquake Hazards Program</span>
        <span style={{ color: "#666" }}>|</span>
        <span>Last Update: {lastUpdated.toLocaleString()}</span>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}