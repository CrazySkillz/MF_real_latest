import { useState } from "react";

interface CountryData {
  country: string;
  users: number;
  sessions: number;
}

interface SimpleGeographicMapProps {
  data: CountryData[];
  metric: 'users' | 'sessions';
  className?: string;
}

export default function SimpleGeographicMap({ 
  data, 
  metric = 'users', 
  className = "" 
}: SimpleGeographicMapProps) {
  const [hoveredCountry, setHoveredCountry] = useState<string | null>(null);

  // Get max value for color scaling
  const maxValue = Math.max(...data.map(d => d[metric]));

  // Create color intensity function
  const getColorIntensity = (value: number) => {
    const intensity = value / maxValue;
    if (intensity === 0) return "bg-gray-100 dark:bg-gray-800";
    if (intensity < 0.2) return "bg-blue-100 dark:bg-blue-900/30";
    if (intensity < 0.4) return "bg-blue-200 dark:bg-blue-800/50";
    if (intensity < 0.6) return "bg-blue-300 dark:bg-blue-700/70";
    if (intensity < 0.8) return "bg-blue-400 dark:bg-blue-600/80";
    return "bg-blue-500 dark:bg-blue-500";
  };

  // Simple world regions representation
  const worldRegions = [
    { name: "North America", countries: ["United States", "Canada", "Mexico"], position: "top-left" },
    { name: "Europe", countries: ["United Kingdom", "Germany", "France", "Spain", "Italy", "Netherlands", "Sweden", "Norway", "Denmark", "Finland", "Belgium", "Switzerland", "Austria", "Portugal"], position: "top-center" },
    { name: "Asia", countries: ["Japan", "China", "India", "South Korea", "Singapore", "Thailand"], position: "top-right" },
    { name: "South America", countries: ["Brazil", "Argentina", "Chile", "Colombia"], position: "bottom-left" },
    { name: "Africa", countries: ["South Africa", "Nigeria", "Kenya", "Egypt"], position: "bottom-center" },
    { name: "Oceania", countries: ["Australia", "New Zealand"], position: "bottom-right" }
  ];

  // Create a map for quick lookup
  const countryDataMap = new Map(data.map(item => [item.country, item]));

  const getRegionIntensity = (countries: string[]) => {
    const totalValue = countries.reduce((sum, country) => {
      const countryData = countryDataMap.get(country);
      return sum + (countryData ? countryData[metric] : 0);
    }, 0);
    return getColorIntensity(totalValue);
  };

  const getPositionClasses = (position: string) => {
    const baseClasses = "absolute w-24 h-16 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer transition-all duration-200 hover:border-blue-500 hover:scale-105";
    
    switch (position) {
      case "top-left": return `${baseClasses} top-4 left-8`;
      case "top-center": return `${baseClasses} top-4 left-1/2 transform -translate-x-1/2`;
      case "top-right": return `${baseClasses} top-4 right-8`;
      case "bottom-left": return `${baseClasses} bottom-4 left-8`;
      case "bottom-center": return `${baseClasses} bottom-4 left-1/2 transform -translate-x-1/2`;
      case "bottom-right": return `${baseClasses} bottom-4 right-8`;
      default: return baseClasses;
    }
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative w-full h-80 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* World regions as colored rectangles */}
        {worldRegions.map((region) => {
          const regionData = region.countries.map(country => countryDataMap.get(country)).filter(Boolean);
          const totalUsers = regionData.reduce((sum, item) => sum + (item?.users || 0), 0);
          const totalSessions = regionData.reduce((sum, item) => sum + (item?.sessions || 0), 0);
          const regionIntensity = getRegionIntensity(region.countries);

          return (
            <div
              key={region.name}
              className={`${getPositionClasses(region.position)} ${regionIntensity}`}
              onMouseEnter={() => setHoveredCountry(region.name)}
              onMouseLeave={() => setHoveredCountry(null)}
            >
              <div className="flex flex-col items-center justify-center h-full text-xs font-medium text-slate-700 dark:text-slate-200">
                <div className="text-center">
                  <div className="font-semibold">{region.name}</div>
                  <div className="text-xs mt-1">
                    {totalUsers > 0 && (
                      <div>{totalUsers.toLocaleString()} users</div>
                    )}
                    {totalSessions > 0 && (
                      <div className="text-slate-500 dark:text-slate-400">{totalSessions.toLocaleString()} sessions</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Central title */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="text-lg font-semibold text-slate-400 dark:text-slate-500 mb-2">
            World Map View
          </div>
          <div className="text-sm text-slate-500 dark:text-slate-400">
            {data.length} countries tracked
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-4">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-gray-100 dark:bg-gray-800 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">No data</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-200 dark:bg-blue-800/50 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Low</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-400 dark:bg-blue-600/80 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">Medium</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-4 h-3 bg-blue-500 dark:bg-blue-500 border border-gray-300"></div>
            <span className="text-xs text-slate-600 dark:text-slate-400">High</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip */}
      {hoveredCountry && (
        <div className="absolute top-2 left-2 bg-slate-900 text-white px-3 py-2 rounded-lg text-sm z-10">
          {hoveredCountry} Region
        </div>
      )}
    </div>
  );
}