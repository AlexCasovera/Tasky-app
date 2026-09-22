// @ts-nocheck
import React from 'react';

export default function WeekView({
  daysOfWeek,
  getWeekStart,
  currentDate,
  formatDateKey,
  visibleTasks,
  isTaskActiveOnDay,
  handleDropSlot,
  getMemberConfig,
  userRole,
  resizingTaskId,
  handleDragStart,
  handleDragEnd,
  handleOpenModal,
  isTaskPastDue,
  dynamicTimeSlots,
  computeDynamicLayouts,
  minuteSubSlots,
  handleSubSlotDragOver,
  decimalToTimeString,
  draggedTaskObj,
  hoverSlot,
  gridStartHour,
  formatTimeLabel,
  handleResizeStart
}) {
  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[800px]">
        {/* Day Header Row */}
        <div className="flex border-b border-gray-300 bg-gray-100 font-bold text-xs text-gray-700">
          <div className="w-16 py-2 text-center border-r border-gray-300">Time</div>
          <div className="flex-1 grid grid-cols-7">
            {daysOfWeek.map((dayName, idx) => {
              const weekStart = getWeekStart(currentDate);
              const cellDate = new Date(weekStart);
              cellDate.setDate(cellDate.getDate() + idx);
              const isTodayCell = formatDateKey(cellDate) === formatDateKey(new Date());

              return (
                <div key={dayName} className={`py-2 text-center border-r border-gray-300 last:border-r-0 ${isTodayCell ? 'bg-[#A9B1A6] text-white' : ''}`}>
                  <span className="block text-[10px] uppercase">{dayName}</span>
                  <span className="text-xs font-serif">{cellDate.getMonth() + 1}/{cellDate.getDate()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* All-Day Row */}
        <div className="flex border-b border-gray-300 bg-gray-50/80 min-h-[40px] shrink-0">
          <div className="w-16 py-2 text-center text-[10px] font-bold text-gray-500 border-r border-gray-300 flex items-center justify-center bg-gray-100">All-Day</div>
          <div className="flex-1 grid grid-cols-7">
            {daysOfWeek.map((dayName, idx) => {
              const weekStart = getWeekStart(currentDate);
              const cellDate = new Date(weekStart);
              cellDate.setDate(cellDate.getDate() + idx);
              const dateStr = formatDateKey(cellDate);

              const allDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr) && t.type === 'flexible');

              return (
                <div 
                  key={dayName} 
                  className="p-1 border-r border-gray-300 last:border-r-0 flex flex-col gap-1 min-h-[40px]"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => handleDropSlot(e, dateStr, null, null, true)}
                >
                  {allDayTasks.map(task => {
                    const member = getMemberConfig(task.assignees && task.assignees[0]);
                    return (
                      <div
                        key={`${task.id}-${dateStr}`}
                        draggable={userRole === 'admin' && !resizingTaskId}
                        onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenModal(task, dateStr)}
                        style={{ backgroundColor: member.color }}
                        className={`text-white text-[9px] font-semibold px-1.5 py-0.5 rounded truncate shadow-sm ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''}`}
                      >
                        {task.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Timed Grid */}
        <div className="flex-1 relative overflow-y-auto flex" style={{ maxHeight: '550px' }}>
          <div className="w-16 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
            {dynamicTimeSlots.map(hour => (
              <div key={hour} className="h-20 border-b border-gray-200 p-1 text-[10px] font-mono font-bold text-gray-400 text-right pr-2">
                {hour === 12 ? '12 PM' : hour > 12 ? `${hour - 12} PM` : hour === 0 ? '12 AM' : `${hour} AM`}
              </div>
            ))}
          </div>

          <div className="flex-1 grid grid-cols-7 relative" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
            {daysOfWeek.map((dayName, idx) => {
              const weekStart = getWeekStart(currentDate);
              const cellDate = new Date(weekStart);
              cellDate.setDate(cellDate.getDate() + idx);
              const dateStr = formatDateKey(cellDate);

              const dayColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, dayName, dateStr) && t.type === 'timed');
              const layouts = computeDynamicLayouts(dayColTasks);

              return (
                <div key={dayName} className="border-r border-gray-200 last:border-r-0 relative h-full">
                  {dynamicTimeSlots.map(hour => (
                    <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                      {minuteSubSlots.map(subOffset => (
                        <div 
                          key={subOffset}
                          onDragOver={(e) => handleSubSlotDragOver(e, dateStr, hour + subOffset, null)}
                          onDrop={(e) => handleDropSlot(e, dateStr, hour + subOffset, null, false)}
                          className="flex-1 hover:bg-blue-50/50 transition border-b border-dashed border-gray-100 last:border-b-0"
                          title={`${dateStr} @ ${decimalToTimeString(hour + subOffset)}`}>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Drag Preview */}
                  {draggedTaskObj && hoverSlot && hoverSlot.dateStr === dateStr && (
                    <div 
                      style={{
                        top: `${(hoverSlot.targetHour - gridStartHour) * 80}px`,
                        height: `${Math.max(32, (draggedTaskObj.duration || 1) * 80)}px`,
                        left: '2px',
                        right: '2px'
                      }}
                      className="absolute z-30 bg-blue-500/20 border-2 border-dashed border-blue-600 rounded p-1.5 shadow-lg pointer-events-none flex flex-col justify-between text-blue-950 font-bold backdrop-blur-[2px] animate-pulse">
                      <div className="flex justify-between items-center text-[9px] font-bold">
                        <span className="bg-blue-600 text-white px-1 py-0.5 rounded font-mono truncate">
                          🎯 {formatTimeLabel(decimalToTimeString(hoverSlot.targetHour), decimalToTimeString(hoverSlot.targetHour + (draggedTaskObj.duration || 1)))}
                        </span>
                      </div>
                      <span className="text-[10px] truncate text-blue-950 mt-0.5">{draggedTaskObj.title}</span>
                    </div>
                  )}

                  {/* Task Cards */}
                  {dayColTasks.map(task => {
                    const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                    const member = getMemberConfig(task.assignees && task.assignees[0]);
                    const isFlex = layout.isFlex;

                    return (
                      <div
                        key={`${task.id}-${dateStr}`}
                        draggable={userRole === 'admin' && !resizingTaskId}
                        onDragStart={(e) => handleDragStart(e, task.id, dateStr)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenModal(task, dateStr)}
                        style={{ 
                          top: `${layout.startPx}px`, 
                          height: `${layout.heightPx}px`, 
                          left: layout.left, 
                          width: layout.width, 
                          backgroundColor: member.color 
                        }}
                        className={`absolute text-white rounded p-1.5 shadow ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:opacity-90 transition z-10 flex flex-col justify-between overflow-hidden ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''} ${isFlex ? 'opacity-95' : ''}`}>
                        
                        {!isFlex && userRole === 'admin' && (
                          <div 
                            className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-t"
                            onPointerDown={(e) => handleResizeStart(e, task, 'top')}
                          />
                        )}

                        <div>
                          <div className="flex justify-between items-center text-[10px] font-bold leading-tight">
                            <span className="truncate">{task.title}</span>
                            {isTaskPastDue(task) ? (
                              <span className="bg-red-600 px-0.5 rounded text-[8px] shrink-0">!</span>
                            ) : (
                              isFlex && <span className="bg-black/30 px-0.5 rounded text-[7px] shrink-0">ALL-DAY</span>
                            )}
                          </div>
                          <span className="text-[9px] opacity-80 font-mono block truncate">{task.timeLabel}</span>
                        </div>
                        <span className="text-[8px] bg-black/20 px-1 rounded truncate w-max mt-auto">{(task.assignees || []).join(', ')}</span>

                        {!isFlex && userRole === 'admin' && (
                          <div 
                            className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-b"
                            onPointerDown={(e) => handleResizeStart(e, task, 'bottom')}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}