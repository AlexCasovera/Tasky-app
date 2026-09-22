// @ts-nocheck
import React from 'react';
import { formatDateKey, formatTimeLabel, mapToDb, daysOfWeek } from '../utils';
import { supabase } from '../supabaseClient';

export default function TaskInspectorModal({
  selectedTask, setSelectedTask, selectedInstanceDate, isCurrentInstanceCompleted, userRole, currentUserName, teamMembers, masterCompanyList, isEditing, setIsEditing, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskCompany, setTaskCompany, taskPriority, setTaskPriority, taskDate, setTaskDate, hasSpecificTime, setHasSpecificTime, startTime, setStartTime, endTime, setEndTime, isLongTerm, setIsLongTerm, selectedAssignees, handleAddAssignee, handleRemoveAssignee, recurrenceType, setRecurrenceType, activeDays, toggleDay, cadenceDays, setCadenceDays, chainedSteps, handleAddChainedStep, handleUpdateChainedStep, handleRemoveChainedStep, requiresPhoto, setRequiresPhoto, requiresComment, setRequiresComment, allowAssigneeDeadlineChange, setAllowAssigneeDeadlineChange, notifyOnComplete, setNotifyOnComplete, notifyOnComment, setNotifyOnComment, notifyOnDeadlineChange, setNotifyOnDeadlineChange, notifyOnTaskCreated, setNotifyOnTaskCreated, openCommentInput, setExecutionComment, handlePostOpenComment, isDraggingFile, setIsDraggingFile, handleFileUpload, additionalNote, setAdditionalNote, handleAppendNote, handleSaveChanges, handleDeleteTask, handleReopenTask, handleInitiateCompletion, handleOpenModal, isTaskPastDue, getCurrentTimestamp, tasks, setTasks, dispatchNotification, renderComment
}) {
  if (!selectedTask) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onMouseDown={() => setSelectedTask(null)}>
      <div className="bg-[#F4F3ED] max-w-2xl w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start border-b border-gray-300 pb-3">
          <div>
            <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
              {isCurrentInstanceCompleted ? 'Completed Occurrence Review' : (userRole === 'admin' ? (isEditing ? 'Admin Full Task Editor' : 'Admin Inspector Mode') : 'Employee Execution View')}
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">{selectedTask.company}</span>
              {isTaskPastDue(selectedTask) && <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded">OVERDUE</span>}
            </div>
          </div>
          <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
        </div>

        {!isEditing ? (
          <>
            {isTaskPastDue(selectedTask) && !isCurrentInstanceCompleted && (
              <div className="bg-red-50 border border-red-400 text-red-800 text-xs font-bold px-3 py-2 rounded mb-1 flex items-center gap-2">
                <span>🚨</span> THIS TASK IS PAST DUE. Please complete the work or adjust the deadline.
              </div>
            )}

            {selectedTask.isLongTerm && !isTaskPastDue(selectedTask) && (
              <div className="bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold px-3 py-2 rounded mb-1 flex items-center gap-2">
                <span>📌</span> This is a Long-Term Pipeline task pinned to the dashboard.
              </div>
            )}

            <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>

            <div className="flex justify-between text-xs text-gray-500 bg-gray-100 p-2 rounded">
              <span>Assigned to: <strong>{selectedTask.assignees && selectedTask.assignees.length > 0 ? selectedTask.assignees.join(', ') : 'Unassigned (Backlog)'}</strong></span>
              <span>
                {isCurrentInstanceCompleted && selectedTask.recurrenceType === 'once' ? 'Completed On:' : 'Occurrence Date:'} 
                <strong> {isCurrentInstanceCompleted && selectedTask.recurrenceType === 'once' && selectedTask.completedDates?.length > 0 ? selectedTask.completedDates[0] : selectedInstanceDate}</strong>
              </span>
            </div>

            {selectedTask.allowAssigneeDeadlineChange && !isCurrentInstanceCompleted && (
              <div className="bg-blue-50 p-3 rounded border border-blue-200 flex flex-col gap-2">
                <span className="text-xs font-bold text-blue-900">📅 Admin Permission Granted: Adjust Deadline</span>
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={selectedTask.date} 
                    disabled={selectedTask.recurrenceType !== 'once'}
                    onChange={async (e) => {
                      const newDate = e.target.value;
                      const todayStr = formatDateKey(new Date());
                      const newOverdue = newDate < todayStr;
                      
                      const changeNote = `📅 Deadline adjusted to ${newDate} by ${currentUserName} [${getCurrentTimestamp()}]`;

                      const updated = { 
                        ...selectedTask, 
                        date: newDate, 
                        isOverdue: newOverdue, 
                        overdueNotified: newOverdue,
                        comments: [...(selectedTask.comments || []), changeNote]
                      };
                      
                      setSelectedTask(updated);
                      setTasks(tasks.map(t => t.id === selectedTask.id ? updated : t));

                      await supabase.from('tasks').update(mapToDb(updated)).eq('id', selectedTask.id);

                      if (userRole === 'employee' && selectedTask?.notifyOnDeadlineChange !== false) {
                        dispatchNotification(
                          'role',
                          'admin',
                          'deadline',
                          `📅 Employee Rescheduled: "${selectedTask.title}" deadline changed to ${newDate}`,
                          '📅 Employee Changed Deadline',
                          `${currentUserName} moved deadline for "${selectedTask.title}" to ${newDate}`,
                          selectedTask.id,
                          newDate
                        );
                      }
                    }} 
                    className={`p-1.5 text-xs border rounded font-bold text-gray-800 focus:outline-none ${selectedTask.recurrenceType !== 'once' ? 'bg-gray-100 cursor-not-allowed' : 'bg-white cursor-pointer'}`}
                  />
                  {selectedTask.recurrenceType !== 'once' ? (
                    <span className="text-[10px] text-red-500 italic ml-2">(Use calendar drag-and-drop to reschedule recurring tasks)</span>
                  ) : (
                    <span className="text-[11px] text-gray-500 italic ml-2">(Reschedules task on dispatch board)</span>
                  )}
                </div>
              </div>
            )}

            <div className="bg-white p-3 rounded border border-gray-200">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Task Activity & Timeline</h4>
              
              {selectedTask.parentTaskId && (
                <div className="bg-blue-50/60 p-2 mb-3 rounded border border-blue-100 flex items-center justify-between text-[11px]">
                  <span className="text-blue-800">
                    ↳ Sub-task of: <strong className="font-bold">{selectedTask.parentTaskTitle}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const parentTask = tasks.find(t => t.id === selectedTask.parentTaskId);
                      if (parentTask) {
                        handleOpenModal(parentTask, selectedTask.parentInstanceDate);
                      } else {
                        alert('Original task could not be found.');
                      }
                    }}
                    className="font-bold text-blue-700 hover:underline"
                  >
                    View Previous Task
                  </button>
                </div>
              )}

              {selectedTask.comments && selectedTask.comments.length > 0 ? (
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 mb-3">
                  {selectedTask.comments.map((c, i) => renderComment(c, i))}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic mb-2">No activity logged yet.</p>
              )}

              {!isCurrentInstanceCompleted && (
                <div className="flex gap-2">
                  <textarea 
                    rows={2}
                    value={openCommentInput}
                    onChange={(e) => setExecutionComment(e.target.value)}
                    placeholder="Type an update or comment..." 
                    className="flex-1 p-2 text-xs border border-gray-200 rounded focus:outline-none resize-y min-h-[40px]" 
                  />
                  <button 
                    type="button"
                    onClick={() => handlePostOpenComment(selectedTask.id)}
                    className="bg-[#333333] text-white px-3 py-1 rounded text-xs font-bold hover:bg-black transition self-end">
                    Post Note
                  </button>
                </div>
              )}
            </div>

            {/* UNIVERSAL ATTACHMENTS & Proof OF WORK */}
            {!isCurrentInstanceCompleted && (
              <div 
                className={`bg-white p-3 rounded border border-dashed transition flex justify-between items-center my-1 relative ${isDraggingFile ? 'border-blue-500 bg-blue-50' : 'border-amber-300'}`}
                onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
                onDragLeave={() => setIsDraggingFile(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingFile(false);
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleFileUpload(e.dataTransfer.files[0]);
                  }
                }}
              >
                {isDraggingFile && (
                  <div className="absolute inset-0 flex items-center justify-center bg-blue-50/90 z-10 rounded">
                    <span className="text-blue-700 font-bold text-sm pointer-events-none">Drop file here to upload</span>
                  </div>
                )}
                
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                    📎 Attachments & Proof of Work
                    {selectedTask.requiresPhoto && <span className="text-red-600 font-bold ml-1">(Required)</span>}
                  </span>
                  <span className="text-[10px] text-gray-500">Upload or drag and drop images, PDFs, spreadsheets, etc.</span>
                </div>
                
                <label className="text-xs font-bold px-3 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 cursor-pointer transition z-20">
                  + Attach File
                  <input 
                    type="file" 
                    accept="*/*" 
                    className="hidden" 
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        handleFileUpload(e.target.files[0]);
                      }
                    }}
                  />
                </label>
              </div>
            )}

            {isCurrentInstanceCompleted && (
              <div className="bg-white p-3 rounded border border-green-300 flex flex-col gap-2">
                <span className="text-xs font-semibold text-green-800">✏️ Append additional review notes</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={additionalNote}
                    onChange={(e) => setAdditionalNote(e.target.value)}
                    placeholder="Type follow-up details..." 
                    className="flex-1 p-2 text-xs border border-gray-200 rounded focus:outline-none" />
                  <button onClick={() => handleAppendNote(selectedTask.id)} className="bg-green-700 text-white px-3 py-1 rounded text-xs font-bold hover:bg-green-800 transition">Add Note</button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-bold mb-1 text-gray-700">Task Title</label>
                <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} className="w-full p-2 border rounded bg-white" />
              </div>

              <div className="flex gap-2">
                <div className="w-1/2">
                  <label className="block font-bold mb-1 text-gray-700">Company</label>
                  <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)} className="w-full p-2 border rounded bg-white">
                    <option value="" disabled>Select a Company...</option>
                    {masterCompanyList.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="w-1/2">
                  <label className="block font-bold mb-1 text-gray-700">Priority Level</label>
                  <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full p-2 border rounded bg-white">
                    <option value="High">High (Red)</option>
                    <option value="Standard">Standard (Green)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block font-bold mb-1 text-gray-700">Description / Instructions</label>
              <textarea value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} className="w-full p-2 border rounded bg-white" rows={2}></textarea>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white p-3 rounded border border-gray-200">
              <div>
                <label className="block font-bold mb-1 text-gray-700">Deadline Date</label>
                <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="w-full p-1.5 border rounded bg-white mb-2" />
                
                <div className="flex items-center gap-1.5">
                  <input type="checkbox" id="editTimeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6]" />
                  <label htmlFor="editTimeToggle" className="font-bold text-gray-700 cursor-pointer">Timed Slot</label>
                </div>

                {hasSpecificTime && (
                  <div className="flex gap-2 mt-1">
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-1/2 p-1 border rounded bg-white" />
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-1/2 p-1 border rounded bg-white" />
                  </div>
                )}
                
                <div className="col-span-2 bg-[#A9B1A6]/10 p-3 rounded border border-[#A9B1A6]/30 mt-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isLongTerm} 
                      onChange={(e) => {
                        setIsLongTerm(e.target.checked);
                        if (e.target.checked && taskDate === formatDateKey(new Date())) {
                          setTaskDate('');
                        } else if (!e.target.checked && taskDate === '') {
                          setTaskDate(formatDateKey(new Date()));
                        }
                      }} 
                      className="accent-[#A9B1A6] w-4 h-4" 
                    />
                    <span className="text-[11px] font-bold text-gray-800">📌 Mark as Long-Term / Pipeline Task</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1 text-gray-700">Assigned to</label>
                <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full p-1.5 border rounded bg-white mb-1">
                  <option value="">Add assignee...</option>
                  {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                </select>
                <div className="flex flex-wrap gap-1">
                  {selectedAssignees.map(name => (
                    <span key={name} className="bg-gray-200 text-[10px] px-2 py-0.5 rounded flex items-center gap-1 font-bold">
                      {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600">✕</button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-3 rounded border border-gray-200">
              <h4 className="font-bold mb-2 text-gray-700">Recurrence Engine</h4>
              <select value={recurrenceType} onChange={(e) => setRecurrenceType(e.target.value)} className="w-full p-1.5 border rounded bg-gray-50 mb-2">
                <option value="once">One-time Task</option>
                <option value="fixed">Recurring Tasks</option>
                <option value="completion">Multi-Step Tasks</option>
              </select>

              {recurrenceType === 'fixed' && (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex gap-1">
                    {daysOfWeek.map(day => (
                      <button 
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`flex-1 py-1 text-[10px] font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-bold text-gray-700">Repeat every:</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.max(1, Math.round(cadenceDays / 7))}
                      onChange={(e) => setCadenceDays(Math.max(1, Number(e.target.value)) * 7)}
                      className="w-12 p-1 border rounded text-center font-bold"
                    />
                    <span className="text-xs font-bold text-gray-700">weeks</span>
                  </div>
                </div>
              )}

              {recurrenceType === 'completion' && (
                <div className="flex items-center gap-2 mt-2">
                  <span>Re-deploy</span>
                  <input type="number" value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} className="w-12 p-1 border rounded text-center font-bold" />
                  <span>days after completion</span>
                </div>
              )}
            </div>

            {recurrenceType === 'completion' && (
              <div className="bg-white p-3 rounded border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-bold text-gray-700">Chained Workflow Steps ({chainedSteps.length})</h4>
                  <button type="button" onClick={handleAddChainedStep} className="text-[10px] font-bold bg-[#A9B1A6] text-white px-2 py-0.5 rounded">+ Step</button>
                </div>

                {chainedSteps.map((step, idx) => (
                  <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 mb-2 flex flex-col gap-1.5">
                    <div className="flex justify-between font-bold text-gray-600">
                      <span>Step {idx + 1} Sub Task</span>
                      <button type="button" onClick={() => handleRemoveChainedStep(idx)} className="text-red-600">Remove</button>
                    </div>
                    <input type="text" value={step.title} onChange={(e) => handleUpdateChainedStep(idx, 'title', e.target.value)} placeholder="Step Title" className="p-1 border rounded bg-white" />
                    <div className="flex gap-2">
                      <input type="number" value={step.relativeDays} onChange={(e) => handleUpdateChainedStep(idx, 'relativeDays', Number(e.target.value))} className="w-12 p-1 border rounded bg-white text-center font-bold" />
                      <span className="self-center">days after</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-white p-3 rounded border border-gray-200 flex flex-col gap-1.5">
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6]" /> Require proof of work upload (Mandatory to complete)
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6]" /> Require Comment
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer border-t pt-1.5 mt-1 border-gray-100">
                <input type="checkbox" checked={allowAssigneeDeadlineChange} onChange={(e) => setAllowAssigneeDeadlineChange(e.target.checked)} className="accent-[#A9B1A6]" /> Allow Employee to Adjust Deadline Date
              </label>
            </div>

            <div className="bg-[#A9B1A6]/10 p-3 rounded border border-[#A9B1A6]/30 flex flex-col gap-1.5">
              <h4 className="font-bold text-xs text-gray-800">Admin Notification Rules</h4>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when task is completed
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me if new comment/files have been added
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={notifyOnDeadlineChange} onChange={(e) => setNotifyOnDeadlineChange(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when employee changes deadline
              </label>
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={notifyOnTaskCreated} onChange={(e) => setNotifyOnTaskCreated(e.target.checked)} className="accent-[#A9B1A6]" /> Notify me when new task has been added
              </label>
            </div>

          </div>
        )}

        <div className="flex justify-between items-center pt-3 border-t border-gray-300 mt-2">
          {userRole === 'admin' && !isCurrentInstanceCompleted && (
            <div className="flex gap-2">
              <button onClick={() => setIsEditing(!isEditing)} className="text-xs text-blue-700 font-bold hover:underline">
                {isEditing ? 'Cancel Edit' : 'Full Edit Settings'}
              </button>
              <button onClick={() => handleDeleteTask(selectedTask.id)} className="text-xs text-red-600 font-bold hover:underline">
                Delete Task
              </button>
            </div>
          )}

          {userRole === 'admin' && isCurrentInstanceCompleted && (
            <button onClick={() => handleReopenTask(selectedTask.id)} className="text-xs text-amber-700 font-bold hover:underline">Reopen Occurrence</button>
          )}
          
          <div className="flex gap-2 ml-auto">
            {isEditing ? (
              <button onClick={handleSaveChanges} className="bg-[#333333] text-white px-4 py-2 rounded text-xs font-bold hover:bg-black transition">
                Save All Changes
              </button>
            ) : (
              !isCurrentInstanceCompleted && (
                <button onClick={handleInitiateCompletion} className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition">
                  Mark Occurrence Complete
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}