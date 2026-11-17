// src/components/TaskInspectorModal.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { formatDateKey, formatTimeLabel, mapToDb, daysOfWeek, compressImage } from '../utils';
import { supabase } from '../supabaseClient';

export default function TaskInspectorModal({
  selectedTask, setSelectedTask, selectedInstanceDate, isCurrentInstanceCompleted, userRole, currentUserName, teamMembers, masterCompanyList, isEditing, setIsEditing, taskTitle, setTaskTitle, taskDesc, setTaskDesc, taskCompany, setTaskCompany, taskPriority, setTaskPriority, taskDate, setTaskDate, hasSpecificTime, setHasSpecificTime, startTime, setStartTime, endTime, setEndTime, isLongTerm, setIsLongTerm, selectedAssignees, handleAddAssignee, handleRemoveAssignee, recurrenceType, setRecurrenceType, activeDays, toggleDay, cadenceDays, setCadenceDays, chainedSteps, handleAddChainedStep, handleUpdateChainedStep, handleRemoveChainedStep, requiresPhoto, setRequiresPhoto, requiresComment, setRequiresComment, allowAssigneeDeadlineChange, setAllowAssigneeDeadlineChange, notifyOnComplete, setNotifyOnComplete, notifyOnComment, setNotifyOnComment, notifyOnDeadlineChange, setNotifyOnDeadlineChange, notifyOnTaskCreated, setNotifyOnTaskCreated, openCommentInput, setExecutionComment, handlePostOpenComment, isDraggingFile, setIsDraggingFile, handleFileUpload, additionalNote, setAdditionalNote, handleAppendNote, handleSaveChanges, handleDeleteTask, handleReopenTask, handleInitiateCompletion, handleOpenModal, isTaskPastDue, getCurrentTimestamp, tasks, setTasks, dispatchNotification, renderComment,
  requireChecklist, setRequireChecklist, checklist, handleAddChecklistItem, handleUpdateChecklistItem, handleRemoveChecklistItem, handleToggleChecklistItem, checklistException, setChecklistException,
  propertyName, setPropertyName, unitName, setUnitName, requireAiQc, setRequireAiQc
}) {
  const [checkingRuleIds, setCheckingRuleIds] = useState([]);
  const [draggingRuleId, setDraggingRuleId] = useState(null);
  const [ruleBypassNotes, setRuleBypassNotes] = useState({});
  const [unitQcRules, setUnitQcRules] = useState([]);
  const [properties, setProperties] = useState([]);
  const [propertyUnits, setPropertyUnits] = useState([]);

  useEffect(() => {
    if (!selectedTask) return;
    setCheckingRuleId(null);
    setDraggingRuleId(null);
    setRuleBypassNotes({});

    if (selectedTask.requireAiQc && selectedTask.propertyName && selectedTask.unitName) {
      loadUnitRules(selectedTask.propertyName, selectedTask.unitName);
    } else {
      setUnitQcRules([]);
    }
  }, [selectedTask?.id, selectedInstanceDate]);

  useEffect(() => {
    if (isEditing) {
      Promise.all([
        supabase.from('properties').select('*').eq('active', true).order('name'),
        supabase.from('property_units').select('*').eq('active', true).order('unit_name')
      ]).then(([{ data: p }, { data: u }]) => {
        if (p) setProperties(p);
        if (u) setPropertyUnits(u);
      });
    }
  }, [isEditing]);

  const loadUnitRules = async (propName, uName) => {
    const { data: unitData } = await supabase
      .from('property_units')
      .select('*')
      .eq('property_name', propName)
      .eq('unit_name', uName)
      .single();

    if (!unitData) return;

    const unitBlueprints = Array.isArray(unitData.blueprints) && unitData.blueprints.length > 0
      ? unitData.blueprints
      : (unitData.blueprint ? [unitData.blueprint] : []);

    if (unitBlueprints.length === 0) {
      setUnitQcRules([]);
      return;
    }

    const { data: rules } = await supabase
      .from('ai_qc_rules')
      .select('*')
      .in('blueprint', unitBlueprints)
      .order('area_name')
      .eq('active', true);

    if (rules) setUnitQcRules(rules);
  };

  if (!selectedTask) return null;

  const qcResultsMap = selectedTask.aiQcResults || {};

  // Upload and evaluate a photo specifically for ONE AI QC rule slot
  const handleRulePhotoUpload = async (rule, rawFile) => {
  if (!rawFile || !rawFile.type.startsWith('image/')) {
    return alert('Please capture or upload an image file for this QC check.');
  }

  setCheckingRuleIds(prev => [...new Set([...prev, rule.id])]);

  try {
    const compressedFile = await compressImage(rawFile, 1280, 1280, 0.75);
    const fileExt = compressedFile.name?.split('.').pop() || 'jpg';
    const fileName = `${selectedTask.id}-${rule.id.slice(0, 6)}-${Date.now()}.${fileExt}`;

    const { error: uploadErr } = await supabase.storage
      .from('task-proofs')
      .upload(fileName, compressedFile);

    if (uploadErr) {
      alert(`Upload failed: ${uploadErr.message}`);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('task-proofs')
      .getPublicUrl(fileName);

    const qcPayload = JSON.stringify({
      submittedImageUrl: publicUrl,
      propertyName: selectedTask.propertyName,
      unitName: selectedTask.unitName,
      selectedRuleIds: [rule.id]
    });

    // Automatic retry loop if Google AI Studio briefly rate-limits (429/503)
    let qcData = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      let qcRes;
      try {
        qcRes = await fetch('https://tasky-app-gilt.vercel.app/api/ai-qc-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: qcPayload
        });
        if (qcRes.status === 404) throw new Error('Primary endpoint 404');
      } catch {
        qcRes = await fetch('/api/ai-qc-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: qcPayload
        });
      }

      const rawBody = await qcRes.text();
      try {
        qcData = JSON.parse(rawBody);
      } catch {
        throw new Error(`Server returned HTTP ${qcRes.status}: ${rawBody.slice(0, 140)}`);
      }

      if (qcRes.ok) break;

      if ((qcRes.status === 429 || qcRes.status === 503) && attempt < 2) {
        await new Promise(r => setTimeout(r, 4000 * (attempt + 1)));
        continue;
      }

      throw new Error(qcData.error || `AI QC failed (${qcRes.status})`);
    }

    const prevRuleState = (selectedTask.aiQcResults || {})[rule.id] || { failCount: 0 };
    const passed = Boolean(qcData.passed);
    const feedback = qcData.feedback || (passed ? 'Meets room standards.' : 'Does not match standards.');
    const nextFailCount = passed ? prevRuleState.failCount : (prevRuleState.failCount || 0) + 1;

    const updatedRuleEntry = {
      status: passed ? 'passed' : 'failed',
      failCount: nextFailCount,
      feedback,
      imageUrl: publicUrl,
      updatedAt: new Date().toISOString()
    };

    setSelectedTask(prevTask => {
      if (!prevTask || prevTask.id !== selectedTask.id) return prevTask;
      const latestMap = prevTask.aiQcResults || {};
      const nextResultsMap = { ...latestMap, [rule.id]: updatedRuleEntry };

      const allCleared = unitQcRules.every(r => ['passed', 'bypassed'].includes(nextResultsMap[r.id]?.status));
      const anyBypassed = unitQcRules.some(r => nextResultsMap[r.id]?.status === 'bypassed');
      const overallStatus = allCleared ? (anyBypassed ? 'bypassed' : 'passed') : 'failed';

      const statusBadge = passed
        ? `✅ AI QC Passed [${rule.area_name} — ${rule.rule_title}]: ${feedback}`
        : `❌ AI QC Failed [${rule.area_name} — ${rule.rule_title}] (Attempt ${nextFailCount}): ${feedback}`;

      const fileNote = `📎 QC Photo (${rule.area_name}) by ${currentUserName} [${getCurrentTimestamp()}]:\n${publicUrl}\n${statusBadge}`;
      const updatedComments = [...(prevTask.comments || []), fileNote];

      const updated = {
        ...prevTask,
        comments: updatedComments,
        aiQcStatus: overallStatus,
        aiQcResults: nextResultsMap
      };

      setTasks(prevTasks => prevTasks.map(t => t.id === updated.id ? updated : t));
      supabase.from('tasks').update({
        ...mapToDb(updated),
        ai_qc_status: overallStatus,
        ai_qc_results: nextResultsMap
      }).eq('id', updated.id);

      return updated;
    });
  } catch (err) {
    alert(`AI QC check error: ${err.message}`);
  } finally {
    setCheckingRuleIds(prev => prev.filter(id => id !== rule.id));
  }
};

  // Bypass a specific rule after 2+ failed attempts and alert Admin for manual review
  const handleBypassSingleRule = async (rule) => {
    const prevRuleState = qcResultsMap[rule.id] || { failCount: 2 };
    const reason = (ruleBypassNotes[rule.id] || '').trim();

    const nextResultsMap = {
      ...qcResultsMap,
      [rule.id]: {
        ...prevRuleState,
        status: 'bypassed',
        bypassReason: reason
      }
    };

    const allCleared = unitQcRules.every(r => {
      const st = nextResultsMap[r.id]?.status;
      return st === 'passed' || st === 'bypassed';
    });
    const overallStatus = allCleared ? 'bypassed' : 'pending';

    const bypassNote = `⚠️ AI QC Bypassed [${rule.area_name} — ${rule.rule_title}] by ${currentUserName} after ${prevRuleState.failCount} failed attempts [${getCurrentTimestamp()}]${reason ? `\nReason: ${reason}` : ''}`;
    const updatedComments = [...(selectedTask.comments || []), bypassNote];

    const updatedTask = {
      ...selectedTask,
      comments: updatedComments,
      aiQcStatus: overallStatus,
      aiQcResults: nextResultsMap
    };

    setSelectedTask(updatedTask);
    setTasks(tasks.map(t => t.id === selectedTask.id ? updatedTask : t));

    await supabase.from('tasks').update({
      ...mapToDb(updatedTask),
      ai_qc_status: overallStatus,
      ai_qc_results: nextResultsMap
    }).eq('id', selectedTask.id);

    await dispatchNotification(
      'role',
      'admin',
      'qc_bypass',
      `⚠️ AI QC Bypassed: "${rule.area_name} — ${rule.rule_title}" on "${selectedTask.title}" (${selectedTask.propertyName} - ${selectedTask.unitName}) bypassed by ${currentUserName}.`,
      '⚠️ AI QC Manual Review Needed',
      `${currentUserName} bypassed AI check on "${rule.area_name}" for "${selectedTask.title}". Tap to inspect.`,
      selectedTask.id,
      selectedInstanceDate
    );
  };

  const handleCompleteWithAiCheck = () => {
    if (selectedTask.requireAiQc && unitQcRules.length > 0) {
      const unverifiedRules = unitQcRules.filter(r => {
        const st = qcResultsMap[r.id]?.status;
        return st !== 'passed' && st !== 'bypassed';
      });
      if (unverifiedRules.length > 0) {
        return alert(`🤖 Please complete all AI Photo QC checks first (${unverifiedRules.length} remaining: ${unverifiedRules.map(r => r.area_name).join(', ')}).`);
      }
    }
    handleInitiateCompletion();
  };

  const completedRuleCount = unitQcRules.filter(r => ['passed', 'bypassed'].includes(qcResultsMap[r.id]?.status)).length;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50" onMouseDown={() => setSelectedTask(null)}>
      <div className="bg-[#F4F3ED] max-w-2xl w-full rounded-lg shadow-xl p-6 border border-gray-300 flex flex-col gap-4 animate-fade-in max-h-[90vh] overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start border-b border-gray-300 pb-3">
          <div>
            <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
              {isCurrentInstanceCompleted ? 'Completed Occurrence Review' : (userRole === 'admin' ? (isEditing ? 'Admin Full Task Editor' : 'Admin Inspector Mode') : 'Employee Execution View')}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-2xl font-serif font-bold">{selectedTask.title}</h2>
              <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-bold">{selectedTask.company}</span>
              {selectedTask.propertyName && (
                <span className="text-[10px] bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold">
                  🏨 {selectedTask.propertyName}{selectedTask.unitName ? ` — ${selectedTask.unitName}` : ''}
                </span>
              )}
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

            {selectedTask.desc && (
              <p className="text-sm text-gray-600 bg-white p-3 rounded border border-gray-200">{selectedTask.desc}</p>
            )}

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
                      } else if (userRole === 'admin') {
                        (selectedTask.assignees || []).forEach(assigneeName => {
                          dispatchNotification(
                            'userName',
                            assigneeName,
                            'schedule',
                            `📅 Schedule Update: "${selectedTask.title}" deadline changed to ${newDate}`,
                            '📅 Deadline Adjusted',
                            `Admin ${currentUserName} moved the deadline for "${selectedTask.title}" to ${newDate}`,
                            selectedTask.id,
                            newDate
                          );
                        });
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

            {/* PER-ITEM AI PHOTO QC CHECKLIST */}
            {selectedTask.requireAiQc && (
              <div className="bg-white p-3.5 rounded-lg border border-blue-300 flex flex-col gap-2.5 shadow-2xs">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <div>
                    <h4 className="font-bold text-xs uppercase tracking-wider text-blue-950 flex items-center gap-1.5">
                      <span>🤖 Required AI Photo QC Checklist</span>
                    </h4>
                    <span className="text-[11px] text-gray-500">
                      Tap or drop a photo on each item below for instant AI verification ({selectedTask.propertyName} — {selectedTask.unitName})
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                    unitQcRules.length > 0 && completedRuleCount === unitQcRules.length
                      ? 'bg-emerald-100 text-emerald-900'
                      : 'bg-blue-100 text-blue-900'
                  }`}>
                    {completedRuleCount} / {unitQcRules.length} Verified
                  </span>
                </div>

                {unitQcRules.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No AI QC rules configured for this unit's blueprints yet.</p>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {unitQcRules.map((rule) => {
                      const rState = qcResultsMap[rule.id] || {};
                      const isPassed = rState.status === 'passed';
                      const isBypassed = rState.status === 'bypassed';
                      const isFailed = rState.status === 'failed';
                      const isCheckingThis = checkingRuleIds.includes(rule.id);
                      const isDraggingThis = draggingRuleId === rule.id;
                      const failCount = rState.failCount || 0;

                      return (
                        <div
                          key={rule.id}
                          onDragOver={(e) => {
                            if (!isCurrentInstanceCompleted) {
                              e.preventDefault();
                              setDraggingRuleId(rule.id);
                            }
                          }}
                          onDragLeave={() => setDraggingRuleId(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDraggingRuleId(null);
                            if (!isCurrentInstanceCompleted && e.dataTransfer.files?.[0]) {
                              handleRulePhotoUpload(rule, e.dataTransfer.files[0]);
                            }
                          }}
                          className={`p-3 rounded-lg border transition flex flex-col gap-2 ${
                            isDraggingThis
                              ? 'border-blue-600 bg-blue-100/70'
                              : isPassed
                              ? 'bg-emerald-50/70 border-emerald-300'
                              : isBypassed
                              ? 'bg-amber-50/80 border-amber-300'
                              : isFailed
                              ? 'bg-red-50/60 border-red-300'
                              : 'bg-gray-50 border-gray-200 hover:bg-gray-100/70'
                          }`}
                        >
                          <div className="flex justify-between items-center gap-3">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <span className="mt-0.5 text-base shrink-0">
                                {isCheckingThis ? '⏳' : isPassed ? '✅' : isBypassed ? '⚠️' : isFailed ? '❌' : '⬜'}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                                    {rule.area_name}
                                  </span>
                                  <span className={`text-sm font-bold ${isPassed ? 'text-emerald-900' : 'text-gray-900'}`}>
                                    {rule.rule_title}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-600 mt-0.5">{rule.rule_description}</p>
                              </div>
                            </div>

                            {!isCurrentInstanceCompleted && (
                              <label className={`shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg cursor-pointer transition shadow-2xs flex items-center gap-1.5 ${
                                isCheckingThis
                                  ? 'bg-blue-200 text-blue-900 animate-pulse cursor-wait'
                                  : isPassed
                                  ? 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'
                                  : 'bg-[#333333] text-white hover:bg-black'
                              }`}>
                                <span>📷</span>
                                <span>
                                  {isCheckingThis
                                    ? 'Checking...'
                                    : isPassed || isFailed
                                    ? 'Retake Photo'
                                    : 'Take / Upload Photo'}
                                </span>
                                <input
                                  type="file"
                                  accept="*/*"
                                  disabled={isCheckingThis}
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) {
                                      handleRulePhotoUpload(rule, e.target.files[0]);
                                      e.target.value = '';
                                    }
                                  }}
                                />
                              </label>
                            )}
                          </div>

                          {/* SUBMITTED PHOTO THUMBNAIL + AI FEEDBACK */}
                          {(rState.imageUrl || rState.feedback) && (
                            <div className={`flex items-start gap-2.5 p-2 rounded border text-xs ${
                              isPassed
                                ? 'bg-white border-emerald-200 text-emerald-950'
                                : isBypassed
                                ? 'bg-white border-amber-300 text-amber-950'
                                : 'bg-white border-red-200 text-red-950'
                            }`}>
                              {rState.imageUrl && (
                                <a href={rState.imageUrl} target="_blank" rel="noopener noreferrer" className="shrink-0">
                                  <img
                                    src={rState.imageUrl}
                                    alt={rule.rule_title}
                                    className="w-12 h-12 rounded object-cover border border-gray-300"
                                  />
                                </a>
                              )}
                              <div className="flex-1 min-w-0">
                                <span className="font-bold block">
                                  {isPassed
                                    ? '✓ Passed AI Verification'
                                    : isBypassed
                                    ? '⚠️ Bypassed — Sent to Admin for Manual Review'
                                    : `✕ Attempt ${failCount} Failed — Adjustments Needed`}
                                </span>
                                <p className="text-[11px] text-gray-700 mt-0.5">{rState.feedback}</p>
                              </div>
                            </div>
                          )}

                          {/* 2-FAIL BYPASS ESCALATION PER ITEM */}
                          {!isCurrentInstanceCompleted && failCount >= 2 && !isPassed && !isBypassed && (
                            <div className="bg-amber-100/80 border border-amber-400 p-2 rounded flex flex-col gap-1.5 text-xs">
                              <span className="font-bold text-amber-950">
                                ⚠️ AI rejected this item {failCount} times. Everything actually set up properly?
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={ruleBypassNotes[rule.id] || ''}
                                  onChange={(e) => setRuleBypassNotes(prev => ({ ...prev, [rule.id]: e.target.value }))}
                                  placeholder="Optional note for Admin..."
                                  className="flex-1 p-1.5 text-xs border border-amber-300 rounded bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleBypassSingleRule(rule)}
                                  className="bg-amber-800 hover:bg-amber-900 text-white px-3 py-1.5 rounded text-xs font-bold shrink-0"
                                >
                                  ⚠️ Override & Flag Admin
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* INTERACTIVE MANUAL CHECKLIST VIEW */}
            {selectedTask.requireChecklist && selectedTask.checklist?.length > 0 && (
              <div className="bg-white p-3 rounded border border-gray-200 mb-1 mt-1">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500 mb-2">Required Checklist</h4>
                <div className="flex flex-col gap-1.5">
                  {selectedTask.checklist.map((item) => {
                    const isChecked = (item.completedDates || []).includes(selectedInstanceDate);
                    return (
                      <label key={item.id} className={`flex items-start gap-2 p-2 rounded border cursor-pointer transition ${isChecked ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          disabled={isCurrentInstanceCompleted}
                          onChange={() => handleToggleChecklistItem(selectedTask.id, item.id, selectedInstanceDate)} 
                          className="accent-green-600 w-4 h-4 mt-0.5" 
                        />
                        <span className={`text-sm ${isChecked ? 'line-through text-green-700 opacity-70' : 'text-gray-800 font-medium'}`}>{item.text}</span>
                      </label>
                    );
                  })}
                </div>
                
                {!isCurrentInstanceCompleted && selectedTask.checklist.some(i => !(i.completedDates || []).includes(selectedInstanceDate)) && (
                   <div className="mt-3 bg-red-50 p-2.5 rounded border border-red-200">
                     <label className="text-[10px] font-bold text-red-800 uppercase flex items-center gap-1"><span className="text-sm">⚠️</span> Reason for incomplete items (Required if completing task)</label>
                     <textarea 
                       value={checklistException} 
                       onChange={(e) => setChecklistException(e.target.value)} 
                       className="w-full text-xs p-1.5 border border-red-300 rounded mt-1.5 bg-white focus:outline-none" 
                       rows={2} 
                       placeholder="If you cannot complete every item above, explain why here to unlock completion..." 
                     />
                   </div>
                )}
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

            {/* UNIVERSAL ATTACHMENTS & GENERAL PROOF OF WORK */}
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
                    📎 General Attachments & Files
                    {selectedTask.requiresPhoto && !selectedTask.requireAiQc && <span className="text-red-600 font-bold ml-1">(Required)</span>}
                  </span>
                  <span className="text-[10px] text-gray-500">Upload or drag and drop additional images, PDFs, spreadsheets, etc.</span>
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
            </div>

            {/* EDIT MODE CHECKLIST & AI QC */}
            <div className="bg-white p-3 rounded border border-gray-200 flex flex-col gap-1.5 mt-1">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer border-b pb-2 mb-1 border-gray-100 font-bold">
                <input type="checkbox" checked={requireChecklist} onChange={(e) => setRequireChecklist(e.target.checked)} className="accent-[#A9B1A6] w-4 h-4" /> Require Checklist Completion (Mandatory items)
              </label>
              {requireChecklist && (
                <div className="flex flex-col gap-2 mb-2 bg-gray-50 p-3 rounded border border-gray-200">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sub-Checklist Items</span>
                    <button type="button" onClick={handleAddChecklistItem} className="text-[10px] font-bold bg-[#A9B1A6] text-white px-2 py-0.5 rounded">+ Add Item</button>
                  </div>
                  {checklist.map((item, idx) => (
                    <div key={item.id} className="flex gap-2">
                      <input type="text" value={item.text} onChange={(e) => handleUpdateChecklistItem(item.id, e.target.value)} placeholder={`Item ${idx + 1}...`} className="flex-1 p-1.5 text-xs border rounded bg-white" />
                      <button type="button" onClick={() => handleRemoveChecklistItem(item.id)} className="text-red-600 font-bold px-1 hover:text-red-800">✕</button>
                    </div>
                  ))}
                  {checklist.length === 0 && <span className="text-[10px] text-gray-400 italic">No items added.</span>}
                </div>
              )}
              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input type="checkbox" checked={requiresPhoto} onChange={(e) => setRequiresPhoto(e.target.checked)} className="accent-[#A9B1A6]" /> Require proof of work upload (Mandatory to complete)
              </label>

              <label className="flex items-center gap-1.5 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(requireAiQc)}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    if (typeof setRequireAiQc === 'function') setRequireAiQc(checked);
                    if (checked && typeof setRequiresPhoto === 'function') setRequiresPhoto(true);
                  }}
                  className="accent-blue-600"
                />
                <span>🤖 Require AI Photo QC</span>
              </label>

              {requireAiQc && (
                <div className="grid grid-cols-2 gap-2 bg-blue-50 p-2 rounded border border-blue-200 ml-4">
                  <select
                    value={propertyName || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (typeof setPropertyName === 'function') setPropertyName(val);
                      const matches = propertyUnits.filter(u => u.property_name === val);
                      if (matches.length === 1 && typeof setUnitName === 'function') setUnitName(matches[0].unit_name);
                      else if (typeof setUnitName === 'function') setUnitName('');
                    }}
                    className="p-1 border rounded bg-white font-bold"
                  >
                    <option value="">Select Property...</option>
                    {properties.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                  <select
                    value={unitName || ''}
                    onChange={(e) => typeof setUnitName === 'function' && setUnitName(e.target.value)}
                    className="p-1 border rounded bg-white font-bold"
                  >
                    <option value="">Select Unit...</option>
                    {propertyUnits.filter(u => u.property_name === propertyName).map(u => (
                      <option key={u.id} value={u.unit_name}>{u.unit_name}</option>
                    ))}
                  </select>
                </div>
              )}

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
                <button
                  disabled={checkingRuleIds.length > 0}
                  onClick={handleCompleteWithAiCheck}
                  className="bg-[#A9B1A6] text-white px-5 py-2 rounded text-xs font-bold shadow-sm hover:bg-gray-600 transition disabled:opacity-40"
                >
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