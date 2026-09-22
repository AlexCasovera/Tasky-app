// @ts-nocheck
import React from 'react';

export default function DayView({
  visibleMembers,
  formatDateKey,
  currentDate,
  visibleTasks,
  isTaskActiveOnDay,
  daysOfWeek,
  handleDropSlot,
  userRole,
  resizingTaskId,
  handleDragStart,
  handleDragEnd,
  handleOpenModal,
  dynamicTimeSlots,
  minuteSubSlots,
  handleSubSlotDragOver,
  decimalToTimeString,
  draggedTaskObj,
  hoverSlot,
  formatTimeLabel,
  computeDynamicLayouts,
  isTaskPastDue,
  handleResizeStart,
  gridStartHour // Added to ensure layout alignment matches App.tsx
}) {
  const dayDateStr = formatDateKey(currentDate);

  return (
    <div className="w-full overflow-x-auto pb-4">
      <div className="flex-1 flex flex-col border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm min-w-[700px]">
        {/* Header: Members */}
        <div className="flex border-b border-gray-300 bg-gray-100">
          <div className="w-20 py-3 text-center text-xs font-bold text-gray-500 border-r border-gray-300">Time</div>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
            {visibleMembers.map(member => (
              <div key={member.id} className="py-3 px-2 border-r border-gray-300 last:border-r-0 flex items-center justify-center gap-2">
                <div style={{ backgroundColor: member.color }} className="w-7 h-7 rounded-full text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  {member.initials}
                </div>
                <span className="font-bold text-sm text-gray-800">{member.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* All-Day Row */}
        <div className="flex border-b border-gray-300 bg-gray-50/80 min-h-[40px] shrink-0">
          <div className="w-20 py-2 text-center text-[10px] font-bold text-gray-500 border-r border-gray-300 flex items-center justify-center bg-gray-100">All-Day</div>
          <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))` }}>
            {visibleMembers.map(member => {
              const allDayTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name) && t.type === 'flexible');
              return (
                <div 
                  key={member.id} 
                  className="p-1 border-r border-gray-300 last:border-r-0 flex flex-col gap-1 min-h-[40px]"
                  onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                  onDrop={(e) => handleDropSlot(e, dayDateStr, null, member.name, true)}
                >
                  {allDayTasks.map(task => (
                    <div
                      key={task.id}
                      draggable={userRole === 'admin' && !resizingTaskId}
                      onDragStart={(e) => handleDragStart(e, task.id, dayDateStr)}
                      onDragEnd={handleDragEnd}
                      onClick={() => handleOpenModal(task, dayDateStr)}
                      style={{ backgroundColor: member.color }}
                      className={`text-white text-[10px] font-semibold px-2 py-1 rounded truncate shadow-sm ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition ${isTaskPastDue(task) ? 'ring-2 ring-red-500' : ''}`}
                    >
                      {task.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Time Grid */}
        <div className="flex-1 relative overflow-y-auto flex" style={{ maxHeight: '580px' }}>
          <div className="w-20 border-r border-gray-300 bg-gray-50 flex flex-col select-none shrink-0" style={{ height: `${dynamicTimeSlots.length * 80}px` }}>
            {dynamicTimeSlots.map(hour => (
              <div key={hour} className="h-20 border-b border-gray-200 p-2 text-xs font-mono font-bold text-gray-400 text-right pr-3">
                {hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : hour === 0 ? '12:00 AM' : `${hour}:00 AM`}
              </div>
            ))}
          </div>

          <div className="flex-1 grid relative" style={{ gridTemplateColumns: `repeat(${visibleMembers.length}, minmax(0, 1fr))`, height: `${dynamicTimeSlots.length * 80}px` }}>
            {visibleMembers.map(member => {
              const memberColTasks = visibleTasks.filter(t => isTaskActiveOnDay(t, daysOfWeek[currentDate.getDay()], dayDateStr) && t.assignees && t.assignees.includes(member.name) && t.type === 'timed');
              const layouts = computeDynamicLayouts(memberColTasks);

              return (
                <div key={member.id} className="border-r border-gray-200 last:border-r-0 relative h-full">
                  {dynamicTimeSlots.map(hour => (
                    <div key={hour} className="h-20 border-b border-gray-200 flex flex-col">
                      {minuteSubSlots.map(subOffset => (
                        <div 
                          key={subOffset}
                          onDragOver={(e) => handleSubSlotDragOver(e, dayDateStr, hour + subOffset, member.name)}
                          onDrop={(e) => handleDropSlot(e, dayDateStr, hour + subOffset, member.name, false)}
                          className="flex-1 hover:bg-blue-50/50 transition border-b border-dashed border-gray-100 last:border-b-0"
                          title={`Schedule for ${decimalToTimeString(hour + subOffset)} - ${member.name}`}>
                        </div>
                      ))}
                    </div>
                  ))}

                  {/* Drag Ghost Overlay */}
                  {draggedTaskObj && hoverSlot && hoverSlot.memberName === member.name && hoverSlot.dateStr === dayDateStr && (
                    <div 
                      style={{
                        top: `${(hoverSlot.targetHour - gridStartHour) * 80}px`,
                        height: `${Math.max(32, (draggedTaskObj.duration || 1) * 80)}px`,
                        left: '2px',
                        right: '2px'
                      }}
                      className="absolute z-30 bg-blue-500/20 border-2 border-dashed border-blue-600 rounded-md p-2 shadow-lg pointer-events-none flex flex-col justify-between text-blue-950 font-bold backdrop-blur-[2px] animate-pulse">
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded shadow-2xs font-mono shrink-0">
                          🎯 {formatTimeLabel(decimalToTimeString(hoverSlot.targetHour), decimalToTimeString(hoverSlot.targetHour + (draggedTaskObj.duration || 1)))}
                        </span>
                        <span className="text-[9px] bg-white/90 px-1 py-0.5 rounded border border-blue-300 text-blue-900 truncate">
                          {member.name}
                        </span>
                      </div>
                      <span className="text-xs truncate text-blue-950 mt-1">{draggedTaskObj.title}</span>
                    </div>
                  )}

                  {/* Timed Task Cards */}
                  {memberColTasks.map(task => {
                    const layout = layouts[task.id] || { left: '0%', width: '100%', startPx: 0, heightPx: 80, isFlex: false };
                    const isFlex = layout.isFlex;

                    return (
                      <div
                        key={task.id}
                        draggable={userRole === 'admin' && !resizingTaskId}
                        onDragStart={(e) => handleDragStart(e, task.id, dayDateStr)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleOpenModal(task, dayDateStr)}
                        style={{ 
                          top: `${layout.startPx}px`, 
                          height: `${layout.heightPx}px`, 
                          left: layout.left, 
                          width: layout.width, 
                          backgroundColor: member.color 
                        }}
                        className={`absolute text-white rounded-md p-2 shadow-md border-l-4 ${isTaskPastDue(task) ? 'border-red-500 ring-2 ring-red-400' : 'border-black/20'} ${userRole === 'admin' && !resizingTaskId ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'} hover:brightness-110 transition z-10 flex flex-col justify-between overflow-hidden ${isFlex ? 'opacity-95' : ''}`}>
                        
                        {!isFlex && userRole === 'admin' && (
                          <div 
                            className="absolute top-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-t-md"
                            onPointerDown={(e) => handleResizeStart(e, task, 'top')}
                          />
                        )}

                        <div>
                          <div className="flex justify-between items-start gap-1">
                            <h4 className="font-bold text-xs leading-tight drop-shadow-sm truncate">
                              {task.title}
                            </h4>
                            {isTaskPastDue(task) ? (
                              <span className="bg-red-600 text-[8px] font-bold px-1 rounded shrink-0">OVERDUE</span>
                            ) : (
                              isFlex && <span className="bg-black/30 text-[8px] font-bold px-1 rounded shrink-0">ALL-DAY</span>
                            )}
                          </div>
                          <span className="text-[10px] bg-black/20 px-1 rounded font-mono inline-block mt-0.5">{task.timeLabel}</span>
                          <p className="text-[10px] opacity-90 truncate mt-0.5">[{task.company}] {task.desc}</p>
                        </div>
                        <div className="flex items-center justify-between text-[9px] opacity-80 pt-0.5 border-t border-white/20 mt-auto">
                          <span>Priority: {task.priority}</span>
                          <span>{task.recurrenceType === 'completion' ? '🔄' : task.recurrenceType === 'fixed' ? '↻' : ''}</span>
                        </div>

                        {!isFlex && userRole === 'admin' && (
                          <div 
                            className="absolute bottom-0 inset-x-0 h-2 cursor-ns-resize hover:bg-white/40 z-20 touch-none rounded-b-md"
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