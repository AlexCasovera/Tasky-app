// src/components/SettingsModal.tsx
// @ts-nocheck
import { useState, useEffect, useRef } from 'react';
import { enableNativePush, compressImage } from '../utils';
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
  currentDate,
  companiesData,
  setCompaniesData,
  hideInventoryBtn,
  setHideInventoryBtn,
  hideSupplyBtn,
  setHideSupplyBtn
}) {
  if (!isSettingsOpen) return null;

  const loggedInUserObj = teamMembers.find(m => m.name === currentUserName) || teamMembers[0];

  const [dispatchEnabled, setDispatchEnabled] = useState(loggedInUserObj?.dispatch_enabled || false);
  const [selectedDispatchMember, setSelectedDispatchMember] = useState(() => {
    return loggedInUserObj?.dispatch_target_name || currentUserName || (teamMembers[0]?.name || '');
  });
  const [onlyHighPriority, setOnlyHighPriority] = useState(loggedInUserObj?.dispatch_priority_only || false);
  
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [dispatchStatusMessage, setDispatchStatusMessage] = useState('');
  const [isSavingSlackId, setIsSavingSlackId] = useState(false);

  const [memberInventoryAccess, setMemberInventoryAccess] = useState(false);
  const [memberSupplyAccess, setMemberSupplyAccess] = useState(false);
  const [memberSupplyCompanies, setMemberSupplyCompanies] = useState([]);
  const [memberAllowInProgress, setMemberAllowInProgress] = useState(false);

  // Properties & AI QC Manager Modal State
  const [isQcManagerOpen, setIsQcManagerOpen] = useState(false);
  const [qcTab, setQcTab] = useState('rules'); // 'properties' | 'rules'
  const [properties, setProperties] = useState([]);
  const [propertyUnits, setPropertyUnits] = useState([]);
  const [qcRules, setQcRules] = useState([]);

  // New / Edit Property State
  const [newPropName, setNewPropName] = useState('');
  const [newPropNotes, setNewPropNotes] = useState('');
  const [editingPropId, setEditingPropId] = useState(null);
  const [editPropName, setEditPropName] = useState('');
  const [editPropNotes, setEditPropNotes] = useState('');

  // New / Edit Unit State (Multi-Tag Blueprints)
  const [selectedPropForUnit, setSelectedPropForUnit] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitBlueprints, setNewUnitBlueprints] = useState(['Office']);
  const [newBlueprintTagInput, setNewBlueprintTagInput] = useState('');
  const [newUnitIcal, setNewUnitIcal] = useState('');

  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitName, setEditUnitName] = useState('');
  const [editUnitBlueprints, setEditUnitBlueprints] = useState([]);
  const [editBlueprintTagInput, setEditBlueprintTagInput] = useState('');
  const [editUnitIcal, setEditUnitIcal] = useState('');

  // New / Edit AI QC Rule Form
  const [editingRuleId, setEditingRuleId] = useState(null);
  const [ruleBlueprint, setRuleBlueprint] = useState('Office');
  const [ruleAreaName, setRuleAreaName] = useState('');
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleDescription, setRuleDescription] = useState('');
  const [ruleRefImageUrl, setRuleRefImageUrl] = useState('');
  const [isUploadingRefImg, setIsUploadingRefImg] = useState(false);
  const [isDraggingRefImg, setIsDraggingRefImg] = useState(false);
  const [isSavingRule, setIsSavingRule] = useState(false);
  const refFileInputRef = useRef(null);

  const targetMemberObj = teamMembers.find(m => m.name === selectedDispatchMember) || teamMembers[0];

  const getUnitBlueprints = (unit) => {
    if (Array.isArray(unit.blueprints) && unit.blueprints.length > 0) return unit.blueprints;
    return unit.blueprint ? [unit.blueprint] : [];
  };

  const fetchPropertiesAndQc = async () => {
    const [{ data: propsData }, { data: unitsData }, { data: rulesData }] = await Promise.all([
      supabase.from('properties').select('*').order('name'),
      supabase.from('property_units').select('*').order('property_name').order('unit_name'),
      supabase.from('ai_qc_rules').select('*').order('blueprint').order('area_name')
    ]);
    if (propsData) {
      setProperties(propsData);
      if (!selectedPropForUnit && propsData.length > 0) {
        setSelectedPropForUnit(propsData[0].id);
      }
    }
    if (unitsData) setPropertyUnits(unitsData);
    if (rulesData) setQcRules(rulesData);
  };

  useEffect(() => {
    if (isQcManagerOpen) {
      fetchPropertiesAndQc();
    }
  }, [isQcManagerOpen]);

  const handleCreateProperty = async () => {
    if (!newPropName.trim()) return alert('Enter a property name (e.g., The Cedara).');
    const { error } = await supabase.from('properties').insert({
      name: newPropName.trim(),
      notes: newPropNotes.trim()
    });
    if (error) return alert(`Error adding property: ${error.message}`);
    setNewPropName('');
    setNewPropNotes('');
    fetchPropertiesAndQc();
  };

  const handleStartEditProperty = (prop) => {
    setEditingPropId(prop.id);
    setEditPropName(prop.name || '');
    setEditPropNotes(prop.notes || '');
  };

  const handleSaveEditProperty = async (prop) => {
    const trimmedName = editPropName.trim();
    if (!trimmedName) return alert('Property name cannot be empty.');

    const { error } = await supabase
      .from('properties')
      .update({ name: trimmedName, notes: editPropNotes.trim() })
      .eq('id', prop.id);

    if (error) return alert(`Error updating property: ${error.message}`);

    if (trimmedName !== prop.name) {
      await supabase
        .from('property_units')
        .update({ property_name: trimmedName })
        .eq('property_name', prop.name);

      await supabase
        .from('tasks')
        .update({ property_name: trimmedName })
        .eq('property_name', prop.name);
    }

    setEditingPropId(null);
    setEditPropName('');
    setEditPropNotes('');
    fetchPropertiesAndQc();
  };

  const handleDeleteProperty = async (prop) => {
    if (!window.confirm(`Delete "${prop.name}" and all its units?`)) return;
    await supabase.from('properties').delete().eq('id', prop.id);
    fetchPropertiesAndQc();
  };

  const addNewUnitBlueprintTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setNewUnitBlueprints(prev => (prev.includes(clean) ? prev : [...prev, clean]));
    setNewBlueprintTagInput('');
  };

  const removeNewUnitBlueprintTag = (tag) => {
    setNewUnitBlueprints(prev => prev.filter(t => t !== tag));
  };

  const addEditUnitBlueprintTag = (tag) => {
    const clean = tag.trim();
    if (!clean) return;
    setEditUnitBlueprints(prev => (prev.includes(clean) ? prev : [...prev, clean]));
    setEditBlueprintTagInput('');
  };

  const removeEditUnitBlueprintTag = (tag) => {
    setEditUnitBlueprints(prev => prev.filter(t => t !== tag));
  };

  const handleCreateUnit = async () => {
    const parentProp = properties.find(p => p.id === selectedPropForUnit);
    if (!parentProp) return alert('Please select a parent property.');
    if (!newUnitName.trim()) return alert('Enter a unit/room name (e.g., Mesquite (S1)).');

    const finalTags = newBlueprintTagInput.trim()
      ? [...new Set([...newUnitBlueprints, newBlueprintTagInput.trim()])]
      : newUnitBlueprints;

    if (finalTags.length === 0) return alert('Add at least one Blueprint tag (e.g., Office, Studio, Balcony).');

    const { error } = await supabase.from('property_units').insert({
      property_id: parentProp.id,
      property_name: parentProp.name,
      unit_name: newUnitName.trim(),
      blueprint: finalTags[0],
      blueprints: finalTags,
      ical_url: newUnitIcal.trim()
    });
    if (error) return alert(`Error adding unit: ${error.message}`);
    setNewUnitName('');
    setNewBlueprintTagInput('');
    setNewUnitIcal('');
    fetchPropertiesAndQc();
  };

  const handleStartEditUnit = (unit) => {
    setEditingUnitId(unit.id);
    setEditUnitName(unit.unit_name || '');
    setEditUnitBlueprints(getUnitBlueprints(unit));
    setEditBlueprintTagInput('');
    setEditUnitIcal(unit.ical_url || '');
  };

  const handleSaveEditUnit = async (unit) => {
    const trimmedUnit = editUnitName.trim();
    const finalTags = editBlueprintTagInput.trim()
      ? [...new Set([...editUnitBlueprints, editBlueprintTagInput.trim()])]
      : editUnitBlueprints;

    if (!trimmedUnit || finalTags.length === 0) {
      return alert('Unit name and at least one Blueprint tag are required.');
    }

    const { error } = await supabase
      .from('property_units')
      .update({
        unit_name: trimmedUnit,
        blueprint: finalTags[0],
        blueprints: finalTags,
        ical_url: editUnitIcal.trim()
      })
      .eq('id', unit.id);

    if (error) return alert(`Error updating unit: ${error.message}`);

    if (trimmedUnit !== unit.unit_name) {
      await supabase
        .from('tasks')
        .update({ unit_name: trimmedUnit })
        .eq('property_name', unit.property_name)
        .eq('unit_name', unit.unit_name);
    }

    setEditingUnitId(null);
    fetchPropertiesAndQc();
  };

  const handleDeleteUnit = async (unit) => {
    if (!window.confirm(`Remove unit "${unit.unit_name}"?`)) return;
    await supabase.from('property_units').delete().eq('id', unit.id);
    fetchPropertiesAndQc();
  };

  const handleUploadGoldenReference = async (file) => {
    if (!file || !file.type.startsWith('image/')) return alert('Please select or drop an image file.');
    setIsUploadingRefImg(true);
    try {
      const compressed = await compressImage(file, 1280, 1280, 0.75);
      const ext = compressed.name?.split('.').pop() || 'jpg';
      const fileName = `qc-ref-${Date.now()}-${Math.random().toString(36).substring(2, 6)}.${ext}`;
      const { error: upErr } = await supabase.storage.from('task-proofs').upload(fileName, compressed);
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('task-proofs').getPublicUrl(fileName);
      setRuleRefImageUrl(data.publicUrl);
    } catch (err) {
      alert(`Reference photo upload failed: ${err.message}`);
    } finally {
      setIsUploadingRefImg(false);
      if (refFileInputRef.current) refFileInputRef.current.value = '';
    }
  };

  const resetRuleForm = () => {
    setEditingRuleId(null);
    setRuleAreaName('');
    setRuleTitle('');
    setRuleDescription('');
    setRuleRefImageUrl('');
    setIsDraggingRefImg(false);
  };

  const handleEditRule = (rule) => {
    setEditingRuleId(rule.id);
    setRuleBlueprint(rule.blueprint || 'Office');
    setRuleAreaName(rule.area_name || '');
    setRuleTitle(rule.rule_title || '');
    setRuleDescription(rule.rule_description || '');
    setRuleRefImageUrl(rule.reference_image_url || '');
  };

  const handleSaveQcRule = async () => {
    if (!ruleBlueprint.trim() || !ruleAreaName.trim() || !ruleTitle.trim() || !ruleDescription.trim()) {
      return alert('Blueprint, Area Name, Rule Title, and Instructions are all required.');
    }
    setIsSavingRule(true);
    const payload = {
      blueprint: ruleBlueprint.trim(),
      area_name: ruleAreaName.trim(),
      rule_title: ruleTitle.trim(),
      rule_description: ruleDescription.trim(),
      requires_balcony: false,
      reference_image_url: ruleRefImageUrl.trim(),
      active: true
    };

    try {
      if (editingRuleId) {
        const { error } = await supabase.from('ai_qc_rules').update(payload).eq('id', editingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ai_qc_rules').insert(payload);
        if (error) throw error;
      }
      resetRuleForm();
      await fetchPropertiesAndQc();
    } catch (err) {
      alert(`Error saving AI QC rule: ${err.message}`);
    } finally {
      setIsSavingRule(false);
    }
  };

  const handleDeleteRule = async (rule) => {
    if (!window.confirm(`Delete QC rule "${rule.rule_title}"?`)) return;
    await supabase.from('ai_qc_rules').delete().eq('id', rule.id);
    if (editingRuleId === rule.id) resetRuleForm();
    fetchPropertiesAndQc();
  };

  const handleOpenEditMemberCustom = (member) => {
    handleOpenEditMember(member);
    setMemberInventoryAccess(Boolean(member.inventoryAccess));
    setMemberSupplyAccess(Boolean(member.supplySheetAccess));
    setMemberAllowInProgress(Boolean(member.allowInProgress || member.allow_in_progress));
    const rawComps = member.supplySheetCompanies || [];
    setMemberSupplyCompanies(Array.isArray(rawComps) ? rawComps : JSON.parse(rawComps || '[]'));
  };

  const handleResetMemberCustom = () => {
    resetMemberForm();
    setMemberInventoryAccess(false);
    setMemberSupplyAccess(false);
    setMemberAllowInProgress(false);
    setMemberSupplyCompanies([]);
  };

  const handleDispatchPreferenceChange = async (field, value) => {
    if (!loggedInUserObj) return;

    if (field === 'dispatch_enabled') setDispatchEnabled(value);
    if (field === 'dispatch_target_name') setSelectedDispatchMember(value);
    if (field === 'dispatch_priority_only') setOnlyHighPriority(value);

    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', loggedInUserObj.id);

    if (error) {
      alert(`Error saving ${field}: ${error.message}`);
    } else {
      setTeamMembers(prev => prev.map(m => 
        m.id === loggedInUserObj.id ? { ...m, [field]: value } : m
      ));
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

  const handleSaveMemberWithPermissions = async () => {
    if (!memberName.trim()) return alert('Please enter a name.');

    const initials = memberName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    const payload = {
      name: memberName,
      initials,
      role: memberRole,
      color: memberColor,
      slack_user_id: memberSlackId.trim() || null,
      inventory_access: memberInventoryAccess,
      supply_sheet_access: memberSupplyAccess,
      supply_sheet_companies: memberSupplyCompanies,
      allow_in_progress: memberAllowInProgress
    };

    if (editingMemberId) {
      const { error } = await supabase.from('profiles').update(payload).eq('id', editingMemberId);
      if (error) return alert(`Error updating team member: ${error.message}`);
    } else {
      if (!memberEmail.trim()) return alert('Please enter an email address.');
      const newId = crypto.randomUUID();
      const { error } = await supabase.from('profiles').insert({
        id: newId,
        email: memberEmail,
        ...payload
      });
      if (error) return alert(`Error creating team member: ${error.message}`);
    }

    const { data: updatedProfiles } = await supabase.from('profiles').select('*');
    if (updatedProfiles) {
      setTeamMembers(updatedProfiles.map(p => ({
        id: p.id,
        name: p.name || p.email.split('@')[0],
        initials: p.initials || p.email.substring(0, 2).toUpperCase(),
        email: p.email,
        role: p.role || 'employee',
        color: p.color || '#2A9D8F',
        slackUserId: p.slack_user_id || '',
        inventoryAccess: Boolean(p.inventory_access),
        supplySheetAccess: Boolean(p.supply_sheet_access),
        supplySheetCompanies: p.supply_sheet_companies || [],
        allowInProgress: Boolean(p.allow_in_progress)
      })));
    }

    handleResetMemberCustom();
  };

  const toggleCompanyInventory = async (companyName, currentStatus) => {
    const newStatus = !currentStatus;

    if (typeof setCompaniesData === 'function') {
      setCompaniesData(prev => {
        const exists = prev.some(c => c.name === companyName);
        if (exists) {
          return prev.map(c => c.name === companyName ? { ...c, inventory_enabled: newStatus } : c);
        }
        return [...prev, { name: companyName, inventory_enabled: newStatus, inventory_manager: currentUserName }];
      });
    }

    try {
      const { data, error } = await supabase
        .from('companies')
        .update({ inventory_enabled: newStatus })
        .eq('name', companyName)
        .select();

      if (error) {
        alert(`Error updating company inventory: ${error.message}`);
        if (typeof setCompaniesData === 'function') {
          setCompaniesData(prev => prev.map(c => c.name === companyName ? { ...c, inventory_enabled: currentStatus } : c));
        }
      } else if (!data || data.length === 0) {
        await supabase
          .from('companies')
          .upsert({ name: companyName, inventory_enabled: newStatus, inventory_manager: currentUserName });
      }
    } catch (err) {
      console.error('Failed to toggle company inventory:', err);
    }
  };

  const handleCompanyManagerChange = async (companyName, managerName) => {
    if (typeof setCompaniesData === 'function') {
      setCompaniesData(prev => prev.map(c => 
        c.name === companyName ? { ...c, inventory_manager: managerName } : c
      ));
    }

    const { error } = await supabase
      .from('companies')
      .update({ inventory_manager: managerName || null })
      .eq('name', companyName);

    if (error) alert(`Error saving inventory manager: ${error.message}`);
  };

  const toggleSupplyCompany = (companyName) => {
    setMemberSupplyCompanies(prev => 
      prev.includes(companyName) 
        ? prev.filter(c => c !== companyName) 
        : [...prev, companyName]
    );
  };

  const allUnitTags = propertyUnits.flatMap(u => getUnitBlueprints(u));
  const distinctBlueprints = [...new Set(['Office', 'Studio', 'Penthouse_2B2B', 'Balcony', ...allUnitTags, ...qcRules.map(r => r.blueprint)])];

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

        {/* PUSH NOTIFICATIONS */}
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

        {/* ADMIN ONLY: PROPERTIES & AI QC STANDARDS LAUNCHER */}
        {userRole === 'admin' && (
          <div className="bg-white p-4 rounded-lg border border-blue-300 flex justify-between items-center shadow-2xs">
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-blue-950">🏨 Properties, Units & AI QC</h4>
              <p className="text-[11px] text-gray-500 mt-0.5">Configure rooms, blueprints, iCal links & AI photo reference rules.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsQcManagerOpen(true)}
              className="bg-[#333333] hover:bg-black text-white px-3 py-2 rounded-lg text-xs font-bold transition shrink-0 shadow-2xs"
            >
              Manage →
            </button>
          </div>
        )}

        {/* SLACK MORNING DISPATCH */}
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
            {/* DASHBOARD VISIBILITY */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 shadow-2xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Dashboard Visibility (This Device)</h4>
              <p className="text-[10px] text-gray-500">Uncheck items below to hide them from your personal dashboard UI without revoking your permissions.</p>
              
              <div className="flex gap-6 mt-1 flex-wrap">
                <div className="w-full sm:w-[45%] flex flex-col gap-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Features</span>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!hideInventoryBtn} 
                      onChange={(e) => setHideInventoryBtn(!e.target.checked)} 
                      className="accent-[#A9B1A6]" 
                    /> 
                    Inventory Button
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!hideSupplyBtn} 
                      onChange={(e) => setHideSupplyBtn(!e.target.checked)} 
                      className="accent-[#A9B1A6]" 
                    /> 
                    Supply Sheet Button
                  </label>
                </div>

                <div className="w-full sm:w-[45%] flex flex-col gap-2">
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

                <div className="w-full flex flex-col gap-2 mt-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Team Members</span>
                  <div className="grid grid-cols-2 gap-2">
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
            </div>

            {/* ACTIVE TEAM MEMBERS LIST */}
            <div className="bg-white p-3 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-gray-500">Active Team Members</h4>
                <button 
                  onClick={handleResetMemberCustom} 
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
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-xs text-gray-800">{member.name} ({member.role.toUpperCase()})</span>
                          {member.allowInProgress && (
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-900 px-1 py-0.2 rounded uppercase">
                              ▶️ In-Progress
                            </span>
                          )}
                          {member.inventoryAccess && (
                            <span className="text-[9px] font-bold bg-blue-100 text-blue-800 px-1 py-0.2 rounded uppercase">
                              📦 Inventory
                            </span>
                          )}
                          {member.supplySheetAccess && (
                            <span className="text-[9px] font-bold bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded uppercase">
                              🧴 Supply Sheet
                            </span>
                          )}
                        </div>
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
                      onClick={() => handleOpenEditMemberCustom(member)} 
                      className="text-xs font-bold text-blue-700 hover:underline shrink-0">
                      Edit
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* EDIT/CREATE PROFILE FORM */}
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

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Slack User ID</label>
                <input 
                  type="text" 
                  value={memberSlackId} 
                  onChange={(e) => setMemberSlackId(e.target.value)} 
                  placeholder="e.g. U08S5KMHT08" 
                  className="w-full p-2 text-xs font-mono border border-gray-300 rounded focus:outline-none" />
                <span className="text-[10px] text-gray-500 mt-0.5 block">Find in Slack: Member profile - Three Dots (...) - Copy Member ID</span>
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

              {/* PERMISSION CONTROLS */}
              <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={memberAllowInProgress} 
                    onChange={(e) => setMemberAllowInProgress(e.target.checked)} 
                    className="accent-amber-600 w-3.5 h-3.5 cursor-pointer" 
                  />
                  <span className="font-bold">Allow "In Progress" & EOD Carryover Status</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={memberInventoryAccess} 
                    onChange={(e) => setMemberInventoryAccess(e.target.checked)} 
                    className="accent-blue-600 w-3.5 h-3.5 cursor-pointer" 
                  />
                  <span className="font-bold">Grant Access to Inventory Management Dashboard</span>
                </label>

                <div className="bg-gray-50 p-2.5 rounded border border-gray-200 flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-xs text-gray-800 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={memberSupplyAccess} 
                      onChange={(e) => setMemberSupplyAccess(e.target.checked)} 
                      className="accent-emerald-600 w-3.5 h-3.5 cursor-pointer" 
                    />
                    <span className="font-bold">Grant Access to Daily Supply Sheet (Hoja de Químicos)</span>
                  </label>
                  <p className="text-[10px] text-gray-500 ml-5">
                    Shows the "🧴 Supply Sheet" button on the main navigation bar for this employee.
                  </p>

                  {memberSupplyAccess && (
                    <div className="ml-5 pt-1.5 border-t border-gray-200">
                      <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wider block mb-1">
                        Allowed Companies for Supply Sheet:
                      </span>
                      <div className="flex flex-col gap-1">
                        {masterCompanyList.map(comp => (
                          <label key={comp} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={memberSupplyCompanies.includes(comp)}
                              onChange={() => toggleSupplyCompany(comp)}
                              className="accent-emerald-600 w-3 h-3"
                            />
                            <span>{comp}</span>
                          </label>
                        ))}
                      </div>
                      <span className="text-[9px] text-gray-400 block mt-1">
                        If 1 company is chosen, the form locks to it automatically without showing a dropdown.
                      </span>
                    </div>
                  )}
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
                    onClick={handleResetMemberCustom}
                    className="px-3 py-1.5 rounded text-xs font-bold text-gray-500 hover:bg-gray-100">
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveMemberWithPermissions}
                    className="bg-[#333333] text-white px-4 py-1.5 rounded text-xs font-bold hover:bg-black transition">
                    {editingMemberId ? 'Update Profile' : 'Add Member'}
                  </button>
                </div>
              </div>
            </div>

            {/* COMPANY MANAGEMENT */}
            <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-3 mt-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-700 border-b pb-1">Company Management & Inventory</h4>
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

              <div className="flex flex-col gap-2 mt-2">
                {masterCompanyList.map(comp => {
                  const companyObj = (companiesData || []).find(c => c.name === comp);
                  const isInventoryEnabled = Boolean(companyObj?.inventory_enabled);
                  const currentManager = companyObj?.inventory_manager || currentUserName || '';

                  return (
                    <div key={comp} className="flex flex-col bg-gray-50 p-2.5 rounded border border-gray-200 text-xs gap-2">
                      <div className="flex justify-between items-center">
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
                            <span className="font-bold text-gray-800 text-sm">{comp}</span>
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

                      {!editingCompany && (
                        <div className="flex flex-col gap-2 pt-2 border-t border-gray-200/60">
                          <div className="flex justify-between items-center">
                            <span className="text-[11px] text-gray-600 font-semibold">Inventory Module:</span>
                            <button
                              type="button"
                              onClick={() => toggleCompanyInventory(comp, isInventoryEnabled)}
                              className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition border ${
                                isInventoryEnabled
                                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300 shadow-2xs hover:bg-emerald-200'
                                  : 'bg-gray-200 text-gray-500 border-gray-300 hover:bg-gray-300'
                              }`}
                            >
                              {isInventoryEnabled ? '✓ Enabled' : '○ Disabled'}
                            </button>
                          </div>

                          {isInventoryEnabled && (
                            <div className="flex flex-col gap-1 bg-white p-2 rounded border border-gray-200">
                              <span className="text-[10px] font-bold text-gray-700 uppercase tracking-wider">
                                🔔 Inventory & Supply Manager (Notification Receiver):
                              </span>
                              <select
                                value={currentManager}
                                onChange={(e) => handleCompanyManagerChange(comp, e.target.value)}
                                className="text-xs font-bold p-1.5 border border-gray-300 rounded bg-gray-50 focus:outline-none"
                              >
                                <option value="">Select Manager...</option>
                                {teamMembers.map(m => (
                                  <option key={m.id} value={m.name}>
                                    {m.name} {m.slackUserId ? '✓' : '(No Slack ID)'}
                                  </option>
                                ))}
                              </select>
                              <span className="text-[9px] text-gray-400">
                                This person receives all low-stock Slack pings, supply request notifications, and the dashboard action banner for {comp}.
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* DEDICATED MODAL: PROPERTIES, UNITS & AI QC STANDARDS */}
      {isQcManagerOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onMouseDown={(e) => { e.stopPropagation(); setIsQcManagerOpen(false); }}
        >
          <div
            className="bg-[#F4F3ED] max-w-3xl w-full max-h-[90vh] rounded-lg shadow-2xl p-6 border border-gray-300 flex flex-col gap-4 overflow-hidden animate-fade-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-300 pb-3">
              <div>
                <h2 className="text-xl font-serif font-bold text-gray-900">🏨 Properties, Units & AI QC Standards</h2>
                <p className="text-xs text-gray-500">Manage parent properties, multi-tag room blueprints, iCal links, and Golden Reference Photos.</p>
              </div>
              <button onClick={() => setIsQcManagerOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setQcTab('rules')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                  qcTab === 'rules' ? 'bg-[#333333] text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                🤖 AI QC Rules & Golden Photos ({qcRules.length})
              </button>
              <button
                type="button"
                onClick={() => setQcTab('properties')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition ${
                  qcTab === 'properties' ? 'bg-[#333333] text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                🏢 Properties & Units ({propertyUnits.length})
              </button>
            </div>

            {qcTab === 'rules' ? (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-lg border border-blue-200 flex flex-col gap-3 shadow-2xs">
                  <div className="flex justify-between items-center border-b border-gray-100 pb-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-950">
                      {editingRuleId ? '✏️ Edit AI QC Rule' : '+ Add Modular AI QC Rule'}
                    </span>
                    {editingRuleId && (
                      <button type="button" onClick={resetRuleForm} className="text-xs text-gray-500 hover:underline font-bold">
                        Cancel Edit
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Blueprint Tag</label>
                      <input
                        type="text"
                        list="blueprint-options"
                        value={ruleBlueprint}
                        onChange={(e) => setRuleBlueprint(e.target.value)}
                        placeholder="e.g., Office, Studio, Balcony"
                        className="w-full p-2 border border-gray-300 rounded bg-white font-bold"
                      />
                      <datalist id="blueprint-options">
                        {distinctBlueprints.map(bp => <option key={bp} value={bp} />)}
                      </datalist>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Area / Zone Name</label>
                      <input
                        type="text"
                        value={ruleAreaName}
                        onChange={(e) => setRuleAreaName(e.target.value)}
                        placeholder="e.g., Meeting Area, Kitchen, Bed"
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">Rule Title</label>
                      <input
                        type="text"
                        value={ruleTitle}
                        onChange={(e) => setRuleTitle(e.target.value)}
                        placeholder="e.g., Benches & Bolster Pillows"
                        className="w-full p-2 border border-gray-300 rounded bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">AI Inspection Prompt / Standard</label>
                    <textarea
                      rows={2}
                      value={ruleDescription}
                      onChange={(e) => setRuleDescription(e.target.value)}
                      placeholder="Describe exactly what the AI should verify (alignment, pillow placement, items present)..."
                      className="w-full p-2 text-xs border border-gray-300 rounded bg-white"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-1">
                    <div
                      onDragOver={(e) => { e.preventDefault(); setIsDraggingRefImg(true); }}
                      onDragLeave={() => setIsDraggingRefImg(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDraggingRefImg(false);
                        if (e.dataTransfer.files?.[0]) handleUploadGoldenReference(e.dataTransfer.files[0]);
                      }}
                      onClick={() => !isUploadingRefImg && refFileInputRef.current?.click()}
                      className={`flex-1 p-2.5 rounded-lg border-2 border-dashed cursor-pointer transition flex items-center justify-between gap-3 ${
                        isDraggingRefImg
                          ? 'border-blue-600 bg-blue-100/80'
                          : 'border-blue-300 bg-blue-50/50 hover:bg-blue-50'
                      }`}
                    >
                      <input
                        ref={refFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.[0]) handleUploadGoldenReference(e.target.files[0]);
                        }}
                      />

                      <div className="flex items-center gap-2.5 min-w-0">
                        {ruleRefImageUrl ? (
                          <img src={ruleRefImageUrl} alt="Reference" className="w-11 h-11 rounded object-cover border border-gray-300 shrink-0" />
                        ) : (
                          <span className="text-xl shrink-0">📷</span>
                        )}
                        <div className="min-w-0">
                          <span className="text-xs font-bold text-blue-950 block truncate">
                            {isUploadingRefImg
                              ? '⏳ Compressing & uploading reference photo...'
                              : isDraggingRefImg
                              ? 'Drop Golden Reference Photo here'
                              : ruleRefImageUrl
                              ? '✓ Golden Reference Photo Attached (Drag or click to replace)'
                              : 'Drag & drop Golden Reference Photo here, or click to browse'}
                          </span>
                          <span className="text-[10px] text-gray-500 block">
                            Auto-compressed before upload to keep storage usage minimal.
                          </span>
                        </div>
                      </div>

                      {ruleRefImageUrl && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRuleRefImageUrl('');
                          }}
                          className="text-[10px] text-red-600 font-bold hover:underline shrink-0 px-2 py-1"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={isSavingRule || isUploadingRefImg}
                      onClick={handleSaveQcRule}
                      className="bg-[#5B7049] hover:bg-[#465638] text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-2xs transition shrink-0"
                    >
                      {isSavingRule ? 'Saving...' : editingRuleId ? 'Update Rule' : '+ Save QC Rule'}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {qcRules.map(rule => (
                    <div key={rule.id} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-start gap-3 text-xs shadow-2xs">
                      <div className="flex items-start gap-3 min-w-0">
                        {rule.reference_image_url ? (
                          <img src={rule.reference_image_url} alt={rule.rule_title} className="w-14 h-14 rounded object-cover border border-gray-300 shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-400 text-xs shrink-0 text-center p-1">
                            No Ref Photo
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="bg-blue-100 text-blue-900 px-2 py-0.5 rounded font-bold text-[10px] uppercase">
                              {rule.blueprint}
                            </span>
                            <span className="font-bold text-gray-900">{rule.area_name} — {rule.rule_title}</span>
                          </div>
                          <p className="text-[11px] text-gray-600 mt-1">{rule.rule_description}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => handleEditRule(rule)} className="text-blue-600 font-bold hover:underline">
                          Edit
                        </button>
                        <button type="button" onClick={() => handleDeleteRule(rule)} className="text-red-500 font-bold hover:underline">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-gray-700">+ Add Parent Property (Hotel / Office / Client)</span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPropName}
                      onChange={(e) => setNewPropName(e.target.value)}
                      placeholder="Property Name (e.g., The Cedara)"
                      className="flex-1 p-2 border border-gray-300 rounded bg-white font-bold"
                    />
                    <input
                      type="text"
                      value={newPropNotes}
                      onChange={(e) => setNewPropNotes(e.target.value)}
                      placeholder="Location / Notes (optional)"
                      className="flex-1 p-2 border border-gray-300 rounded bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleCreateProperty}
                      className="bg-[#333333] hover:bg-black text-white px-4 py-2 rounded font-bold"
                    >
                      Add Property
                    </button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-lg border border-gray-200 flex flex-col gap-2.5 text-xs">
                  <span className="font-bold uppercase tracking-wider text-gray-700">+ Add Child Unit / Room</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={selectedPropForUnit}
                      onChange={(e) => setSelectedPropForUnit(e.target.value)}
                      className="p-2 border border-gray-300 rounded bg-white font-bold"
                    >
                      <option value="">Select Parent Property...</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>

                    <input
                      type="text"
                      value={newUnitName}
                      onChange={(e) => setNewUnitName(e.target.value)}
                      placeholder="Unit Name (e.g., Mesquite (S1))"
                      className="p-2 border border-gray-300 rounded bg-white font-bold"
                    />
                  </div>

                  <div className="bg-blue-50/50 p-2.5 rounded border border-blue-200 flex flex-col gap-2">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-950">
                        Assigned Blueprint Tags (Combine multiple standards):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {distinctBlueprints.filter(bp => !newUnitBlueprints.includes(bp)).map(bp => (
                          <button
                            key={bp}
                            type="button"
                            onClick={() => addNewUnitBlueprintTag(bp)}
                            className="text-[10px] font-bold bg-white hover:bg-blue-100 text-blue-900 border border-blue-300 px-2 py-0.5 rounded transition"
                          >
                            + {bp}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {newUnitBlueprints.map(tag => (
                        <span key={tag} className="bg-blue-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold flex items-center gap-1.5">
                          {tag}
                          <button type="button" onClick={() => removeNewUnitBlueprintTag(tag)} className="hover:text-red-200 font-bold">
                            ✕
                          </button>
                        </span>
                      ))}
                      <div className="flex items-center gap-1 flex-1 min-w-[160px]">
                        <input
                          type="text"
                          value={newBlueprintTagInput}
                          onChange={(e) => setNewBlueprintTagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addNewUnitBlueprintTag(newBlueprintTagInput);
                            }
                          }}
                          placeholder="Type custom tag & press Enter..."
                          className="flex-1 p-1.5 text-xs border border-gray-300 rounded bg-white"
                        />
                        {newBlueprintTagInput.trim() && (
                          <button
                            type="button"
                            onClick={() => addNewUnitBlueprintTag(newBlueprintTagInput)}
                            className="bg-blue-700 text-white px-2.5 py-1.5 rounded text-[11px] font-bold"
                          >
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="url"
                      value={newUnitIcal}
                      onChange={(e) => setNewUnitIcal(e.target.value)}
                      placeholder="Optional .ics iCal Calendar URL (for January turnover automation)"
                      className="flex-1 p-2 border border-gray-300 rounded bg-white"
                    />
                    <button
                      type="button"
                      onClick={handleCreateUnit}
                      className="bg-[#5B7049] hover:bg-[#465638] text-white px-4 py-2 rounded font-bold"
                    >
                      + Add Unit
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  {properties.map(prop => {
                    const childUnits = propertyUnits.filter(u => u.property_id === prop.id || u.property_name === prop.name);
                    const isEditingThisProp = editingPropId === prop.id;

                    return (
                      <div key={prop.id} className="bg-white p-3.5 rounded-lg border border-gray-200 text-xs shadow-2xs">
                        {isEditingThisProp ? (
                          <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 pb-2.5 mb-2">
                            <input
                              type="text"
                              value={editPropName}
                              onChange={(e) => setEditPropName(e.target.value)}
                              placeholder="Property Name"
                              className="flex-1 min-w-[160px] p-1.5 border border-blue-300 rounded bg-blue-50/40 font-bold"
                            />
                            <input
                              type="text"
                              value={editPropNotes}
                              onChange={(e) => setEditPropNotes(e.target.value)}
                              placeholder="Location / Notes"
                              className="flex-1 min-w-[160px] p-1.5 border border-gray-300 rounded bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEditProperty(prop)}
                              className="bg-emerald-700 text-white px-3 py-1.5 rounded font-bold hover:bg-emerald-800"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPropId(null)}
                              className="text-gray-500 font-bold hover:underline px-1"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center border-b border-gray-100 pb-2 mb-2">
                            <div>
                              <span className="font-bold text-sm text-gray-900">🏢 {prop.name}</span>
                              {prop.notes && <span className="text-gray-400 ml-2">({prop.notes})</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleStartEditProperty(prop)}
                                className="text-blue-600 font-bold hover:underline"
                              >
                                Edit Property
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProperty(prop)}
                                className="text-red-500 font-bold hover:underline"
                              >
                                Delete
                              </button>
                            </div>
                          </div>
                        )}

                        {childUnits.length === 0 ? (
                          <p className="text-gray-400 italic">No units added under {prop.name} yet.</p>
                        ) : (
                          <div className="flex flex-col gap-1.5">
                            {childUnits.map(u => {
                              const isEditingThisUnit = editingUnitId === u.id;
                              const unitTags = getUnitBlueprints(u);

                              if (isEditingThisUnit) {
                                return (
                                  <div key={u.id} className="flex flex-col gap-2 bg-blue-50/50 p-2.5 rounded border border-blue-300">
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        value={editUnitName}
                                        onChange={(e) => setEditUnitName(e.target.value)}
                                        placeholder="Unit / Room Name"
                                        className="flex-1 p-1.5 border border-gray-300 rounded bg-white font-bold"
                                      />
                                      <input
                                        type="url"
                                        value={editUnitIcal}
                                        onChange={(e) => setEditUnitIcal(e.target.value)}
                                        placeholder="Optional .ics iCal URL"
                                        className="flex-1 p-1.5 border border-gray-300 rounded bg-white"
                                      />
                                    </div>

                                    <div className="bg-white p-2 rounded border border-blue-200 flex flex-col gap-1.5">
                                      <div className="flex flex-wrap gap-1">
                                        {distinctBlueprints.filter(bp => !editUnitBlueprints.includes(bp)).map(bp => (
                                          <button
                                            key={bp}
                                            type="button"
                                            onClick={() => addEditUnitBlueprintTag(bp)}
                                            className="text-[10px] font-bold bg-gray-100 hover:bg-blue-100 text-blue-900 border border-gray-300 px-2 py-0.5 rounded"
                                          >
                                            + {bp}
                                          </button>
                                        ))}
                                      </div>

                                      <div className="flex flex-wrap items-center gap-1.5">
                                        {editUnitBlueprints.map(tag => (
                                          <span key={tag} className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1">
                                            {tag}
                                            <button type="button" onClick={() => removeEditUnitBlueprintTag(tag)} className="hover:text-red-200 font-bold">
                                              ✕
                                            </button>
                                          </span>
                                        ))}
                                        <input
                                          type="text"
                                          value={editBlueprintTagInput}
                                          onChange={(e) => setEditBlueprintTagInput(e.target.value)}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.preventDefault();
                                              addEditUnitBlueprintTag(editBlueprintTagInput);
                                            }
                                          }}
                                          placeholder="Add tag & press Enter..."
                                          className="flex-1 min-w-[140px] p-1 text-xs border border-gray-300 rounded"
                                        />
                                      </div>
                                    </div>

                                    <div className="flex justify-end gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setEditingUnitId(null)}
                                        className="text-gray-500 font-bold hover:underline px-2"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleSaveEditUnit(u)}
                                        className="bg-emerald-700 text-white px-3 py-1 rounded font-bold hover:bg-emerald-800"
                                      >
                                        Save Unit
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div key={u.id} className="flex justify-between items-center bg-gray-50 px-2.5 py-1.5 rounded border border-gray-200">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-bold text-gray-800 mr-1">🚪 {u.unit_name}</span>
                                    {unitTags.map(tag => (
                                      <span key={tag} className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        {tag}
                                      </span>
                                    ))}
                                    {u.ical_url && (
                                      <span className="bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded text-[10px] font-bold">
                                        📅 iCal Linked
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleStartEditUnit(u)}
                                      className="text-blue-600 font-bold hover:underline"
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUnit(u)}
                                      className="text-red-500 font-bold hover:underline"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}