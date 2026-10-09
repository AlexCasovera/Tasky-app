// src/components/SettingsModal.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { enableNativePush } from '../utils';
import { supabase } from '../supabaseClient';

export default function SettingsModal({
  isSettingsOpen,
  setIsSettingsOpen,
  userRole,
  currentUserName,
  hiddenCompanies,
  setHiddenCompanies,
  masterCompanyList,
  hiddenMembers,
  setHiddenMembers,
  teamMembers,
  resetMemberForm,
  handleOpenEditMember,
  editingMemberId,
  memberName,
  setMemberName,
  memberEmail,
  setMemberEmail,
  memberPassword,
  setMemberPassword,
  showPassword,
  setShowPassword,
  memberRole,
  setMemberRole,
  memberColor,
  setMemberColor,
  handleDeleteMember,
  handleSaveMember,
  newCompanyInput,
  setNewCompanyInput,
  handleAddCompany,
  editingCompany,
  editingCompanyInput,
  setEditingCompanyInput,
  handleRenameCompany,
  setEditingCompany,
  handleDeleteCompany
}) {
  const [dispatchEnabled, setDispatchEnabled] = useState(true);
  const [deliveryTime, setDeliveryTime] = useState('08:00 AM');
  const [targetAssignee, setTargetAssignee] = useState(currentUserName || 'Alex M.');
  const [onlyHighPriority, setOnlyHighPriority] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [slackMemberId, setSlackMemberId] = useState('');

  useEffect(() => {
    async function loadSlackSettings() {
      if (!currentUserName) return;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`name.eq."${currentUserName}",full_name.eq."${currentUserName}"`)
        .single();

      if (data && !error) {
        if (data.slack_member_id) setSlackMemberId(data.slack_member_id);
        if (data.dispatch_enabled !== undefined) setDispatchEnabled(data.dispatch_enabled);
        if (data.dispatch_time) setDeliveryTime(data.dispatch_time);
        if (data.dispatch_target_assignee) setTargetAssignee(data.dispatch_target_assignee);
        if (data.dispatch_high_priority_only !== undefined) setOnlyHighPriority(data.dispatch_high_priority_only);
      }
    }
    if (isSettingsOpen) {
      loadSlackSettings();
    }
  }, [isSettingsOpen, currentUserName]);

  const handleSaveDispatchSettings = async (newEnabled, newTime, newTarget, newHighPriority) => {
    setDispatchEnabled(newEnabled);
    setDeliveryTime(newTime);
    setTargetAssignee(newTarget);
    setOnlyHighPriority(newHighPriority);

    await supabase
      .from('profiles')
      .update({
        dispatch_enabled: newEnabled,
        dispatch_time: newTime,
        dispatch_target_assignee: newTarget,
        dispatch_high_priority_only: newHighPriority
      })
      .or(`name.eq."${currentUserName}",full_name.eq."${currentUserName}"`);
  };

  const handleSendTest = async () => {
    setIsSendingTest(true);
    try {
      const activeSlackId = slackMemberId;
      if (!activeSlackId) {
        alert('Please make sure your Slack Member ID is saved in your Supabase profile first.');
        setIsSendingTest(false);
        return;
      }

      const res = await fetch('/api/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slackMemberId: activeSlackId,
          targetAssignee: targetAssignee || currentUserName,
          onlyHighPriority: onlyHighPriority
        })
      });

      const data = await res.json();
      if (!res.ok) {
        alert(`Error sending test: ${data.error || 'Check server logs'}`);
      } else {
        alert(`⚡ Test Dispatch sent to Slack for ${targetAssignee}! Check your Slack DMs.`);
      }
    } catch (err) {
      alert(`Network error sending test: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-end p-4 z-50" onMouseDown={() => setIsSettingsOpen(false)}>
      <div className="bg-[#F4F3ED] max-w-md w-full h-full rounded-l-lg shadow-2xl p-6 border-l border-gray-300 flex flex-col gap-4 animate-fade-in overflow-y-auto" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center border-b border-gray-300 pb-3">
          <div>
            <span className="text-xs font-bold text-[#A9B1A6] uppercase tracking-wider">
              {userRole === 'admin' ? 'System Governance' : 'My Preferences'}
            </span>
            <h2 className="text-2xl font-serif font-bold text-gray-900">
              {userRole === 'admin' ? 'Settings & Team' : 'App Settings'}
            </h2>
          </div>
          <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
        </div>

        {/* DEVICE PUSH ALERTS CARD */}
        <div className="bg-white p-4 rounded-lg border border-amber-300 flex justify-between items-center shadow-2xs">
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-amber-900">Device Push Alerts</h4>
            <p className="text-[11px] text-gray-500 mt-0.5">Enable native lock-screen notifications for this browser/device.</p>
          </div>
          <button 
            onClick={() => enableNativePush(currentUserName || 'Alex M.')}
            className="bg-amber-100 text-amber-900 border border-amber-300 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-amber-200 transition shrink-0 shadow-2xs">
            📲 Enable Push Alerts
          </button>
        </div>

        {/* SLACK MORNING DISPATCH MODULE */}
        <div className="bg-white p-4 rounded-lg border border-emerald-400 flex flex-col gap-3 shadow-2xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">☀️</span>
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950">Slack Morning Dispatch</h4>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={dispatchEnabled} 
                onChange={(e) => handleSaveDispatchSettings(e.target.checked, deliveryTime, targetAssignee, onlyHighPriority)}
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
          <p className="text-[11px] text-gray-500">
            Receive an automated morning breakdown of your tasks directly in Slack.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Delivery Time:</span>
              <select 
                value={deliveryTime}
                onChange={(e) => handleSaveDispatchSettings(dispatchEnabled, e.target.value, targetAssignee, onlyHighPriority)}
                className="p-1.5 border border-gray-300 rounded bg-white text-xs font-semibold focus:outline-none">
                <option value="06:00 AM">06:00 AM</option>
                <option value="07:00 AM">07:00 AM</option>
                <option value="08:00 AM">08:00 AM</option>
                <option value="09:00 AM">09:00 AM</option>
                <option value="10:00 AM">10:00 AM</option>
              </select>
            </div>

            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span>Include tasks for:</span>
              <select 
                value={targetAssignee}
                onChange={(e) => handleSaveDispatchSettings(dispatchEnabled, deliveryTime, e.target.value, onlyHighPriority)}
                className="p-1.5 border border-gray-300 rounded bg-white text-xs font-semibold focus:outline-none">
                {teamMembers.map(m => (
                  <option key={m.id} value={m.name}>{m.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
              <input 
                type="checkbox" 
                checked={onlyHighPriority} 
                onChange={(e) => handleSaveDispatchSettings(dispatchEnabled, deliveryTime, targetAssignee, e.target.checked)}
                className="accent-emerald-600" 
              />
              Only include High Priority tasks
            </label>

            <button 
              onClick={handleSendTest}
              disabled={isSendingTest}
              className="mt-1 w-full bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition rounded-md py-2 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs disabled:opacity-50">
              {isSendingTest ? '⚡ Sending...' : '⚡ Send Test to My Slack'}
            </button>
          </div>
        </div>

        {/* ADMIN ONLY CONTROLS */}
        {userRole === 'admin' && (
          <>
            {/* DASHBOARD VISIBILITY MODULE */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Dashboard Visibility (This Device)</h4>
              <p className="text-[10px] text-gray-500">Uncheck items below to completely hide them from your personal dashboard filters and calendar views.</p>
              
              <div className="flex gap-6 mt-1">
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Companies</span>
                  {masterCompanyList.map(comp => (
                    <label key={comp} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!hiddenCompanies.includes(comp)} 
                        onChange={(e) => {
                          if (e.target.checked) setHiddenCompanies(prev => prev.filter(c => c !== comp));
                          else setHiddenCompanies(prev => [...prev, comp]);
                        }} 
                        className="accent-[#A9B1A6]" 
                      /> 
                      {comp}
                    </label>
                  ))}
                </div>
                <div className="w-1/2 flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Team Members</span>
                  {teamMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!hiddenMembers.includes(m.name)} 
                        onChange={(e) => {
                          if (e.target.checked) setHiddenMembers(prev => prev.filter(n => n !== m.name));
                          else setHiddenMembers(prev => [...prev, m.name]);
                        }} 
                        className="accent-[#A9B1A6]" 
                      /> 
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ACTIVE TEAM MEMBERS LIST */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Active Team Members</h4>
                <button 
                  onClick={resetMemberForm} 
                  className="text-xs font-bold bg-[#A9B1A6] text-white px-2 py-0.5 rounded hover:bg-gray-600 transition">
                  + Add New
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {teamMembers.map(member => (
                  <div key={member.id} className="flex justify-between items-center p-2 rounded bg-gray-50 border border-gray-200">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: member.color }}></span>
                      <div>
                        <span className="font-bold text-xs text-gray-800 block">{member.name} ({member.role.toUpperCase()})</span>
                        <span className="text-[10px] text-gray-500">{member.email}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleOpenEditMember(member)} 
                      className="text-xs font-bold text-blue-700 hover:underline">
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* MEMBER EDIT / CREATE FORM */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">
                {editingMemberId ? 'Edit Team Member Profile' : 'Create New Team Member'}
              </h4>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={memberName} 
                  onChange={(e) => setMemberName(e.target.value)} 
                  placeholder="e.g. Jordan Smith" 
                  className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  value={memberEmail} 
                  onChange={(e) => setMemberEmail(e.target.value)} 
                  placeholder="jordan@company.com" 
                  className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                <div className="relative flex items-center">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    value={memberPassword} 
                    onChange={(e) => setMemberPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="w-full p-2 text-xs border border-gray-300 rounded focus:outline-none pr-12" />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 text-[10px] font-bold text-gray-500 hover:text-gray-800">
                    {showPassword ? 'HIDE' : 'SHOW'}
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-1/2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Role / Access</label>
                  <select 
                    value={memberRole} 
                    onChange={(e) => setMemberRole(e.target.value)} 
                    className="w-full p-2 text-xs border border-gray-300 rounded bg-white">
                    <option value="admin">Admin (Master)</option>
                    <option value="employee">Employee (Worker)</option>
                  </select>
                </div>

                <div className="w-1/2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">Assigned Color</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="color" 
                      value={memberColor} 
                      onChange={(e) => setMemberColor(e.target.value)} 
                      className="w-8 h-8 rounded border border-gray-300 cursor-pointer p-0 bg-white" />
                    <span className="text-xs font-mono font-bold text-gray-600">{memberColor}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-200">
                {editingMemberId && (
                  <button 
                    onClick={() => handleDeleteMember(editingMemberId, memberName)}
                    className="text-xs text-red-600 font-bold hover:underline">
                    Delete Profile
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <button 
                    onClick={resetMemberForm}
                    className="px-3 py-1.5 rounded text-xs font-bold text-gray-500 hover:bg-gray-100">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveMember}
                    className="bg-[#333333] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                    {editingMemberId ? 'Update Profile' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>

            {/* COMPANY MANAGEMENT */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 mt-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Company Management</h4>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  value={newCompanyInput}
                  onChange={(e) => setNewCompanyInput(e.target.value)}
                  placeholder="New Company Name"
                  className="flex-1 p-2 text-xs border border-gray-300 rounded focus:outline-none"
                />
                <button 
                  onClick={handleAddCompany}
                  className="bg-[#333333] text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                  Add
                </button>
              </div>
              <div className="flex flex-col gap-1 mt-2">
                {masterCompanyList.map(comp => (
                  <div key={comp} className="flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-100 text-xs">
                    {editingCompany === comp ? (
                      <div className="flex items-center gap-2 w-full">
                        <input 
                          type="text" 
                          value={editingCompanyInput} 
                          onChange={(e) => setEditingCompanyInput(e.target.value)}
                          className="flex-1 p-1 text-xs border border-gray-300 rounded focus:outline-none bg-white font-bold"
                        />
                        <button 
                          onClick={() => handleRenameCompany(comp, editingCompanyInput)}
                          className="text-green-700 font-bold hover:underline">Save</button>
                        <button 
                          onClick={() => setEditingCompany(null)}
                          className="text-gray-500 font-bold hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className="font-bold text-gray-700">{comp}</span>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => {
                              setEditingCompany(comp);
                              setEditingCompanyInput(comp);
                            }}
                            className="text-blue-600 font-bold hover:underline">Edit</button>
                          <button 
                            onClick={() => handleDeleteCompany(comp)}
                            className="text-red-500 font-bold hover:underline">Remove</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}