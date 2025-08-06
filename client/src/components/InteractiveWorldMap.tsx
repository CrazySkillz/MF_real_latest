import { useState } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Graticule,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";

// Use a proven working GeoJSON file for react-simple-maps
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

  // Create a map for quick country data lookup with extensive name variations
  const countryDataMap = new Map<string, CountryData>();
  data.forEach(country => {
    // Store all possible variations for each country
    const variations = [country.country];
    
    // Add common variations based on the topojson data format
    if (country.country.includes("United States") || country.country === "USA") {
      variations.push("United States of America", "United States", "USA", "US", "America");
    }
    if (country.country.includes("United Kingdom")) {
      variations.push("United Kingdom", "UK", "Great Britain", "Britain");
    }
    if (country.country === "Germany") {
      variations.push("Germany", "Deutschland");
    }
    if (country.country === "France") {
      variations.push("France", "French Republic");
    }
    if (country.country === "Spain") {
      variations.push("Spain", "Kingdom of Spain");
    }
    if (country.country === "Italy") {
      variations.push("Italy", "Italian Republic");
    }
    if (country.country === "Netherlands") {
      variations.push("Netherlands", "Holland");
    }
    if (country.country === "Brazil") {
      variations.push("Brazil", "Federative Republic of Brazil");
    }
    if (country.country === "Canada") {
      variations.push("Canada");
    }
    if (country.country === "Australia") {
      variations.push("Australia");
    }
    if (country.country === "Japan") {
      variations.push("Japan");
    }
    if (country.country === "India") {
      variations.push("India");
    }
    if (country.country === "Sweden") {
      variations.push("Sweden");
    }
    if (country.country === "Norway") {
      variations.push("Norway");
    }
    if (country.country === "Denmark") {
      variations.push("Denmark");
    }
    if (country.country === "Finland") {
      variations.push("Finland");
    }
    if (country.country === "Belgium") {
      variations.push("Belgium");
    }
    if (country.country === "Switzerland") {
      variations.push("Switzerland");
    }
    if (country.country === "Austria") {
      variations.push("Austria");
    }
    if (country.country === "Portugal") {
      variations.push("Portugal");
    }
    
    // Store data under all variations
    variations.forEach(variation => {
      countryDataMap.set(variation, country);
    });
  });
  
  console.log('🔍 Country data loaded:', data.length, 'countries');
  console.log('🗺️ Data map has', countryDataMap.size, 'entries');
  console.log('📝 Sample countries in our data:', Array.from(countryDataMap.keys()).slice(0, 15));
  console.log('📊 Sample user counts:', data.slice(0, 5).map(d => `${d.country}: ${d.users} users`));
  console.log('🎯 Actual data received:', data);

  // Calculate color scale based on data
  const values = data.map(d => d[metric]);
  const maxValue = Math.max(...values);
  const colorScale = scaleLinear<string>()
    .domain([0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue])
    .range(["#dbeafe", "#93c5fd", "#60a5fa", "#3b82f6", "#1d4ed8"]);
  
  console.log('Color scale domain:', [0, maxValue * 0.25, maxValue * 0.5, maxValue * 0.75, maxValue]);
  console.log('Max value:', maxValue);

  const handleMouseEnter = (event: React.MouseEvent<SVGPathElement>, geo: any) => {
    // Try multiple property names for country identification
    const possibleNames = [
      geo.properties.NAME,
      geo.properties.NAME_EN, 
      geo.properties.NAME_LONG,
      geo.properties.ADMIN,
      geo.properties.name,
      geo.properties.admin
    ];
    
    let countryData = null;
    let countryName = '';
    
    for (const name of possibleNames) {
      if (name && countryDataMap.has(name)) {
        countryData = countryDataMap.get(name);
        countryName = name;
        break;
      }
    }
    
    // Fallback to first available name
    if (!countryName) {
      countryName = possibleNames.find(name => name) || 'Unknown';
    }
    
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
            {({ geographies }: { geographies: any[] }) => {
              console.log('Total geographies loaded:', geographies.length);
              
              // Log geography data structure
              if (geographies.length > 0) {
                console.log('🌍 Total geographies loaded:', geographies.length);
                console.log('🏷️ Sample geography properties:', geographies[0].properties);
                console.log('🌎 First 15 country names from topojson:', geographies.slice(0, 15).map(g => 
                  g.properties.NAME || g.properties.name || g.properties.NAME_EN || 'No name found'
                ));
                
                // Check if USA exists in the data
                const usaGeo = geographies.find(g => {
                  const name = g.properties.NAME || g.properties.name || '';
                  return name.includes('United States') || name.includes('USA') || name === 'United States';
                });
                console.log('🇺🇸 USA geography found:', usaGeo ? usaGeo.properties : 'NOT FOUND');
              }
              
              return geographies.map((geo: any, index: number) => {
                // Try multiple property names for country identification  
                const possibleNames = [
                  geo.properties.name,  // This topojson uses lowercase 'name'
                  geo.properties.NAME,
                  geo.properties.NAME_EN,
                  geo.properties.NAME_LONG,
                  geo.properties.ADMIN,
                  geo.properties.admin
                ].filter(Boolean);
                
                let countryData = null;
                let matchedName = '';
                
                // Try to find data for this country
                for (const name of possibleNames) {
                  if (name && countryDataMap.has(name)) {
                    countryData = countryDataMap.get(name);
                    matchedName = name;
                    break;
                  }
                }
                
                const hasData = !!countryData;
                
                const fillColor = hasData && countryData
                  ? colorScale(countryData[metric]) 
                  : "#e5e7eb";
                
                // Debug logging for matches and first 20 countries
                if (hasData && countryData) {
                  console.log(`✅ MATCH FOUND for country ${index}:`, {
                    geoNames: possibleNames,
                    matchedName,
                    userCount: countryData[metric],
                    fillColor
                  });
                } else if (index < 20) {
                  console.log(`❌ No match for country ${index}:`, {
                    geoNames: possibleNames,
                    ourDataKeys: Array.from(countryDataMap.keys()).slice(0, 5)
                  });
                }
                
                return (
                  <Geography
                    key={geo.rsmKey || Math.random()}
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
                        fill: hasData ? "#1e40af" : "#9ca3af",
                        stroke: "#ffffff",
                        strokeWidth: 1,
                        outline: "none",
                        cursor: hasData ? "pointer" : "default",
                      },
                      pressed: {
                        fill: "#1e40af",
                        stroke: "#ffffff",
                        strokeWidth: 1,
                        outline: "none",
                      },
                    }}
                  />
                );
              });
            }}
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