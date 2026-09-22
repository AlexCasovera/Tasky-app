// @ts-nocheck
import React from 'react';
import ListView from './ListView';

export default function ListAndCompletedViews({
  currentView,
  listScope,
  setListScope,
  getHeaderTitle,
  currentDate,
  getWeekStart,
  daysOfWeek,
  formatDateKey,
  masterCompanyList,
  activeCompanyFilters,
  hiddenCompanies,
  visibleTasks,
  isTaskActiveOnDay,
  isTaskCompletedOnDay,
  backlogTasks,
  userRole,
  handleDragStart,
  handleDragEnd,
  handleOpenModal,
  getPriorityStyle,
  isTaskPastDue,
  isTaskDueToday,
  renderPriorityPill,
  getMemberConfig
}) {
  return (
    <div className="flex-col flex gap-6 overflow-y-auto pr-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${currentView === 'completed' ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            {listScope === 'week' 
              ? (currentView === 'completed' ? 'Completed Tasks Overview' : 'Weekly Overview') 
              : (currentView === 'completed' ? `Completed on ${getHeaderTitle()}` : `Tasks for ${getHeaderTitle()}`)
            }
          </h2>
        </div>
        
        <div className="bg-gray-200 p-0.5 rounded flex items-center border border-gray-300 shadow-inner">
          <button 
            onClick={() => setListScope('day')}
            className={`px-3 py-1 text-[10px] font-bold rounded transition ${listScope === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            Today
          </button>
          <button 
            onClick={() => setListScope('week')}
            className={`px-3 py-1 text-[10px] font-bold rounded transition ${listScope === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            This Week
          </button>
        </div>
      </div>

      {listScope === 'week' ? (
        (() => {
          const start = new Date(currentDate);
          const day = start.getDay();
          const diff = start.getDate() - day + (day === 0 ? -6 : 1);
          start.setDate(diff);
          
          const weekDates = [];
          for(let i=0; i<7; i++) {
            const d = new Date(start);
            d.setDate(d.getDate() + i);
            weekDates.push({ dateStr: formatDateKey(d), dayOfWeekStr: daysOfWeek[d.getDay()] });
          }

          return (
            <>
              {masterCompanyList.filter(c => activeCompanyFilters.includes(c) && !hiddenCompanies.includes(c)).map(company => {
                
                let compWeekTasks = [];
                let compWeekCompleted = [];

                visibleTasks.forEach(t => {
                  if(t.company === company) {
                    weekDates.forEach(wd => {
                      if (isTaskActiveOnDay(t, wd.dayOfWeekStr, wd.dateStr)) {
                        compWeekTasks.push({ ...t, instanceDate: wd.dateStr, instanceDay: wd.dayOfWeekStr });
                      }
                      if (isTaskCompletedOnDay(t, wd.dateStr)) {
                        compWeekCompleted.push({ ...t, instanceDate: wd.dateStr, instanceDay: wd.dayOfWeekStr });
                      }
                    });
                  }
                });

                const priorityScore = { High: 1, Standard: 2 };
                compWeekTasks.sort((a, b) => {
                  if (a.instanceDate !== b.instanceDate) return a.instanceDate.localeCompare(b.instanceDate);
                  return (priorityScore[a.priority] || 5) - (priorityScore[b.priority] || 5);
                });

                compWeekCompleted.sort((a, b) => a.instanceDate.localeCompare(b.instanceDate));
                const compBacklog = backlogTasks.filter(t => t.company === company);

                return (
                  <div key={company} className="flex flex-col gap-4 mb-6">
                    <div className="flex items-center gap-2 mb-1 border-b border-gray-300 pb-2">
                      <span className="w-3 h-3 rounded-sm bg-[#333333]"></span>
                      <h2 className="text-lg font-serif font-bold text-gray-800 tracking-wide">{company}</h2>
                    </div>
                    
                    {currentView === 'list' && (
                      <ListView 
                        company={company}
                        compBacklog={compBacklog}
                        compWeekTasks={compWeekTasks}
                        userRole={userRole}
                        handleDragStart={handleDragStart}
                        handleDragEnd={handleDragEnd}
                        handleOpenModal={handleOpenModal}
                        formatDateKey={formatDateKey}
                        currentDate={currentDate}
                        getPriorityStyle={getPriorityStyle}
                        isTaskPastDue={isTaskPastDue}
                        isTaskDueToday={isTaskDueToday}
                        renderPriorityPill={renderPriorityPill}
                        getMemberConfig={getMemberConfig}
                      />
                    )}

                    {currentView === 'completed' && (
                      <div className="flex flex-col gap-2">
                        {compWeekCompleted.length > 0 ? (
                          compWeekCompleted.map(task => (
                            <div 
                              key={`${task.id}-comp-${task.instanceDate}`}
                              onClick={() => handleOpenModal(task, task.instanceDate)}
                              className="bg-gray-200/60 p-2.5 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-200 transition gap-2">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="flex flex-col items-center justify-center bg-gray-300/50 rounded px-2 py-0.5 min-w-[40px] shrink-0">
                                  <span className="text-[8px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                                  <span className="text-xs font-bold text-gray-600">{task.instanceDate.split('-')[2]}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="line-through text-xs font-bold text-gray-600 block truncate">{task.title}</span>
                                  <span className="text-[10px] text-gray-500">Assigned to: {(task.assignees || []).join(', ')}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full border border-green-300 self-end sm:self-auto shrink-0">
                                ✓ Completed
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="bg-white p-6 rounded text-center border border-dashed border-gray-300">
                            <p className="text-sm text-gray-500 font-bold">No completed tasks for {company} this week.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          );
        })()
      ) : (
        <div>
          {currentView === 'list' && (
            <div className="flex flex-col gap-3">
              {visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate))).length > 0 ? (
                visibleTasks
                  .filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], formatDateKey(currentDate)))
                  .map(task => {
                    const style = getPriorityStyle(task.priority);
                    const isPastDue = isTaskPastDue(task);
                    const isDueToday = !isPastDue && isTaskDueToday(task, formatDateKey(currentDate));

                    let borderClass = style.border;
                    let bgClass = "bg-white";
                    if (isPastDue) {
                      borderClass = "border-red-600 ring-1 ring-red-400";
                      bgClass = "bg-red-50/50";
                    } else if (isDueToday) {
                      borderClass = "border-amber-500 ring-1 ring-amber-400";
                      bgClass = "bg-amber-50/20";
                    }

                    return (
                      <div 
                        key={task.id}
                        onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                        className={`${bgClass} p-3 sm:p-4 rounded border-l-4 ${borderClass} shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-50 transition gap-3 sm:gap-0`}>
                        <div className="w-full sm:w-2/3 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                          <span className="font-mono text-[10px] sm:text-sm font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200 shrink-0 self-start sm:self-auto">{task.timeLabel}</span>
                          <div className="min-w-0 w-full">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-base sm:text-lg truncate">{task.title}</h3>
                              <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                              {task.recurrenceType === 'completion' && <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">🔄 Interval</span>}
                            </div>
                            <p className="text-xs sm:text-sm text-gray-500 truncate">{task.desc}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-gray-100 mt-1 sm:mt-0">
                          
                          {renderPriorityPill(task, formatDateKey(currentDate))}

                          <div className="flex -space-x-2">
                            {(task.assignees || []).map((a, idx) => {
                              const m = getMemberConfig(a);
                              return (
                                <div key={idx} style={{ backgroundColor: m.color }} className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-xs text-white shadow-sm font-bold">
                                  {m.initials}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })
              ) : (
                <div className="bg-white p-8 rounded text-center border border-dashed border-gray-300">
                  <p className="text-sm text-gray-500 font-bold">No active tasks scheduled for this date.</p>
                </div>
              )}
            </div>
          )}

          {currentView === 'completed' && (
            <div className="flex flex-col gap-2 mt-2">
              {visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).length > 0 ? (
                visibleTasks.filter(t => isTaskCompletedOnDay(t, formatDateKey(currentDate))).map(task => (
                  <div 
                    key={task.id} 
                    onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                    className="bg-gray-200/60 p-3 rounded flex flex-col sm:flex-row justify-between items-start sm:items-center cursor-pointer hover:bg-gray-200 transition gap-2">
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="min-w-0 flex-1">
                        <span className="line-through text-sm font-bold text-gray-600 block truncate">{task.title}</span>
                        <span className="text-[9px] bg-gray-300 text-gray-600 px-1 py-0.5 rounded inline-block mt-0.5">{task.company}</span>
                      </div>
                      <span className="text-xs text-gray-500 sm:ml-4">Assigned to: {(task.assignees || []).join(', ')}</span>
                    </div>
                    <span className="text-xs font-bold text-green-700 bg-green-100 px-2.5 py-1 rounded-full border border-green-300 self-end sm:self-auto shrink-0">
                      ✓ Completed
                    </span>
                  </div>
                ))
              ) : (
                <div className="bg-white p-8 rounded text-center border border-dashed border-gray-300">
                  <p className="text-sm text-gray-500 font-bold">No tasks completed on this date.</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}