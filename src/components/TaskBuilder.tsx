// @ts-nocheck
import React from 'react';
import { formatDateKey, daysOfWeek } from '../utils';

export default function TaskBuilder({
  setCurrentView, previousView, taskTitle, setTaskTitle, taskDesc, setTaskDesc, 
  taskCompany, setTaskCompany, masterCompanyList, taskPriority, setTaskPriority, 
  taskDate, setTaskDate, hasSpecificTime, setHasSpecificTime, startTime, setStartTime, 
  endTime, setEndTime, isLongTerm, setIsLongTerm, teamMembers, selectedAssignees, 
  handleAddAssignee, handleRemoveAssignee, recurrenceType, setRecurrenceType, 
  activeDays, toggleDay, cadenceDays, setCadenceDays, chainedSteps, handleAddChainedStep, 
  handleUpdateChainedStep, handleRemoveChainedStep, requiresPhoto, setRequiresPhoto, 
  requiresComment, setRequiresComment, allowAssigneeDeadlineChange, setAllowAssigneeDeadlineChange, 
  notifyOnComplete, setNotifyOnComplete, notifyOnComment, setNotifyOnComment, 
  notifyOnDeadlineChange, setNotifyOnDeadlineChange, notifyOnTaskCreated, 
  setNotifyOnTaskCreated, handleDeployTask
}) {
  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
        <h1 className="text-3xl font-serif font-bold">Task Builder</h1>
        <button onClick={() => setCurrentView(previousView === 'create' ? 'list' : previousView)} className="text-gray-500 hover:text-gray-800 font-semibold text-sm">✕ Cancel</button>
      </div>

      <div className="flex gap-8 h-full">
        <div className="w-1/2 flex flex-col gap-5 border-r border-gray-300 pr-8">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Task Title</label>
            <input type="text" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="e.g., Service Espresso Machine" className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]" />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Description</label>
            <textarea rows={3} value={taskDesc} onChange={(e) => setTaskDesc(e.target.value)} placeholder="Add instructions for this task..." className="w-full px-4 py-2 rounded border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]"></textarea>
          </div>

          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Assigned to</label>
              <select value="" onChange={(e) => { if (e.target.value) handleAddAssignee(e.target.value); }} className="w-full px-4 py-2 rounded border border-gray-300 bg-white mb-2 text-sm focus:outline-none">
                <option value="">{teamMembers.filter(m => !selectedAssignees.includes(m.name)).length > 0 ? 'Select team member...' : 'All members assigned'}</option>
                {teamMembers.filter(m => !selectedAssignees.includes(m.name)).map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
              </select>
              <div className="flex flex-wrap gap-2">
                {selectedAssignees.map(name => (
                  <span key={name} className="bg-[#A9B1A6]/20 text-[#333333] text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 font-bold border border-[#A9B1A6]/30">
                    {name} <button onClick={() => handleRemoveAssignee(name)} className="text-red-600 hover:text-red-800 ml-1">✕</button>
                  </span>
                ))}
              </div>
            </div>

            <div className="w-1/2 flex flex-col gap-2">
              <label className="block text-sm font-bold text-gray-700">Deadline Settings</label>
              <input type="date" value={taskDate} onChange={(e) => setTaskDate(e.target.value)} className="w-full px-3 py-1.5 rounded border border-gray-300 bg-white text-sm" />
              
              <div className="flex items-center gap-2 mt-1">
                <input type="checkbox" id="timeToggle" checked={hasSpecificTime} onChange={(e) => setHasSpecificTime(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4 cursor-pointer" />
                <label htmlFor="timeToggle" className="text-xs text-gray-600 cursor-pointer select-none">Set start & stop time</label>
              </div>

              {hasSpecificTime && (
                <div className="flex gap-2 items-center">
                  <div className="w-1/2">
                    <span className="text-[10px] text-gray-500 block font-bold">Start:</span>
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white focus:outline-none" />
                  </div>
                  <div className="w-1/2">
                    <span className="text-[10px] text-gray-500 block font-bold">Stop:</span>
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="w-full p-1.5 border rounded text-xs bg-white focus:outline-none" />
                  </div>
                </div>
              )}
              
              <div className="mt-3 pt-3 border-t border-gray-200">
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
                <p className="text-[10px] text-gray-500 mt-1 ml-6">Pins this task to the top of the dashboard for constant visibility, with or without a deadline.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="w-1/2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Company</label>
              <select value={taskCompany} onChange={(e) => setTaskCompany(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                <option value="" disabled>Select a Company...</option>
                {masterCompanyList.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-1/2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Priority Level</label>
              <select value={taskPriority} onChange={(e) => setTaskPriority(e.target.value)} className="w-full px-4 py-2 rounded border border-gray-300 bg-white text-sm">
                <option value="High">High (Red)</option>
                <option value="Standard">Standard (Green)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="w-1/2 flex flex-col gap-4 overflow-y-auto pb-4">
          <h3 className="font-bold text-gray-500 uppercase tracking-wider text-xs mb-1">Modular Logic Settings</h3>
          
          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <h4 className="font-bold text-sm mb-2">Recurrence Engine</h4>
            <select 
              value={recurrenceType}
              onChange={(e) => setRecurrenceType(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded border border-gray-300 bg-gray-50 mb-2 focus:outline-none">
              <option value="once">One-time Task</option>
              <option value="fixed">Recurring Tasks</option>
              <option value="completion">Multi-Step Tasks</option>
            </select>

            {recurrenceType === 'fixed' && (
              <div className="flex flex-col gap-3 mt-3 pt-3 border-t border-gray-100">
                <div>
                  <span className="block text-xs font-semibold text-gray-600 mb-2">Active Days of the Week:</span>
                  <div className="flex gap-1">
                    {daysOfWeek.map(day => (
                      <button 
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={`flex-1 py-1 text-xs font-bold rounded border ${activeDays.includes(day) ? 'bg-[#A9B1A6] text-white border-[#A9B1A6]' : 'bg-white text-gray-500 border-gray-300'}`}>
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-600">Repeat every:</span>
                    <input
                      type="number"
                      min="1"
                      value={Math.max(1, Math.round(cadenceDays / 7))}
                      onChange={(e) => setCadenceDays(Math.max(1, Number(e.target.value)) * 7)}
                      className="border border-gray-300 rounded px-2 py-1 text-sm w-16 text-center focus:outline-none"
                    />
                    <span className="text-xs font-semibold text-gray-600">weeks</span>
                  </div>
                </div>
              </div>
            )}

            {recurrenceType === 'completion' && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                <span className="text-sm text-gray-600">Re-deploy task</span>
                <input type="number" value={cadenceDays} onChange={(e) => setCadenceDays(Number(e.target.value))} className="w-12 p-1 border rounded text-center font-bold" />
                <span className="text-sm text-gray-600">days after completion</span>
              </div>
            )}
          </div>

          {recurrenceType === 'completion' && (
            <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-sm">Multi-Step Task Chaining Engine</h4>
                <button type="button" onClick={handleAddChainedStep} className="text-[10px] font-bold bg-[#A9B1A6] text-white px-2.5 py-1 rounded hover:bg-[#5B7049] transition">+ Add Step</button>
              </div>
              <p className="text-xs text-gray-500 mb-3">Build an automated pipeline of sub tasks triggered upon completion.</p>

              {chainedSteps.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No sub tasks configured.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {chainedSteps.map((step, idx) => (
                    <div key={idx} className="bg-gray-50 p-3 rounded border border-gray-200 text-xs flex flex-col gap-2.5 relative">
                      <div className="flex justify-between items-center font-bold text-gray-700">
                        <span>Step {idx + 1} Sub Task</span>
                        <button type="button" onClick={() => handleRemoveChainedStep(idx)} className="text-red-600 font-bold hover:underline">Remove</button>
                      </div>
                      
                      <input type="text" value={step.title} onChange={(e) => handleUpdateChainedStep(idx, 'title', e.target.value)} placeholder="Step Title" className="p-1.5 border rounded bg-white" />
                      <textarea rows={2} value={step.desc} onChange={(e) => handleUpdateChainedStep(idx, 'desc', e.target.value)} placeholder="Instructions..." className="p-1.5 border rounded bg-white"></textarea>

                      <div className="flex gap-2">
                        <div className="w-1/2">
                          <label className="block font-bold text-[10px] text-gray-500 mb-0.5">Deployment Offset</label>
                          <div className="flex items-center gap-1">
                            <input type="number" value={step.relativeDays} onChange={(e) => handleUpdateChainedStep(idx, 'relativeDays', Number(e.target.value))} className="w-12 p-1 border rounded bg-white text-center font-bold" />
                            <span className="text-[11px] text-gray-600">days after</span>
                          </div>
                        </div>

                        <div className="w-1/2">
                          <label className="block font-bold text-[10px] text-gray-500 mb-0.5">Assigned to</label>
                          <select value={step.assignee} onChange={(e) => handleUpdateChainedStep(idx, 'assignee', e.target.value)} className="w-full p-1 border rounded bg-white text-xs">
                            <option value="Same as Parent">Same as Parent</option>
                            {teamMembers.map(m => <option key={m.id} value={m.name}>{m.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="bg-white p-4 rounded border border-gray-200 shadow-sm">
            <h4 className="font-bold text-sm mb-2">Proof of Work & Permissions</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require proof of work upload (Mandatory to complete)
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={requiresComment} onChange={(e) => setRequiresComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require execution notes/comment to complete
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer border-t pt-2 mt-1 border-gray-100">
                <input type="checkbox" checked={allowAssigneeDeadlineChange} onChange={(e) => setAllowAssigneeDeadlineChange(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Allow Employee to Adjust Deadline Date
              </label>
            </div>
          </div>

          <div className="bg-[#A9B1A6]/10 p-4 rounded border border-[#A9B1A6]/30">
            <h4 className="font-bold text-sm mb-2 text-gray-800">Admin Notification Rules</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={notifyOnComplete} onChange={(e) => setNotifyOnComplete(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when task is completed
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={notifyOnComment} onChange={(e) => setNotifyOnComment(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me if new comment/files have been added
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={notifyOnDeadlineChange} onChange={(e) => setNotifyOnDeadlineChange(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when employee changes deadline
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={notifyOnTaskCreated} onChange={(e) => setNotifyOnTaskCreated(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Notify me when new task has been added
              </label>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-auto pt-6 border-t border-gray-300 flex justify-end">
        <button onClick={handleDeployTask} className="bg-[#333333] text-white px-8 py-3 rounded font-bold shadow-sm hover:bg-black transition">Deploy Task</button>
      </div>
    </div>
  );
}