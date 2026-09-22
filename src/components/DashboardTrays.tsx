// @ts-nocheck
import React from 'react';

export default function DashboardTrays({
  userRole,
  currentView,
  overdueTasks,
  getMissedDate,
  handleOpenModal,
  renderPriorityPill,
  getMemberConfig,
  longTermTasks,
  resizingTaskId,
  handleDragStart,
  handleDragEnd,
  formatDateKey,
  currentDate,
  isTaskPastDue,
  backlogTasks,
  listScope
}) {
  return (
    <>
      {/* 🚨 GLOBAL OVERDUE ALERT TRAY 🚨 */}
      {overdueTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (
        <div className="bg-red-50 border-2 border-red-500 rounded-lg p-3 mb-4 shadow-sm animate-fade-in">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-800 flex items-center gap-2">
              🚨 Past Due Tasks ({overdueTasks.length} Action Required)
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {overdueTasks.map(task => {
              const missedDate = getMissedDate(task);
              return (
                <div 
                  key={`overdue-${task.id}`}
                  onClick={() => handleOpenModal(task, missedDate)}
                  className="bg-white px-3 py-2 rounded border border-red-300 text-xs font-bold text-gray-800 cursor-pointer hover:bg-red-100 transition shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-l-4 border-l-red-600">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <span className="text-[10px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono border border-red-200 shrink-0">Due: {missedDate}</span>
                    <span className="truncate text-sm">{task.title}</span>
                    <span className="text-[9px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded shrink-0">{task.company}</span>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                    {renderPriorityPill(task, missedDate)}
                    <div className="flex -space-x-1.5">
                      {(task.assignees || []).map((a, idx) => {
                        const m = getMemberConfig(a);
                        return (
                          <div key={idx} style={{ backgroundColor: m.color }} className="w-6 h-6 rounded-full border border-white flex items-center justify-center text-[9px] text-white shadow-sm font-bold">
                            {m.initials}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LONG-TERM PIPELINE TRAY */}
      {(userRole === 'admin' || userRole === 'employee') && longTermTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (
        <div className="bg-blue-50 border border-blue-300 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-2">
              📌 Long-Term & Pipeline Tasks ({longTermTasks.length} Active)
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {longTermTasks.map(task => {
              const isOverdue = isTaskPastDue(task);
              return (
                <div 
                  key={`lt-${task.id}`}
                  draggable={userRole === 'admin' && !resizingTaskId}
                  onDragStart={(e) => handleDragStart(e, task.id, task.date)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                  className={`px-3 py-1.5 rounded border text-xs font-bold transition shadow-2xs flex items-center gap-2 ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} ${isOverdue ? 'border-red-500 ring-1 ring-red-400 bg-red-50 text-red-900 hover:bg-red-100' : 'bg-white border-blue-200 text-gray-800 hover:bg-blue-100'}`}>
                  <span>{task.title}</span>
                  <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                  {task.date && <span className={`text-[10px] px-1.5 py-0.5 rounded border ${isOverdue ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>Due: {task.date}</span>}
                  {(!task.assignees || task.assignees.length === 0) && <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* UNASSIGNED BACKLOG TRAY */}
      {userRole === 'admin' && backlogTasks.length > 0 && currentView !== 'create' && currentView !== 'completed' && (currentView !== 'list' || listScope === 'day') && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              📥 Unassigned Task Backlog ({backlogTasks.length} Drafts Waiting)
            </span>
            <span className="text-[10px] text-amber-700 italic">Click task to assign team members</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {backlogTasks.map(task => (
              <div 
                key={task.id}
                draggable={userRole === 'admin' && !resizingTaskId}
                onDragStart={(e) => handleDragStart(e, task.id, task.date)}
                onDragEnd={handleDragEnd}
                onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                className="bg-white px-3 py-1.5 rounded border border-amber-200 text-xs font-bold text-gray-800 cursor-grab active:cursor-grabbing hover:bg-amber-100 transition shadow-2xs flex items-center gap-2">
                <span>{task.title}</span>
                <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}