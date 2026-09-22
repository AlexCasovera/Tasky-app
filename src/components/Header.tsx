// @ts-nocheck
import React, { useRef, useEffect } from 'react';

export default function Header({
  currentProfile,
  session,
  userRole,
  searchRef,
  searchQuery,
  isSearchFocused,
  setIsSearchFocused,
  setSearchQuery,
  hasSearchResults,
  searchResults,
  handleOpenModal,
  formatDateKey,
  setActiveCompanyFilters,
  setActiveEmployeeFilters,
  handleLogout,
  handlePrevDate,
  handleToday,
  handleNextDate,
  getHeaderTitle,
  currentView,
  setCurrentView,
  isNotifOpen,
  setIsNotifOpen,
  unreadNotifCount,
  markAllNotifsRead,
  notifications,
  handleNotificationClick,
  currentUserName,
  resetMemberForm,
  setIsSettingsOpen,
  handleOpenCreateView
}) {
    
    const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [setIsNotifOpen]);

  return (
    <>
      {/* REAL USER SESSION HEADER WITH HCP GLOBAL SEARCH */}
      <div className="bg-[#333333] text-white px-4 py-2 rounded-md mb-4 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs shadow-md z-40 relative">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-400 uppercase tracking-wider">User:</span>
          <span className="text-white font-semibold">{currentProfile?.name || session?.user?.email}</span>
          <span className="text-gray-500">|</span>
          <span className="font-bold text-gray-400 uppercase tracking-wider">Role:</span>
          <span className="text-amber-400 font-bold uppercase">{userRole}</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          
          {/* HCP OVERLAY SEARCH INPUT & DROPDOWN */}
          <div className="relative w-full sm:w-80" ref={searchRef}>
            <div className="flex items-center bg-gray-800 rounded border border-gray-700 focus-within:border-[#A9B1A6] px-2.5 py-1">
              <span className="text-gray-400 mr-2 text-xs">🔍</span>
              <input 
                type="text" 
                value={searchQuery}
                onFocus={() => setIsSearchFocused(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsSearchFocused(true);
                }}
                placeholder="Search jobs, companies, notes..." 
                className="bg-transparent text-white placeholder-gray-400 text-xs focus:outline-none w-full" 
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setIsSearchFocused(false); }} className="text-gray-400 hover:text-white font-bold text-xs ml-1">✕</button>
              )}
            </div>

            {/* HCP STYLE OVERLAY DROPDOWN PANEL */}
            {isSearchFocused && searchQuery.trim().length > 0 && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-lg shadow-2xl border border-gray-300 text-gray-800 z-50 overflow-hidden animate-fade-in max-h-96 overflow-y-auto">
                {hasSearchResults ? (
                  <div className="flex flex-col">
                    
                    {/* TASKS SECTION */}
                    {searchResults.tasks.length > 0 && (
                      <div className="p-2 border-b border-gray-100">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">📋 Jobs & Tasks</span>
                        {searchResults.tasks.map(task => (
                          <div 
                            key={task.id}
                            onClick={() => {
                              handleOpenModal(task, task.date || formatDateKey(new Date()));
                              setIsSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className={`p-2 rounded cursor-pointer transition flex items-center justify-between group ${task.isSearchCompleted ? 'hover:bg-gray-100 opacity-60' : 'hover:bg-blue-50'}`}
                          >
                            <div className="min-w-0 pr-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-bold text-xs group-hover:text-blue-600 truncate ${task.isSearchCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                  {task.title}
                                </span>
                                <span className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold shrink-0">{task.company}</span>
                                {task.isSearchCompleted && <span className="text-[8px] bg-green-100 text-green-700 font-bold px-1 rounded">✓ Done</span>}
                              </div>
                              <p className="text-[10px] text-gray-500 truncate mt-0.5">{task.desc}</p>
                            </div>
                            <span className="text-[10px] font-mono text-gray-400 shrink-0">{task.date || 'Unscheduled'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* COMPANIES SECTION */}
                    {searchResults.companies.length > 0 && (
                      <div className="p-2 border-b border-gray-100 bg-gray-50/50">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">🏢 Companies</span>
                        {searchResults.companies.map(comp => (
                          <div 
                            key={comp}
                            onClick={() => {
                              setActiveCompanyFilters([comp]);
                              setIsSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className="p-1.5 hover:bg-gray-200/60 rounded cursor-pointer transition flex items-center justify-between text-xs font-bold text-gray-700"
                          >
                            <span>{comp}</span>
                            <span className="text-[9px] text-blue-600 font-semibold">Filter Dashboard →</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* TEAM MEMBERS SECTION */}
                    {searchResults.members.length > 0 && (
                      <div className="p-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-2 block mb-1">👤 Team Members</span>
                        {searchResults.members.map(member => (
                          <div 
                            key={member.id}
                            onClick={() => {
                              setActiveEmployeeFilters([member.name]);
                              setIsSearchFocused(false);
                              setSearchQuery('');
                            }}
                            className="p-1.5 hover:bg-gray-100 rounded cursor-pointer transition flex items-center justify-between"
                          >
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: member.color }}></span>
                              <span className="font-bold text-xs text-gray-800">{member.name}</span>
                            </div>
                            <span className="text-[9px] text-gray-400">{member.email}</span>
                          </div>
                        ))}
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="p-4 text-center text-xs text-gray-400 italic">
                    No results found for "{searchQuery}"
                  </div>
                )}
              </div>
            )}
          </div>

          <button 
            onClick={handleLogout} 
            className="px-3 py-1 font-bold text-white transition bg-red-600 rounded hover:bg-red-700 shrink-0"
          >
            Logout
          </button>
        </div>
      </div>

      {/* CONTROLS HEADER */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 bg-white border border-gray-300 rounded-lg p-1 shadow-2xs">
            <button onClick={handlePrevDate} className="px-2.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition">‹</button>
            <button onClick={handleToday} className="px-3 py-1 text-xs font-bold text-gray-700 hover:bg-gray-100 rounded transition border-x border-gray-200">Today</button>
            <button onClick={handleNextDate} className="px-2.5 py-1 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded transition">›</button>
          </div>

          <div>
            <h1 className="text-2xl font-serif font-bold text-gray-900 leading-tight">{getHeaderTitle()}</h1>
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider">Command Center Queue</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-gray-200 p-1 rounded-lg flex items-center gap-1 border border-gray-300">
            <button onClick={() => setCurrentView('completed')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'completed' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Completed</button>
            <button onClick={() => setCurrentView('list')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>List</button>
            <button onClick={() => setCurrentView('day')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Day</button>
            <button onClick={() => setCurrentView('week')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Week</button>
            <button onClick={() => setCurrentView('month')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${currentView === 'month' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>Month</button>
          </div>

          <div className="relative" ref={notifRef}>
            <button 
              onClick={() => setIsNotifOpen(!isNotifOpen)}
              className="bg-white p-2 rounded-lg border border-gray-300 relative hover:bg-gray-50 transition">
              🔔
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                  {unreadNotifCount}
                </span>
              )}
            </button>

            {isNotifOpen && (
              <div className="absolute -left-[4px] sm:left-auto sm:right-0 mt-2 w-72 sm:w-80 bg-white rounded-lg shadow-xl border border-gray-300 z-50 p-3 animate-fade-in">
                <div className="flex justify-between items-center border-b pb-2 mb-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700">Notification Center</h4>
                  <button onClick={markAllNotifsRead} className="text-[10px] text-blue-600 font-bold hover:underline">Mark all read</button>
                </div>
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto pr-1">
                  {notifications.map(n => (
                    <div 
                      key={n.id} 
                      onClick={() => handleNotificationClick(n)}
                      className={`p-2 rounded text-xs border cursor-pointer hover:brightness-95 transition ${n.read ? 'bg-gray-50 border-gray-200 text-gray-500' : 'bg-blue-50 border-blue-200 text-blue-900 shadow-2xs font-bold'}`}>
                      <div className="flex justify-between items-start gap-2">
                        <span className="leading-tight">{n.text}</span>
                        <span className={`text-[9px] shrink-0 ${n.read ? 'text-gray-400' : 'text-blue-500 font-bold'}`}>{n.time}</span>
                      </div>
                      {n.taskId && (
                        <div className="mt-1 text-[9px] text-gray-400 font-bold uppercase">
                          Click to View ↗
                        </div>
                      )}
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <p className="text-xs text-gray-400 italic text-center py-2">No notifications for {currentUserName}.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          <button 
            onClick={() => { resetMemberForm(); setIsSettingsOpen(true); }}
            className="bg-white p-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition font-bold text-sm"
            title="Settings & Preferences">
            ⚙️
          </button>

          {userRole === 'admin' && currentView !== 'create' && (
            <button onClick={handleOpenCreateView} className="bg-[#5B7049] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-[#465638] transition">
              + New Task
            </button>
          )}
        </div>
      </div>
    </>
  );
}