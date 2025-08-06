import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

// World map topology URL (TopoJSON format)
const geoUrl = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface CountryData {
  country: string;
  users: number;
  sessions: number;
  countryCode?: string;
}

interface InteractiveWorldMapProps {
  data: CountryData[];
  metric: 'users' | 'sessions';
  className?: string;
}

// Country name mapping for better matching
const countryNameMap: Record<string, string> = {
  "United States": "United States of America",
  "UK": "United Kingdom",
  "Russia": "Russian Federation",
  "South Korea": "Republic of Korea",
  "North Korea": "Democratic People's Republic of Korea",
  "Iran": "Islamic Republic of Iran",
  "Syria": "Syrian Arab Republic",
  "Venezuela": "Bolivarian Republic of Venezuela",
  "Bolivia": "Plurinational State of Bolivia",
  "Tanzania": "United Republic of Tanzania",
  "Moldova": "Republic of Moldova",
  "Macedonia": "North Macedonia",
  "Congo": "Republic of the Congo",
  "Democratic Republic of Congo": "Democratic Republic of the Congo",
  "Czech Republic": "Czechia",
};

export default function InteractiveWorldMap({ 
  data, 
  metric = 'users', 
  className = "" 
}: InteractiveWorldMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);
  const [tooltipContent, setTooltipContent] = useState<CountryData | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Create a map for quick country data lookup
  const countryDataMap = new Map<string, CountryData>();
  data.forEach(country => {
    const normalizedName = countryNameMap[country.country] || country.country;
    countryDataMap.set(normalizedName, country);
    countryDataMap.set(country.country, country); // Also store original name
    
    // Add additional mappings for common variations
    if (country.country === "United States of America") {
      countryDataMap.set("United States", country);
      countryDataMap.set("USA", country);
    }
    if (country.country === "United Kingdom") {
      countryDataMap.set("UK", country);
    }
  });
  
  // Debug the data mapping
  console.log('Country data map keys:', Array.from(countryDataMap.keys()));
  console.log('Sample data:', data.slice(0, 3));

  // Calculate color scale based on data
  const values = data.map(d => d[metric]);
  const maxValue = Math.max(...values);
  const colorScale = scaleLinear<string>()
    .domain([0, maxValue])
    .range(["#f3f4f6", "#1d4ed8"]); // Light gray to blue

  const handleMouseEnter = (event: React.MouseEvent<SVGPathElement>, geo: any) => {
    const countryName = geo.properties.NAME || geo.properties.NAME_EN || geo.properties.NAME_LONG;
    const countryData = countryDataMap.get(countryName) || 
                       countryDataMap.get(geo.properties.NAME_LONG) ||
                       countryDataMap.get(geo.properties.NAME_EN);
    
    console.log('Country hover:', countryName, 'Properties:', geo.properties, 'Data found:', !!countryData);
    
    setHoveredCountry(countryName);
    if (countryData) {
      setTooltipContent(countryData);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  const handleMouseLeave = () => {
    setHoveredCountry(null);
    setTooltipContent(null);
  };

  const handleMouseMove = (event: React.MouseEvent<SVGPathElement>) => {
    if (tooltipContent) {
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="w-full bg-gray-50 dark:bg-gray-900 rounded-lg flex items-center justify-center" style={{ height: "320px" }}>
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{
            scale: 100,
            center: [0, 20]
          }}
          width={800}
          height={320}
        >
          <Geographies geography={geoUrl}>
            {({ geographies }: { geographies: any[] }) =>
              geographies.map((geo: any) => {
                const countryName = geo.properties.NAME || geo.properties.NAME_EN || geo.properties.NAME_LONG;
                const countryData = countryDataMap.get(countryName) || 
                                   countryDataMap.get(geo.properties.NAME_LONG) ||
                                   countryDataMap.get(geo.properties.NAME_EN);
                const hasData = !!countryData;
                
                // Debug logging for first few countries
                if (geo.rsmKey && parseInt(geo.rsmKey) < 5) {
                  console.log(`Country ${geo.rsmKey}:`, {
                    NAME: geo.properties.NAME,
                    NAME_EN: geo.properties.NAME_EN,
                    NAME_LONG: geo.properties.NAME_LONG,
                    hasData,
                    countryName
                  });
                }
                const fillColor = hasData 
                  ? colorScale(countryData[metric]) 
                  : "#d1d5db";
                
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onMouseEnter={(event: any) => handleMouseEnter(event, geo)}
                    onMouseLeave={handleMouseLeave}
                    onMouseMove={handleMouseMove}
                    style={{
                      default: {
                        fill: fillColor,
                        stroke: "#ffffff",
                        strokeWidth: 0.5,
                        outline: "none",
                      },
                      hover: {
                        fill: hasData ? "#1d4ed8" : "#9ca3af",
                        stroke: "#ffffff",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: hasData ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "#1d4ed8",
                        stroke: "#ffffff",
                        strokeWidth: 1,
                        outline: "none",
                      },
                    }}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      {/* Tooltip */}
      {tooltipContent && (
        <div
          className="fixed z-50 px-3 py-2 bg-slate-900 text-white text-sm rounded-lg shadow-lg pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y - 40,
            transform: "translateY(-100%)"
          }}
        >
          <div className="font-semibold">{tooltipContent.country}</div>
          <div className="text-slate-300">
            {metric === 'users' ? 'Users' : 'Sessions'}: {tooltipContent[metric].toLocaleString()}
          </div>
          {metric === 'users' && (
            <div className="text-slate-400 text-xs">
              Sessions: {tooltipContent.sessions.toLocaleString()}
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-gray-100 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">No data</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className="w-4 h-3 border border-gray-300"
              style={{ backgroundColor: colorScale(maxValue * 0.2) }}
            ></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Low</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className="w-4 h-3 border border-gray-300"
              style={{ backgroundColor: colorScale(maxValue * 0.6) }}
            ></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <div 
              className="w-4 h-3 border border-gray-300"
              style={{ backgroundColor: colorScale(maxValue) }}
            ></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">High</span>
          </div>
        </div>
      </div>
    </div>
  );
}