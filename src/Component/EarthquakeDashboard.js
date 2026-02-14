import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import JSZip from "jszip";
import { saveAs } from "file-saver";

const ETH_BOUNDS = [[3.4, 32.9], [14.9, 48.3]];

// Function to check if location is in Ethiopia
const isEthiopiaLocation = (place) => {
  if (!place) return false;
  const placeLower = place.toLowerCase();
  
  // Countries to exclude (neighboring countries)
  const excludeCountries = [
    'yemen', 'eritrea', 'sudan', 'south sudan', 'kenya', 'somalia', 'djibouti',
    'egypt', 'libya', 'chad', 'congo', 'uganda', 'tanzania', 'rwanda', 'burundi'
  ];
  
  // Check if location contains excluded country names
  for (const country of excludeCountries) {
    if (placeLower.includes(country) && !placeLower.includes('ethiopia')) {
      return false;
    }
  }
  
  // Ethiopian keywords (expanded)
  const ethiopiaKeywords = [
    'ethiopia', 'ethiopian', 'abyssinia', 'abyssinian',
    // Regions
    'addis ababa', 'afar', 'amhara', 'oromia', 'tigray', 'somali', 'gambela', 
    'harari', 'sidama', 'snnpr', 'dire dawa', 'benishangul', 'gumuz',
    // Major cities
    'bahir dar', 'mekelle', 'gondar', 'jimma', 'jijiga', 'dessie', 'hawassa', 
    'harar', 'debre berhan', 'arba minch', 'shashamane', 'nekemte', 'assosa', 'semera',
    // Zones
    'gojjam', 'wollo', 'gonder', 'wolayita', 'gurage', 'hadiya', 'kembata',
    'silte', 'bale', 'arsi', 'hararghe', 'borena', 'guji', 'illubabor', 'wollega',
    'welega', 'gamo', 'gofa', 'keffa', 'sheka', 'bench', 'dawuro',
    // Geographic features
    'rift valley', 'awash', 'lake tana', 'blue nile', 'omo river', 'abaya',
    'chamo', 'ziway', 'langano', 'shala', 'awasa', 'tana', 'tsana'
  ];
  
  // Check if location contains Ethiopian keywords
  for (const keyword of ethiopiaKeywords) {
    if (placeLower.includes(keyword)) {
      return true;
    }
  }
  
  // Check for "of " pattern (e.g., "north of Addis Ababa")
  if (placeLower.includes('of ')) {
    const afterOf = placeLower.split('of ')[1];
    for (const keyword of ethiopiaKeywords) {
      if (afterOf.includes(keyword)) {
        return true;
      }
    }
  }
  
  return false;
};

// Function to generate KML content
const generateKML = (earthquakes) => {
  let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Ethiopia Earthquakes</name>
    <Style id="earthquakeStyle">
      <IconStyle>
        <scale>0.8</scale>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/shapes/earthquake.png</href>
        </Icon>
      </IconStyle>
      <LabelStyle>
        <scale>0</scale>
      </LabelStyle>
    </Style>`;

  earthquakes.forEach(eq => {
    const [lon, lat, depth] = eq.geometry.coordinates;
    const mag = eq.properties?.mag?.toFixed(1) || 'Unknown';
    const place = eq.properties?.place || 'Unknown location';
    const time = eq.properties?.time ? new Date(eq.properties.time).toISOString() : 'Unknown';
    const url = eq.properties?.url || '';
    
    kmlContent += `
    <Placemark>
      <name>M${mag} - ${place}</name>
      <description>
        <![CDATA[
          <div style="padding:10px;">
            <h3>Earthquake: M${mag}</h3>
            <p><b>Location:</b> ${place}</p>
            <p><b>Time:</b> ${new Date(time).toLocaleString()}</p>
            <p><b>Depth:</b> ${depth?.toFixed(1)} km</p>
            <p><b>Magnitude:</b> ${mag}</p>
            <p><a href="${url}" target="_blank">View on USGS</a></p>
          </div>
        ]]>
      </description>
      <styleUrl>#earthquakeStyle</styleUrl>
      <Point>
        <coordinates>${lon},${lat},0</coordinates>
      </Point>
      <ExtendedData>
        <Data name="magnitude">
          <value>${mag}</value>
        </Data>
        <Data name="depth">
          <value>${depth?.toFixed(1)}</value>
        </Data>
        <Data name="time">
          <value>${time}</value>
        </Data>
      </ExtendedData>
    </Placemark>`;
  });

  kmlContent += `
  </Document>
</kml>`;

  return kmlContent;
};

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

const KMZIcon = ({ size = 24, color = "#fff" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" stroke={color} strokeWidth="2" fill="none"/>
    <path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth="2" strokeLinecap="round"/>
    <path d="M16 8l2 2-2 2" stroke={color} strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

export default function EarthquakeDashboard() {
  const [earthquakes, setEarthquakes] = useState([]);
  const [filteredEarthquakes, setFilteredEarthquakes] = useState([]);
  const [startDate, setStartDate] = useState("2000-01-01");
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0,10));
  const [minMag, setMinMag] = useState(0);
  const [recentCount, setRecentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [previousEarthquakeIds, setPreviousEarthquakeIds] = useState(new Set());
  const [announcedEarthquakeIds, setAnnouncedEarthquakeIds] = useState(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const audioRef = useRef(null);

  const fetchEarthquakes = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=2000-01-01&endtime=${new Date().toISOString().slice(0, 10)}&minlatitude=3.4&maxlatitude=14.9&minlongitude=32.9&maxlongitude=48.3`;
      const res = await fetch(url);
      const data = await res.json();
      
      // Filter for Ethiopian earthquakes only (exclude neighboring countries)
      const validFeatures = data.features.filter(f => 
        f && f.geometry && f.geometry.coordinates && 
        f.geometry.coordinates.length === 3 && 
        f.properties && f.properties.time && f.id &&
        isEthiopiaLocation(f.properties.place)
      );
      
      console.log(`Fetched ${validFeatures.length} Ethiopian earthquakes`);
      
      // Check for new earthquakes within the last 1 hour only
      const currentIds = new Set(validFeatures.map(f => f.id));
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      const newEarthquakes = validFeatures.filter(f => 
        !previousEarthquakeIds.has(f.id) && 
        !announcedEarthquakeIds.has(f.id) &&
        f.properties.time > oneHourAgo
      );
      
      if (newEarthquakes.length > 0) {
        // Mark these as announced immediately
        const newAnnouncedIds = new Set([...announcedEarthquakeIds, ...newEarthquakes.map(eq => eq.id)]);
        setAnnouncedEarthquakeIds(newAnnouncedIds);
        
        // Play beep sound
        if (audioRef.current) {
          audioRef.current.play().catch(e => console.log("Audio play failed:", e));
        }
        
        // Voice alert for each new earthquake with proper location name
        newEarthquakes.forEach(eq => {
          const place = eq.properties?.place || 'Unknown location';
          const mag = eq.properties?.mag?.toFixed(1) || 'unknown';
          
          // Extract location name (e.g., "52 km NNE of Mekele" -> "Mekele")
          let locationName = place;
          
          // Try to extract the place name after "of"
          if (place.includes('of ')) {
            locationName = place.split('of ')[1];
          }
          
          // If it has comma, take the first part
          if (locationName.includes(',')) {
            locationName = locationName.split(',')[0];
          }
          
          // Clean up the location name
          locationName = locationName.trim();
          
          const message = `New earthquake detected. Magnitude ${mag} at ${locationName}.`;
          
          // Cancel any ongoing speech
          if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(message);
            utterance.rate = 0.9;
            utterance.pitch = 1;
            utterance.volume = 1;
            utterance.lang = 'en-US';
            
            window.speechSynthesis.speak(utterance);
          }
        });
        
        // Show alert for the most recent new earthquake
        const latest = newEarthquakes[newEarthquakes.length - 1];
        let placeName = latest.properties?.place || 'Unknown location';
        
        // Clean up place name for alert
        if (placeName.includes('of ')) {
          placeName = placeName.split('of ')[1];
        }
        if (placeName.includes(',')) {
          placeName = placeName.split(',')[0];
        }
        
        alert(`🚨 NEW EARTHQUAKE ALERT!\n\nMagnitude: ${latest.properties?.mag?.toFixed(1)}\nLocation: ${placeName}\nTime: ${new Date(latest.properties?.time).toLocaleString()}`);
      }
      
      setPreviousEarthquakeIds(currentIds);
      setEarthquakes(validFeatures);
      
      const oneHourAgoForRecent = new Date();
      oneHourAgoForRecent.setHours(oneHourAgoForRecent.getHours() - 1);
      const recent = validFeatures.filter(f => 
        f.properties.time && new Date(f.properties.time) > oneHourAgoForRecent
      );
      setRecentCount(recent.length);
      setLastUpdated(new Date());

    } catch (err) {
      console.error("Error fetching earthquakes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [previousEarthquakeIds, announcedEarthquakeIds]);

  useEffect(() => {
    fetchEarthquakes();
    const interval = setInterval(fetchEarthquakes, 5 * 60 * 1000);
    return () => {
      clearInterval(interval);
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [fetchEarthquakes]);

  // Apply filters - this updates the map with selected data
  useEffect(() => {
    console.log("=".repeat(50));
    console.log("Applying filters:", {
      totalEarthquakes: earthquakes.length,
      startDate,
      endDate,
      minMag
    });

    if (earthquakes.length === 0) {
      console.log("No earthquakes to filter");
      setFilteredEarthquakes([]);
      return;
    }

    let filtered = earthquakes.filter(eq => {
      if (!eq || !eq.properties || !eq.geometry) return false;
      
      const eqTime = eq.properties.time ? new Date(eq.properties.time) : null;
      const eqMag = eq.properties.mag;
      
      if (!eqTime || eqMag === null || eqMag === undefined) return false;
      
      const isAfterStart = !startDate || eqTime >= new Date(startDate);
      const isBeforeEnd = !endDate || eqTime <= new Date(endDate);
      const isMagValid = eqMag >= minMag;
      
      return isAfterStart && isBeforeEnd && isMagValid;
    });
    
    console.log(`Filtered earthquakes count: ${filtered.length}`);
    setFilteredEarthquakes(filtered);
  }, [earthquakes, startDate, endDate, minMag]);

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
    if (filteredEarthquakes.length === 0) {
      alert("No earthquakes to download for the selected filters.");
      return;
    }

    // Fixed CSV headers - clear and descriptive
    const headers = [
      'Earthquake ID',
      'Location/Place',
      'Magnitude',
      'Date & Time',
      'Longitude',
      'Latitude', 
      'Depth (km)',
      'USGS URL'
    ];
    
    // Create rows with proper data mapping
    const rows = filteredEarthquakes.map(eq => {
      const [lon, lat, depth] = eq.geometry.coordinates || [null, null, null];
      const place = eq.properties?.place || 'Unknown location';
      // Escape commas in place name by wrapping in quotes
      const escapedPlace = place.includes(',') ? `"${place}"` : place;
      
      return [
        eq.id || '',
        escapedPlace,
        eq.properties?.mag !== null && eq.properties?.mag !== undefined ? eq.properties.mag.toFixed(2) : '',
        eq.properties?.time ? new Date(eq.properties.time).toLocaleString() : '',
        lon !== null ? lon.toFixed(6) : '',
        lat !== null ? lat.toFixed(6) : '',
        depth !== null ? depth.toFixed(2) : '',
        eq.properties?.url || ''
      ].join(',');
    });
    
    // Combine headers and rows
    const csv = [headers.join(','), ...rows].join('\n');
    
    // Add BOM for UTF-8 to handle special characters properly
    const blob = new Blob(['\uFEFF' + csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    
    link.download = `ethiopia_earthquakes_${startDate}_to_${endDate}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadKMZ = async () => {
    if (filteredEarthquakes.length === 0) {
      alert("No earthquakes to download for the selected filters.");
      return;
    }

    setIsDownloading(true);
    try {
      // Generate KML content
      const kmlContent = generateKML(filteredEarthquakes);
      
      // Create ZIP file
      const zip = new JSZip();
      zip.file("doc.kml", kmlContent);
      
      // Generate KMZ file
      const blob = await zip.generateAsync({ type: "blob" });
      
      saveAs(blob, `ethiopia_earthquakes_${startDate}_to_${endDate}.kmz`);
      
    } catch (error) {
      console.error("Error creating KMZ:", error);
      alert("Error creating KMZ file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const clearFilters = () => {
    setStartDate("2000-01-01");
    setEndDate(new Date().toISOString().slice(0,10));
    setMinMag(0);
  };

  const applyFilters = () => {
    // This function is not needed as the useEffect already applies filters
    // But we keep it for the button click to manually trigger filter application
    console.log("Filters applied manually");
    // Close mobile filters after applying
    if (window.innerWidth <= 600) {
      setShowMobileFilters(false);
    }
  };

  return (
    <div style={{ 
      height: "100vh", width: "100%", position: "relative", 
      fontFamily: "'Segoe UI', 'Roboto', Arial, sans-serif",
      backgroundColor: "#0a0e17", overflow: "hidden"
    }}>
      
      {/* Header */}
      <div style={{
        backgroundColor: "rgba(10, 20, 30, 0.95)", backdropFilter: "blur(8px)",
        color: "#fff", 
        padding: window.innerWidth < 600 ? "12px 16px" : "16px 24px", 
        fontSize: window.innerWidth < 600 ? "18px" : "26px", 
        fontWeight: "600",
        borderRadius: "0 0 12px 12px", 
        position: "absolute", 
        width: window.innerWidth < 600 ? "calc(100% - 32px)" : "calc(100% - 48px)",
        top: 0, left: 0, zIndex: 1000, 
        display: "flex", alignItems: "center", gap: window.innerWidth < 600 ? "8px" : "16px",
        borderBottom: "3px solid #ff6b6b", 
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        flexWrap: "wrap"
      }}>
        <EarthquakeIcon size={window.innerWidth < 600 ? 24 : 32} color="#ff6b6b" />
        <span style={{ 
          whiteSpace: window.innerWidth < 600 ? "normal" : "nowrap",
          fontSize: window.innerWidth < 600 ? "16px" : "26px"
        }}>
          {window.innerWidth < 500 ? "Ethiopia Quake" : "Ethiopia Earthquake Monitoring Dashboard"}
        </span>
        {isLoading && (
          <div style={{ marginLeft: "auto", fontSize: "14px", color: "#ffd93d" }}>
            {window.innerWidth < 500 ? "🔄" : "🔄 Updating..."}
          </div>
        )}
        <div style={{ 
          marginLeft: "auto", 
          fontSize: window.innerWidth < 600 ? "11px" : "14px", 
          color: "#a0a0a0" 
        }}>
          {window.innerWidth < 500 ? lastUpdated.toLocaleTimeString().slice(0,5) : `Last: ${lastUpdated.toLocaleTimeString()}`}
        </div>
        {/* Debug Toggle Button */}
        <button
          onClick={() => setShowDebug(!showDebug)}
          style={{
            background: "none",
            border: "1px solid #ff6b6b",
            color: "#fff",
            padding: "4px 8px",
            borderRadius: "4px",
            fontSize: "12px",
            cursor: "pointer",
            marginLeft: "10px"
          }}
        >
          {showDebug ? "Hide Debug" : "Show Debug"}
        </button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div style={{
          position: "absolute",
          top: window.innerWidth < 600 ? 120 : 140,
          left: 10,
          right: window.innerWidth < 600 ? 10 : "auto",
          width: window.innerWidth < 600 ? "calc(100% - 20px)" : 400,
          backgroundColor: "rgba(0,0,0,0.9)",
          color: "#0f0",
          padding: "15px",
          borderRadius: "8px",
          zIndex: 2000,
          fontSize: "12px",
          fontFamily: "monospace",
          maxHeight: "300px",
          overflow: "auto"
        }}>
          <h4 style={{ margin: "0 0 10px 0", color: "#ff6b6b" }}>Debug Info</h4>
          <div>Total Earthquakes: {earthquakes.length}</div>
          <div>Filtered Earthquakes: {filteredEarthquakes.length}</div>
          <div>Date Range: {startDate} to {endDate}</div>
          <div>Min Magnitude: {minMag}</div>
          <div style={{ marginTop: "10px" }}>
            <strong>Sample of raw data (first 5):</strong>
            {earthquakes.slice(0, 5).map((eq, i) => (
              <div key={i} style={{ marginTop: "5px", borderTop: i > 0 ? "1px solid #333" : "none", padding: "5px 0" }}>
                <div>📍 {eq.properties?.place}</div>
                <div>📅 {new Date(eq.properties?.time).toLocaleDateString()}</div>
                <div>📊 M{eq.properties?.mag?.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notification Bell - Shows count for last 1 hour */}
      <div style={{
        position: "absolute", 
        top: window.innerWidth < 600 ? 70 : 80, 
        right: window.innerWidth < 600 ? 15 : 30, 
        width: window.innerWidth < 600 ? 48 : 56, 
        height: window.innerWidth < 600 ? 48 : 56,
        backgroundColor: recentCount > 0 ? "#ff4444" : "#4a4a4a", 
        borderRadius: "50%",
        display: "flex", justifyContent: "center", alignItems: "center", 
        color: "white",
        fontWeight: "bold", 
        fontSize: window.innerWidth < 600 ? "16px" : "20px", 
        cursor: "pointer", 
        zIndex: 1000,
        boxShadow: recentCount > 0 ? "0 0 0 rgba(255, 68, 68, 0.4)" : "0 2px 6px rgba(0,0,0,0.3)",
        animation: recentCount > 0 ? "pulse 2s infinite" : "none", 
        transition: "all 0.3s ease"
      }}
        title={`${recentCount} recent earthquake(s) in the last 1 hour`}
        onClick={() => fetchEarthquakes()}>
        <span style={{ fontSize: window.innerWidth < 600 ? "22px" : "28px" }}>🔔</span>
        {recentCount > 0 && (
          <span style={{
            position: "absolute", 
            top: window.innerWidth < 600 ? -3 : -5, 
            right: window.innerWidth < 600 ? -3 : -5, 
            backgroundColor: "#ffd93d",
            color: "#000", 
            borderRadius: "50%", 
            width: window.innerWidth < 600 ? 20 : 24, 
            height: window.innerWidth < 600 ? 20 : 24,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: window.innerWidth < 600 ? "10px" : "14px", 
            fontWeight: "bold"
          }}>{recentCount}</span>
        )}
      </div>

      {/* Mobile Filter Toggle Button */}
      {window.innerWidth <= 600 && (
        <button
          onClick={() => setShowMobileFilters(!showMobileFilters)}
          style={{
            position: "absolute",
            top: 70,
            left: 10,
            zIndex: 1500,
            backgroundColor: "#ff6b6b",
            color: "#fff",
            border: "none",
            borderRadius: "30px",
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            cursor: "pointer"
          }}
        >
          <MagnitudeIcon size={16} />
          {showMobileFilters ? "Hide Filters ▲" : "Show Filters ▼"}
          <span style={{ 
            backgroundColor: "#fff", 
            color: "#ff6b6b", 
            borderRadius: "50%", 
            width: "20px", 
            height: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "12px",
            fontWeight: "bold"
          }}>
            {filteredEarthquakes.length}
          </span>
        </button>
      )}

      {/* Filter Panel - Desktop and Mobile */}
      <div style={{
        position: window.innerWidth <= 600 ? "absolute" : "absolute", 
        top: window.innerWidth <= 600 
          ? (showMobileFilters ? 120 : -500) 
          : (window.innerWidth < 600 ? (window.innerWidth < 500 ? 130 : 140) : 150), 
        right: window.innerWidth <= 600 ? 10 : (window.innerWidth < 600 ? 10 : 20), 
        left: window.innerWidth <= 600 ? 10 : (window.innerWidth < 500 ? 10 : "auto"),
        width: window.innerWidth <= 600 ? "calc(100% - 20px)" : (window.innerWidth < 500 ? "calc(100% - 20px)" : window.innerWidth < 600 ? 240 : 260),
        backgroundColor: "rgba(20, 30, 40, 0.98)", 
        backdropFilter: "blur(8px)",
        color: "#fff", 
        padding: window.innerWidth < 600 ? "16px" : "20px", 
        borderRadius: "16px", 
        zIndex: window.innerWidth <= 600 ? 1400 : 1000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)", 
        border: "1px solid rgba(255,255,255,0.1)",
        transition: window.innerWidth <= 600 ? "top 0.3s ease-in-out" : "none",
        maxHeight: window.innerWidth <= 600 ? "70vh" : "auto",
        overflowY: window.innerWidth <= 600 ? "auto" : "visible"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" }}>
          <MagnitudeIcon size={24} />
          <h3 style={{ margin: 0, fontSize: window.innerWidth < 600 ? "16px" : "18px", fontWeight: "600" }}>
            {window.innerWidth < 500 ? "Filters" : "Filter Earthquakes"}
          </h3>
        </div>
        
        <label style={{ fontSize: window.innerWidth < 600 ? "13px" : "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>Start Date:</label>
        <input 
          type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
          style={{ width: "100%", marginBottom: "16px", borderRadius: "8px", 
            padding: window.innerWidth < 600 ? "10px" : "10px 12px", 
            border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: window.innerWidth < 600 ? "13px" : "14px", 
            boxSizing: "border-box"
          }} 
        />
        
        <label style={{ fontSize: window.innerWidth < 600 ? "13px" : "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>End Date:</label>
        <input 
          type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
          style={{ width: "100%", marginBottom: "16px", borderRadius: "8px", 
            padding: window.innerWidth < 600 ? "10px" : "10px 12px", 
            border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: window.innerWidth < 600 ? "13px" : "14px", 
            boxSizing: "border-box"
          }} 
        />
        
        <label style={{ fontSize: window.innerWidth < 600 ? "13px" : "14px", color: "#ccc", marginBottom: "4px", display: "block" }}>Min Magnitude:</label>
        <input 
          type="number" min="0" max="10" step="0.1" value={minMag} 
          onChange={e => setMinMag(parseFloat(e.target.value) || 0)}
          style={{ width: "100%", marginBottom: "20px", borderRadius: "8px", 
            padding: window.innerWidth < 600 ? "10px" : "10px 12px", 
            border: "1px solid #3a4a5a", backgroundColor: "#1e2a36",
            color: "#fff", fontSize: window.innerWidth < 600 ? "13px" : "14px", 
            boxSizing: "border-box"
          }} 
        />
        
        {/* Apply Filter Button - Shows selected data on map */}
        <button onClick={applyFilters} style={{
          width: "100%", 
          padding: window.innerWidth < 600 ? "12px" : "12px", 
          borderRadius: "8px", 
          backgroundColor: "#ff6b6b",
          color: "#fff", 
          border: "none", 
          cursor: "pointer", 
          fontWeight: "600",
          fontSize: window.innerWidth < 600 ? "13px" : "14px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          gap: "8px", 
          transition: "all 0.2s ease", 
          boxSizing: "border-box",
          marginBottom: "10px"
        }} onMouseEnter={e => e.target.style.backgroundColor = "#ff4444"}
           onMouseLeave={e => e.target.style.backgroundColor = "#ff6b6b"}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 3h18v18H3z" stroke="currentColor" strokeWidth="2" fill="none"/>
            <path d="M8 8h8v8H8z" stroke="currentColor" strokeWidth="2" fill="none"/>
          </svg>
          Apply Filters
        </button>
        
        {/* Download Buttons */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
          {/* CSV Download Button */}
          <button onClick={downloadCSV} style={{
            flex: 1,
            padding: window.innerWidth < 600 ? "12px" : "12px", 
            borderRadius: "8px", 
            backgroundColor: "#43a047",
            color: "#fff", 
            border: "none", 
            cursor: "pointer", 
            fontWeight: "600",
            fontSize: window.innerWidth < 600 ? "13px" : "14px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            gap: "4px", 
            transition: "all 0.2s ease", 
            boxSizing: "border-box"
          }} onMouseEnter={e => e.target.style.backgroundColor = "#2e7d32"}
             onMouseLeave={e => e.target.style.backgroundColor = "#43a047"}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 16V4M8 12L12 16L16 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 20H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            CSV
          </button>

          {/* KMZ Download Button */}
          <button onClick={downloadKMZ} disabled={isDownloading} style={{
            flex: 1,
            padding: window.innerWidth < 600 ? "12px" : "12px", 
            borderRadius: "8px", 
            backgroundColor: isDownloading ? "#666" : "#ff6b6b",
            color: "#fff", 
            border: "none", 
            cursor: isDownloading ? "wait" : "pointer", 
            fontWeight: "600",
            fontSize: window.innerWidth < 600 ? "13px" : "14px", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            gap: "4px", 
            transition: "all 0.2s ease", 
            boxSizing: "border-box",
            opacity: isDownloading ? 0.7 : 1
          }} onMouseEnter={e => !isDownloading && (e.target.style.backgroundColor = "#ff4444")}
             onMouseLeave={e => !isDownloading && (e.target.style.backgroundColor = "#ff6b6b")}>
            <KMZIcon size={18} color="#fff" />
            {isDownloading ? "Creating..." : "KMZ"}
          </button>
        </div>

        {/* Clear Filter Button */}
        <button onClick={clearFilters} style={{
          width: "100%", 
          padding: window.innerWidth < 600 ? "12px" : "12px", 
          borderRadius: "8px", 
          backgroundColor: "transparent",
          color: "#fff", 
          border: "1px solid #ff6b6b", 
          cursor: "pointer", 
          fontWeight: "600",
          fontSize: window.innerWidth < 600 ? "13px" : "14px", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          gap: "8px", 
          transition: "all 0.2s ease", 
          boxSizing: "border-box"
        }} onMouseEnter={e => {
          e.target.style.backgroundColor = "#ff6b6b";
          e.target.style.color = "#fff";
        }}
           onMouseLeave={e => {
             e.target.style.backgroundColor = "transparent";
             e.target.style.color = "#fff";
           }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18M5 6v14a2 2 0 002 2h10a2 2 0 002-2V6m-9 5v6m4-6v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <path d="M10 3h4a1 1 0 011 1v2H9V4a1 1 0 011-1z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          {window.innerWidth < 500 ? "Clear" : "Clear Filters"}
        </button>
        
        <div style={{ marginTop: "16px", fontSize: window.innerWidth < 600 ? "11px" : "12px", color: "#aaa", textAlign: "center" }}>
          Showing {filteredEarthquakes.length} earthquakes in Ethiopia
        </div>
        <div style={{ marginTop: "4px", fontSize: window.innerWidth < 600 ? "10px" : "11px", color: "#ff6b6b", textAlign: "center" }}>
          {startDate} to {endDate} | Min Mag: {minMag}
        </div>
      </div>

      {/* Audio for beep sound */}
      <audio ref={audioRef} src="https://actions.google.com/sounds/v1/alarms/beep_short.ogg" />

      {/* Map Container */}
      <div style={{ 
        height: window.innerWidth < 600 ? "calc(100% - 70px)" : "calc(100% - 80px)", 
        width: "100%", 
        marginTop: window.innerWidth < 600 ? "70px" : "80px", 
        position: "relative"
      }}>
        <MapContainer 
          bounds={ETH_BOUNDS} 
          style={{ 
            height: "100%", 
            width: "100%",
            backgroundColor: "#0a1a2a"
          }}
          zoomControl={window.innerWidth > 768}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* Display filtered earthquakes on map */}
          {filteredEarthquakes.length > 0 ? (
            filteredEarthquakes.map(eq => {
              if (!eq.geometry?.coordinates || eq.geometry.coordinates.length < 3) return null;
              const [lon, lat, depth] = eq.geometry.coordinates;
              if (!lon || !lat || isNaN(lon) || isNaN(lat)) return null;
              const mag = eq.properties?.mag;
              const time = eq.properties?.time;
              if (mag === null || mag === undefined) return null;
              const isRecentEvent = isRecent(time);
              
              return (
                <CircleMarker key={eq.id} center={[lat, lon]} 
                  radius={window.innerWidth < 600 ? Math.max(mag * 1.2, 3) : Math.max(mag * 1.5, 4)}
                  color={isRecentEvent ? "#ff4444" : getMagnitudeColor(mag)}
                  weight={window.innerWidth < 600 ? 2 : (isRecentEvent ? 3 : 2)}
                  fillColor={isRecentEvent ? "#ff4444" : getMagnitudeColor(mag)} 
                  fillOpacity={0.7}>
                  <Popup>
                    <div style={{ padding: window.innerWidth < 600 ? "6px" : "8px", maxWidth: "200px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                        <EarthquakeIcon size={window.innerWidth < 600 ? 16 : 20} color="#ff6b6b" />
                        <strong style={{ fontSize: window.innerWidth < 600 ? "14px" : "16px" }}>M{formatMagnitude(mag)}</strong>
                      </div>
                      <div style={{ marginBottom: "4px", fontSize: window.innerWidth < 600 ? "12px" : "14px" }}>
                        {eq.properties?.place?.split(',')[0] || 'Unknown location'}
                      </div>
                      <div style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px", color: "#666", marginBottom: "4px" }}>
                        📍 Depth: {formatDepth(depth)} km
                      </div>
                      <div style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px", color: "#666", marginBottom: "8px" }}>
                        🕐 {time ? new Date(time).toLocaleString() : 'Unknown time'}
                      </div>
                      {eq.properties?.url && (
                        <a href={eq.properties.url} target="_blank" rel="noopener noreferrer"
                          style={{ display: "inline-block", padding: "4px 12px", backgroundColor: "#0066cc",
                            color: "white", textDecoration: "none", borderRadius: "4px", fontSize: window.innerWidth < 600 ? "10px" : "12px" }}>
                          View Details
                        </a>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              )
            })
          ) : (
            // Show a message when no earthquakes match the filters
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(0,0,0,0.7)",
              color: "#fff",
              padding: "20px",
              borderRadius: "8px",
              zIndex: 1000,
              textAlign: "center"
            }}>
              <h3>No earthquakes found</h3>
              <p>Try adjusting your filters:</p>
              <ul style={{ textAlign: "left", marginTop: "10px" }}>
                <li>Expand the date range</li>
                <li>Lower the minimum magnitude</li>
              </ul>
              <p style={{ marginTop: "10px", color: "#ff6b6b" }}>
                Total in Ethiopia: {earthquakes.length}
              </p>
            </div>
          )}
        </MapContainer>
      </div>

      {/* Legend */}
      <div style={{
        position: "absolute", 
        bottom: window.innerWidth < 600 ? 70 : 100, 
        left: window.innerWidth < 500 ? 10 : 30, 
        right: window.innerWidth < 500 ? 10 : "auto",
        backgroundColor: "rgba(20, 30, 40, 0.95)", 
        backdropFilter: "blur(8px)",
        padding: window.innerWidth < 600 ? "12px" : "20px", 
        borderRadius: "16px", 
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
        zIndex: window.innerWidth <= 600 ? 900 : 1000, 
        color: "#fff", 
        border: "1px solid rgba(255,255,255,0.1)", 
        minWidth: window.innerWidth < 500 ? "auto" : "200px",
        maxWidth: window.innerWidth < 500 ? "calc(100% - 20px)" : "200px"
      }}>
        <h4 style={{ margin: "0 0 12px 0", display: "flex", alignItems: "center", gap: "8px", fontSize: window.innerWidth < 600 ? "14px" : "16px" }}>
          <EarthquakeIcon size={window.innerWidth < 600 ? 16 : 20} color="#ff6b6b" /> Map Legend
        </h4>
        
        <div style={{ 
          display: "flex", 
          flexDirection: window.innerWidth < 500 ? "row" : "column", 
          flexWrap: "wrap", 
          gap: window.innerWidth < 500 ? "12px" : "12px" 
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <RecentIcon size={window.innerWidth < 600 ? 16 : 20} color="#ff4444" /> 
            <span style={{ fontSize: window.innerWidth < 600 ? "12px" : "14px" }}>Recent (2d)</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <HistoricalIcon size={window.innerWidth < 600 ? 16 : 20} color="#ffa500" /> 
            <span style={{ fontSize: window.innerWidth < 600 ? "12px" : "14px" }}>Historical</span>
          </div>
          
          <div style={{ 
            marginTop: window.innerWidth < 500 ? "0" : "8px", 
            paddingTop: window.innerWidth < 500 ? "0" : "12px", 
            borderTop: window.innerWidth < 500 ? "none" : "1px solid rgba(255,255,255,0.1)" 
          }}>
            <div style={{ fontSize: window.innerWidth < 600 ? "12px" : "14px", marginBottom: "6px", color: "#ccc" }}>Magnitude:</div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <div style={{ width: window.innerWidth < 600 ? 10 : 12, height: window.innerWidth < 600 ? 10 : 12, borderRadius: "50%", backgroundColor: "#6c757d" }}></div>
                <span style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px" }}>&lt;4</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <div style={{ width: window.innerWidth < 600 ? 10 : 12, height: window.innerWidth < 600 ? 10 : 12, borderRadius: "50%", backgroundColor: "#ffc107" }}></div>
                <span style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px" }}>4-5</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <div style={{ width: window.innerWidth < 600 ? 10 : 12, height: window.innerWidth < 600 ? 10 : 12, borderRadius: "50%", backgroundColor: "#fd7e14" }}></div>
                <span style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px" }}>5-6</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                <div style={{ width: window.innerWidth < 600 ? 10 : 12, height: window.innerWidth < 600 ? 10 : 12, borderRadius: "50%", backgroundColor: "#dc3545" }}></div>
                <span style={{ fontSize: window.innerWidth < 600 ? "10px" : "12px" }}>&gt;6</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, width: "100%",
        backgroundColor: "rgba(10, 20, 30, 0.95)", backdropFilter: "blur(8px)",
        color: "#fff", 
        padding: window.innerWidth < 600 ? "10px" : "16px", 
        textAlign: "center", 
        fontSize: window.innerWidth < 600 ? "10px" : "14px",
        borderTop: "1px solid rgba(255,255,255,0.1)", 
        zIndex: 800,
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        gap: window.innerWidth < 600 ? "8px" : "20px",
        flexWrap: "wrap"
      }}>
        <span>{window.innerWidth < 500 ? "© 2026 Aster C." : "© 2026 Produced by Aster Chalchisa"}</span>
        <span style={{ color: "#666" }}>|</span>
        <span>{window.innerWidth < 500 ? "USGS" : "Data: USGS Earthquake Hazards Program"}</span>
        <span style={{ color: "#666" }}>|</span>
        <span>{lastUpdated.toLocaleTimeString().slice(0,5)}</span>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(255, 68, 68, 0); }
        }
        @media (max-width: 600px) {
          .leaflet-control-zoom { 
            display: none; 
          }
        }
      `}</style>
    </div>
  );
}