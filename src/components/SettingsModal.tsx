// src/components/SettingsModal.tsx
// @ts-nocheck
import { useState } from 'react';
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
  setTeamMembers,
  resetMemberForm,
  handleOpenEditMember,
  editingMemberId,
  memberName,
  setMemberName,
  memberEmail,
  setMemberEmail,
  memberPassword,
  setMemberPassword,
  memberSlackId,
  setMemberSlackId,
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
  handleDeleteCompany,
  formatDateKey,
  currentDate
}) {
  if (!isSettingsOpen) return null;

  // Initialize objects early so we can use their DB values as default states
  const loggedInUserObj = teamMembers.find(m => m.name === currentUserName) || teamMembers[0];

  const [dispatchEnabled, setDispatchEnabled] = useState(loggedInUserObj?.dispatch_enabled || false);
  const [selectedDispatchMember, setSelectedDispatchMember] = useState(() => {
    return loggedInUserObj?.dispatch_target_name || currentUserName || (teamMembers[0]?.name || '');
  });
  const [onlyHighPriority, setOnlyHighPriority] = useState(loggedInUserObj?.dispatch_priority_only || false);
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [dispatchStatusMessage, setDispatchStatusMessage] = useState('');
  const [isSavingSlackId, setIsSavingSlackId] = useState(false);

  const targetMemberObj = teamMembers.find(m => m.name === selectedDispatchMember) || teamMembers[0];

  // Instantly sync dispatch settings to Supabase when toggled
  const handleDispatchPreferenceChange = async (field, value) => {
    if (!loggedInUserObj) return;

    // Optimistic UI update for instantaneous feel
    if (field === 'dispatch_enabled') setDispatchEnabled(value);
    if (field === 'dispatch_target_name') setSelectedDispatchMember(value);
    if (field === 'dispatch_priority_only') setOnlyHighPriority(value);

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', loggedInUserObj.id);

    if (error) {
      alert(`Error saving ${field}: ${error.message}`);
    }
  };

  const handleQuickSaveSlackId = async (newSlackId) => {
    if (!loggedInUserObj) return;
    setIsSavingSlackId(true);
    setDispatchStatusMessage('');

    const cleanId = newSlackId.trim();
    const { error } = await supabase
      .from('profiles')
      .update({ slack_user_id: cleanId || null })
      .eq('id', loggedInUserObj.id);

    if (error) {
      alert(`Error saving Slack ID: ${error.message}`);
    } else {
      setTeamMembers(prev => prev.map(m => m.id === loggedInUserObj.id ? { ...m, slackUserId: cleanId } : m));
      setDispatchStatusMessage('✓ Slack ID saved successfully');
    }
    setIsSavingSlackId(false);
  };

  const handleSendTestDispatch = async () => {
    if (!loggedInUserObj?.slackUserId) {
      alert(`Please save a Slack Member ID for your account (${loggedInUserObj?.name || 'this user'}) first.`);
      return;
    }

    setIsSendingTest(true);
    setDispatchStatusMessage('');

    const payload = {
      targetMemberName: targetMemberObj.name,
      slackUserId: loggedInUserObj.slackUserId, 
      onlyHighPriority: onlyHighPriority,
      date: formatDateKey ? formatDateKey(currentDate || new Date()) : new Date().toISOString().split('T')[0]
    };

    try {
      let response;
      try {
        response = await fetch('https://tasky-app-gilt.vercel.app/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (externalErr) {
        response = await fetch('/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (!response.ok && response.status === 404) {
        response = await fetch('/api/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await response.json();
      if (!response.ok) {
        alert(`Error sending test: ${data.error || 'Unknown error'}`);
      } else {
        alert(`✓ Dispatch sent to Slack! Delivered agenda with ${data.count} task${data.count === 1 ? '' : 's'}.`);
      }
    } catch (err) {
      alert(`Error sending test: ${err.message}`);
    } finally {
      setIsSendingTest(false);
    }
  };

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

        {/* PUSH NOTIFICATION SETTINGS CARD */}
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
        <div className="bg-white p-4 rounded-lg border border-emerald-300 flex flex-col gap-3 shadow-2xs">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5">
              <span className="text-base">☀️</span>
              <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-950">Slack Morning Dispatch</h4>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={dispatchEnabled} 
                onChange={(e) => handleDispatchPreferenceChange('dispatch_enabled', e.target.checked)} 
                className="sr-only peer" 
              />
              <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <p className="text-[10px] text-gray-500">
            Receive an automated morning breakdown of your tasks directly in Slack every weekday at 8:00 AM (AZ Time).
          </p>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs font-bold text-gray-700">Include tasks for:</span>
            <select 
              value={selectedDispatchMember} 
              onChange={(e) => handleDispatchPreferenceChange('dispatch_target_name', e.target.value)} 
              className="text-xs font-bold p-1.5 border border-gray-300 rounded bg-white">
              {teamMembers.map(m => (
                <option key={m.id} value={m.name}>{m.name} ({m.role})</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-2.5 rounded border border-gray-200 flex flex-col gap-1.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="font-bold text-[11px] text-gray-700">
                Slack Destination ID ({loggedInUserObj?.name}):
              </span>
              {loggedInUserObj?.slackUserId ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                  ✓ Connected
                </span>
              ) : (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                  Missing ID
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <input 
                type="text"
                value={loggedInUserObj?.slackUserId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setTeamMembers(prev => prev.map(m => m.id === loggedInUserObj?.id ? { ...m, slackUserId: val } : m));
                }}
                placeholder="e.g. U08S5KMHT08"
                className="flex-1 p-1.5 text-xs font-mono border rounded bg-white"
              />
              <button 
                type="button"
                disabled={isSavingSlackId}
                onClick={() => handleQuickSaveSlackId(loggedInUserObj?.slackUserId || '')}
                className="bg-gray-800 text-white px-2.5 py-1 text-xs font-bold rounded hover:bg-black transition">
                {isSavingSlackId ? 'Saving...' : 'Save'}
              </button>
            </div>
            {dispatchStatusMessage && (
              <span className="text-[10px] text-emerald-700 font-semibold">{dispatchStatusMessage}</span>
            )}
          </div>

          <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer pt-1">
            <input 
              type="checkbox" 
              checked={onlyHighPriority} 
              onChange={(e) => handleDispatchPreferenceChange('dispatch_priority_only', e.target.checked)} 
              className="accent-emerald-600 w-3.5 h-3.5" 
            />
            <span>Only include High Priority tasks</span>
          </label>

          <button 
            type="button"
            disabled={isSendingTest}
            onClick={handleSendTestDispatch}
            className="w-full bg-emerald-50 text-emerald-900 border border-emerald-300 py-2 rounded text-xs font-bold hover:bg-emerald-100 transition shadow-2xs flex items-center justify-center gap-1.5">
            <span>⚡</span> {isSendingTest ? 'Sending Dispatch...' : 'Send Test to My Slack'}
          </button>
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
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: member.color }}></span>
                      <div>
                        <span className="font-bold text-xs text-gray-800 block">{member.name} ({member.role.toUpperCase()})</span>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500">
                          <span>{member.email}</span>
                          {member.slackUserId && (
                            <span className="bg-emerald-100 text-emerald-800 px-1 rounded font-mono font-bold">
                              Slack: {member.slackUserId}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleOpenEditMember(member)} 
                      className="text-xs font-bold text-blue-700 hover:underline shrink-0">
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* EDIT/CREATE TEAM MEMBER PROFILE FORM */}
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

              {/* SLACK USER ID FIELD */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Slack User ID</label>
                <input 
                  type="text" 
                  value={memberSlackId} 
                  onChange={(e) => setMemberSlackId(e.target.value)} 
                  placeholder="e.g. U08S5KMHT08" 
                  className="w-full p-2 text-xs font-mono border border-gray-300 rounded focus:outline-none" />
                <span className="text-[10px] text-gray-500 mt-0.5 block">Find in Slack: Member profile &gt; Three Dots (...) &gt; Copy Member ID</span>
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