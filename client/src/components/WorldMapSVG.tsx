import { useState } from "react";

interface CountryData {
  country: string;
  users: number;
  sessions: number;
}

interface WorldMapSVGProps {
  data: CountryData[];
  metric: 'users' | 'sessions';
  className?: string;
}

export default function WorldMapSVG({ 
  data, 
  metric = 'users', 
  className = "" 
}: WorldMapSVGProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ visible: boolean; content: string; x: number; y: number }>({
    visible: false,
    content: '',
    x: 0,
    y: 0
  });

  // Create a map for quick country data lookup
  const countryDataMap = new Map<string, CountryData>();
  data.forEach(country => {
    countryDataMap.set(country.country, country);
    // Add common variations
    if (country.country === "United States of America" || country.country === "United States") {
      countryDataMap.set("US", country);
      countryDataMap.set("USA", country);
      countryDataMap.set("United States", country);
      countryDataMap.set("United States of America", country);
    }
    if (country.country === "United Kingdom") {
      countryDataMap.set("UK", country);
      countryDataMap.set("Great Britain", country);
    }
  });

  // Get max value for color scaling
  const maxValue = Math.max(...data.map(d => d[metric]));

  // Create color intensity function
  const getColorIntensity = (value: number) => {
    if (value === 0) return "#e5e7eb";
    const intensity = value / maxValue;
    if (intensity < 0.2) return "#dbeafe";
    if (intensity < 0.4) return "#93c5fd";
    if (intensity < 0.6) return "#60a5fa";
    if (intensity < 0.8) return "#3b82f6";
    return "#1d4ed8";
  };

  const handleCountryHover = (countryCode: string, event: React.MouseEvent) => {
    const countryData = countryDataMap.get(countryCode);
    if (countryData) {
      setHoveredCountry(countryCode);
      setTooltip({
        visible: true,
        content: `${countryData.country}: ${countryData[metric].toLocaleString()} ${metric}`,
        x: event.clientX,
        y: event.clientY
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCountry(null);
    setTooltip({ visible: false, content: '', x: 0, y: 0 });
  };

  // Simple country shapes for major countries with data
  const countryShapes = [
    {
      code: "United States",
      name: "United States",
      path: "M200,120 L350,120 L350,180 L200,180 Z",
      position: { x: 150, y: 120 }
    },
    {
      code: "United Kingdom", 
      name: "United Kingdom",
      path: "M420,100 L450,100 L450,130 L420,130 Z",
      position: { x: 420, y: 100 }
    },
    {
      code: "Canada",
      name: "Canada", 
      path: "M180,80 L370,80 L370,110 L180,110 Z",
      position: { x: 180, y: 80 }
    },
    {
      code: "Germany",
      name: "Germany",
      path: "M460,110 L480,110 L480,130 L460,130 Z", 
      position: { x: 460, y: 110 }
    },
    {
      code: "France",
      name: "France",
      path: "M440,120 L465,120 L465,140 L440,140 Z",
      position: { x: 440, y: 120 }
    },
    {
      code: "Australia",
      name: "Australia", 
      path: "M650,220 L720,220 L720,260 L650,260 Z",
      position: { x: 650, y: 220 }
    },
    {
      code: "Japan",
      name: "Japan",
      path: "M680,130 L700,130 L700,150 L680,150 Z",
      position: { x: 680, y: 130 }
    },
    {
      code: "Brazil",
      name: "Brazil",
      path: "M300,200 L360,200 L360,280 L300,280 Z",
      position: { x: 300, y: 200 }
    },
    {
      code: "India",
      name: "India", 
      path: "M580,160 L610,160 L610,190 L580,190 Z",
      position: { x: 580, y: 160 }
    },
    {
      code: "Spain",
      name: "Spain",
      path: "M420,140 L450,140 L450,160 L420,160 Z",
      position: { x: 420, y: 140 }
    }
  ];

  console.log('WorldMapSVG data:', data);
  console.log('Country data map:', Array.from(countryDataMap.keys()));

  return (
    <div className={`relative ${className}`}>
      <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg border" style={{ height: "320px" }}>
        <svg
          width="100%"
          height="320"
          viewBox="0 0 800 320"
          className="w-full h-full"
        >
          {/* World background */}
          <rect width="800" height="320" fill="#f8fafc" className="dark:fill-slate-800" />
          
          {/* Grid lines for reference */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="0.5" className="dark:stroke-slate-600" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="800" height="320" fill="url(#grid)" />
          
          {/* Country shapes */}
          {countryShapes.map((country) => {
            const countryData = countryDataMap.get(country.name) || countryDataMap.get(country.code);
            const hasData = !!countryData;
            const fillColor = hasData ? getColorIntensity(countryData[metric]) : "#d1d5db";
            
            return (
              <g key={country.code}>
                {/* Country shape */}
                <path
                  d={country.path}
                  fill={fillColor}
                  stroke="#ffffff"
                  strokeWidth="1"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    filter: hoveredCountry === country.code ? "brightness(0.8)" : "none"
                  }}
                  onMouseEnter={(e) => handleCountryHover(country.code, e)}
                  onMouseLeave={handleMouseLeave}
                />
                
                {/* Country label */}
                <text
                  x={country.position.x + 10}
                  y={country.position.y + 25}
                  fontSize="10"
                  fill="#374151"
                  className="dark:fill-slate-300 pointer-events-none font-medium"
                >
                  {country.name}
                </text>
                
                {/* Data display */}
                {hasData && (
                  <text
                    x={country.position.x + 10}
                    y={country.position.y + 38}
                    fontSize="9"
                    fill="#6b7280"
                    className="dark:fill-slate-400 pointer-events-none"
                  >
                    {countryData[metric].toLocaleString()} {metric}
                  </text>
                )}
              </g>
            );
          })}
          
          {/* Title */}
          <text x="400" y="30" textAnchor="middle" fontSize="16" fill="#374151" className="dark:fill-slate-200 font-semibold">
            Active Users by Country
          </text>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed z-50 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltip.x + 10,
            top: tooltip.y - 40,
          }}
        >
          {tooltip.content}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-gray-300 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">No data</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-200 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Low</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-400 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-600 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}