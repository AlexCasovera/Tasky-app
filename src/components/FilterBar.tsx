// @ts-nocheck
import React from 'react';

export default function FilterBar({
  currentView,
  masterCompanyList,
  hiddenCompanies,
  activeCompanyFilters,
  toggleCompanyFilter,
  userRole,
  teamMembers,
  hiddenMembers,
  activeEmployeeFilters,
  toggleEmployeeFilter,
  setActiveCompanyFilters,
  setActiveEmployeeFilters
}) {
  if (currentView === 'create') return null;

  return (
    <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shadow-2xs">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Companies:</span>
          <div className="flex flex-wrap gap-1">
            {masterCompanyList.filter(c => !hiddenCompanies.includes(c)).map(comp => {
              const isActive = activeCompanyFilters.includes(comp);
              return (
                <button
                  key={comp}
                  onClick={() => toggleCompanyFilter(comp)}
                  className={`text-xs px-2.5 py-1 rounded-md font-bold border transition ${
                    isActive ? 'bg-[#333333] text-white border-[#333333] shadow-2xs' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                  }`}>
                  {comp}
                </button>
              );
            })}
          </div>
        </div>

        {userRole === 'admin' && (
          <div className="flex items-center gap-2 border-l border-gray-200 pl-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Team:</span>
            <div className="flex flex-wrap gap-1">
              {teamMembers.filter(m => !hiddenMembers.includes(m.name)).map(m => {
                const isActive = activeEmployeeFilters.includes(m.name);
                return (
                  <button
                    key={m.id}
                    onClick={() => toggleEmployeeFilter(m.name)}
                    className={`text-xs px-2.5 py-1 rounded-full font-bold border transition flex items-center gap-1.5 ${
                      isActive ? 'bg-white shadow-2xs border-gray-300 text-gray-800' : 'bg-gray-100 text-gray-400 border-gray-200 line-through'
                    }`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }}></span>
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <button 
        onClick={() => {
          setActiveCompanyFilters([...masterCompanyList]);
          if (userRole === 'admin') setActiveEmployeeFilters(teamMembers.map(m => m.name));
        }} 
        className="text-[11px] font-bold text-[#A9B1A6] hover:underline self-end md:self-center">
        Reset All Filters
      </button>
    </div>
  );
}