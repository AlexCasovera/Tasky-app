// @ts-nocheck
import React from 'react';

export default function MonthView({
  daysOfWeek,
  currentDate,
  formatDateKey,
  visibleTasks,
  isTaskActiveOnDay,
  isTaskCompletedOnDay,
  handleDragOver,
  handleDropSlot,
  getMemberConfig,
  userRole,
  resizingTaskId,
  handleDragStart,
  handleDragEnd,
  handleOpenModal,
  isTaskPastDue
}) {
  return (
    <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300 text-center py-2 text-xs font-bold text-gray-600">
        {daysOfWeek.map(d => <div key={d}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-5 flex-1 divide-x divide-y divide-gray-200 min-h-[550px]">
        {Array.from({ length: 35 }).map((_, i) => {
          const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const startDay = firstOfMonth.getDay();
          const cellDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1 - startDay + i);
          
          const isCurrentMonthCell = cellDate.getMonth() === currentDate.getMonth();
          const dateStr = formatDateKey(cellDate);
          const dayOfWeekStr = daysOfWeek[cellDate.getDay()];
          const isTodayCell = dateStr === formatDateKey(new Date());

          const pendingDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayOfWeekStr, dateStr));
          const completedDayTasks = visibleTasks.filter(t => isTaskCompletedOnDay(t, dateStr));

          return (
            <div 
              key={i} 
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropSlot(e, dateStr, null, null, false)}
              className={`p-1.5 flex flex-col transition hover:bg-blue-50/20 ${isCurrentMonthCell ? 'bg-white' : 'bg-gray-100/50 text-gray-400'}`}>
              <span className={`text-xs font-bold p-1 ${isTodayCell ? 'bg-[#A9B1A6] text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                {cellDate.getDate()}
              </span>
              <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-24">
                {pendingDayTasks.map(task => {
                  const member = getMemberConfig(task.assignees && task.assignees[0]);
                  return (
                    <div 
                      key={`${task.id}-${dateStr}`} 
                      draggable={userRole === 'admin' && !resizingTaskId}
                      onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenModal(task, dateStr)}
                      style={{ backgroundColor: member.color }}
                      className={`text-white text-[10px] font-semibold p-1 rounded truncate ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 shadow-2xs flex items-center justify-between ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''} ${isCurrentMonthCell ? 'opacity-100' : 'opacity-40 grayscale'}`}>
                      <span className="truncate">{task.title}</span>
                      <div className="flex items-center gap-0.5">
                        {isTaskPastDue(task) && <span className="text-[8px] bg-red-600 px-0.5 rounded font-bold">!</span>}
                        {task.recurrenceType === 'completion' && <span className="text-[8px] bg-black/20 px-0.5 rounded">🔄</span>}
                        {task.recurrenceType === 'fixed' && <span className="text-[8px] bg-black/20 px-0.5 rounded font-mono">↻</span>}
                      </div>
                    </div>
                  );
                })}

                {completedDayTasks.map(task => (
                  <div 
                    key={`completed-${task.id}-${dateStr}`}
                    onClick={() => handleOpenModal(task, dateStr)}
                    className={`bg-gray-200 text-gray-500 line-through text-[10px] font-semibold p-1 rounded truncate cursor-pointer flex items-center justify-between ${isCurrentMonthCell ? 'opacity-75 hover:opacity-90' : 'opacity-30'}`}>
                    <span className="truncate">✓ {task.title}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}