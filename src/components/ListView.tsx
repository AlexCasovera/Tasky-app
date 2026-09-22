// @ts-nocheck
import React from 'react';

export default function ListView({
  company,
  compBacklog,
  compWeekTasks,
  userRole,
  handleDragStart,
  handleDragEnd,
  handleOpenModal,
  formatDateKey,
  currentDate,
  getPriorityStyle,
  isTaskPastDue,
  isTaskDueToday,
  renderPriorityPill,
  getMemberConfig
}) {
  return (
    <>
      {userRole === 'admin' && compBacklog.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-2">
          <div className="flex justify-between items-center mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-2">
              📋 Unassigned Backlog ({compBacklog.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {compBacklog.map(task => (
              <div
                key={task.id}
                draggable={userRole === 'admin'}
                onDragStart={(e) => handleDragStart(e, task.id, task.date)}
                onDragEnd={handleDragEnd}
                onClick={() => handleOpenModal(task, formatDateKey(currentDate))}
                className="bg-white px-3 py-1.5 rounded border border-amber-200 text-xs font-bold text-gray-800 cursor-grab flex items-center gap-2 shadow-2xs"
              >
                <span>{task.title}</span>
                <span className="text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Unassigned</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {compWeekTasks.map(task => {
          const style = getPriorityStyle(task.priority);
          const isPastDue = isTaskPastDue(task);
          const isDueToday = !isPastDue && isTaskDueToday(task, task.instanceDate);

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
              key={`${task.id}-${task.instanceDate}`}
              onClick={() => handleOpenModal(task, task.instanceDate)}
              className={`${bgClass} p-3 rounded border-l-4 ${borderClass} shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer hover:shadow-md transition`}
            >
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 w-full sm:w-2/3">
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded px-2.5 py-1 min-w-[50px] border border-gray-200">
                  <span className="text-[9px] font-bold text-gray-500 uppercase">{task.instanceDay}</span>
                  <span className="text-sm font-bold text-gray-800">{task.instanceDate.split('-')[2]}</span>
                </div>

                <span className="font-mono text-xs font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded border border-gray-200">
                  {task.timeLabel || 'All-Day'}
                </span>

                <div className="truncate pr-2 w-full">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-sm truncate">{task.title}</h3>
                    {task.company && <span className="text-[9px] bg-gray-200 text-gray-700 px-1 py-0.5 rounded">{task.company}</span>}
                    {task.recurrenceType === 'completion' && <span className="text-[9px] bg-purple-100 text-purple-800 font-bold px-1.5 py-0.5 rounded">Multi-Step</span>}
                  </div>
                  <p className="text-[11px] text-gray-500 truncate">{task.desc}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                {renderPriorityPill(task, task.instanceDate)}

                <div className="flex -space-x-1.5">
                  {(task.assignees || []).map((a, idx) => {
                    const m = getMemberConfig(a);
                    return (
                      <div key={idx} style={{ backgroundColor: m.color }} className="w-6 h-6 rounded-full border border-white text-white font-bold text-[10px] flex items-center justify-center shadow-2xs" title={m.name}>
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

      {compWeekTasks.length === 0 && (userRole !== 'admin' || compBacklog.length === 0) && (
        <div className="bg-white p-6 rounded text-center border border-dashed border-gray-300">
          <p className="text-sm text-gray-500 font-bold">No active tasks scheduled for {company} this week.</p>
        </div>
      )}
    </>
  );
}