// src/components/InventoryDashboard.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import InventoryItemModal from './InventoryItemModal';

export default function InventoryDashboard({ companiesData, currentProfile, userRole, dispatchNotification, onRequestsUpdated }) {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // 'grid' | 'requests' | 'analytics'
  const [subView, setSubView] = useState('grid');
  const [allRequests, setAllRequests] = useState([]);
  const [editingRequest, setEditingRequest] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  // Month & Job Metrics
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [monthlyMetricsMap, setMonthlyMetricsMap] = useState({});
  const [jobsInput, setJobsInput] = useState(0);
  const [isSavingJobs, setIsSavingJobs] = useState(false);

  // Matrix Record Management Modal State
  const [isManageRecordsOpen, setIsManageRecordsOpen] = useState(false);

  const activeCompanies = (companiesData || [])
    .filter(c => c.inventory_enabled)
    .map(c => c.name);
    
  const [selectedCompany, setSelectedCompany] = useState('All');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const getDispenseUnitPrice = (item) => {
    if (!item) return 0;
    const basePrice = Number(item.unit_price || 0);
    if (item.is_bulk_refill && Number(item.refills_per_jug) > 0) {
      return basePrice / Number(item.refills_per_jug);
    }
    return basePrice;
  };

  const getItemShelfValue = (item) => {
    if (!item) return 0;
    const basePrice = Number(item.unit_price || 0);
    const qty = Number(item.quantity || 0);
    if (item.is_bulk_refill && Number(item.refills_per_jug) > 0) {
      const cap = Number(item.refills_per_jug);
      const used = Number(item.current_refill_usage || 0);
      const refillsLeft = used > 0 ? Math.max(0, cap - used) : 0;
      const fractionalJug = refillsLeft / cap;
      return (qty + fractionalJug) * basePrice;
    }
    return qty * basePrice;
  };

  const fetchInventory = async () => {
    if (activeCompanies.length === 0) {
      setIsLoading(false);
      return;
    }
    const { data, error } = await supabase.from('inventory').select('*').in('company', activeCompanies).order('name');
    if (!error && data) setInventory(data);
    setIsLoading(false);
  };

  const fetchSupplyRequests = async () => {
    if (activeCompanies.length === 0) return;

    const { data: reqs, error: reqErr } = await supabase
      .from('supply_requests')
      .select('*')
      .in('company', activeCompanies)
      .order('submitted_at', { ascending: false })
      .limit(500);

    if (reqErr || !reqs) return;

    const reqIds = reqs.map(r => r.id);
    let itemsMap = {};

    if (reqIds.length > 0) {
      const { data: itemRows } = await supabase.from('supply_request_items').select('*').in('request_id', reqIds);
      (itemRows || []).forEach(row => {
        if (!itemsMap[row.request_id]) itemsMap[row.request_id] = [];
        itemsMap[row.request_id].push(row);
      });
    }

    const combined = reqs.map(r => ({
      ...r,
      items: itemsMap[r.id] || []
    }));

    setAllRequests(combined);
  };

  const fetchMonthlyMetrics = async () => {
    const { data } = await supabase.from('inventory_monthly_metrics').select('*');
    if (data) {
      const map = {};
      data.forEach(row => {
        map[`${row.month_key}__${row.company}`] = Number(row.jobs_completed || 0);
      });
      setMonthlyMetricsMap(map);
    }
  };

  useEffect(() => {
    const key = `${selectedMonth}__${selectedCompany}`;
    setJobsInput(monthlyMetricsMap[key] ?? 0);
  }, [selectedMonth, selectedCompany, monthlyMetricsMap]);

  const handleSaveJobsCompleted = async () => {
    setIsSavingJobs(true);
    const numJobs = Math.max(0, Number(jobsInput || 0));
    const key = `${selectedMonth}__${selectedCompany}`;

    try {
      const { error } = await supabase
        .from('inventory_monthly_metrics')
        .upsert(
          {
            month_key: selectedMonth,
            company: selectedCompany,
            jobs_completed: numJobs,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'month_key,company' }
        );

      if (error) throw error;
      setMonthlyMetricsMap(prev => ({ ...prev, [key]: numJobs }));
      showToast(`✓ Saved ${numJobs} completed jobs for ${selectedMonth}.`);
    } catch (err) {
      alert(`Error saving jobs count: ${err.message}`);
    } finally {
      setIsSavingJobs(false);
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchSupplyRequests();
    fetchMonthlyMetrics();

    const invChannel = supabase.channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => fetchInventory())
      .subscribe();

    const reqChannel = supabase.channel('supply-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_requests' }, () => {
        fetchSupplyRequests();
        if (typeof onRequestsUpdated === 'function') onRequestsUpdated();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
      supabase.removeChannel(reqChannel);
    };
  }, [companiesData]);

  const triggerLowStockAlert = async (itemData, isZero = false) => {
    try {
      const companyObj = (companiesData || []).find(c => c.name === itemData.company);
      const managerName = companyObj?.inventory_manager || currentProfile?.name || '';

      const { data: profiles } = await supabase.from('profiles').select('*');
      let managerProfile = (profiles || []).find(p => p.name === managerName);

      if (!managerProfile) {
        managerProfile = (profiles || []).find(p => p.role === 'admin' && p.slack_user_id) || (profiles || [])[0];
      }

      const targetName = managerProfile?.name || managerName || 'Admin';
      const slackUserId = managerProfile?.slack_user_id;

      const alertTitle = isZero 
        ? `🚫 OUT OF STOCK: "${itemData.name}" (${itemData.company}) is at ZERO!`
        : `🚨 Low Stock: "${itemData.name}" (${itemData.company}) is at ${itemData.quantity} (Min: ${itemData.min_quantity})`;

      await dispatchNotification(
        'userName',
        targetName,
        'inventory_low',
        alertTitle,
        isZero ? '🚫 Item Out of Stock' : '🚨 Low Stock Alert',
        `"${itemData.name}" is ${isZero ? 'completely out of stock' : 'below minimum required stock'}. Time to reorder!`
      );

      if (slackUserId) {
        const payload = {
          slackUserId,
          managerName: targetName,
          itemName: itemData.name,
          company: itemData.company,
          currentQuantity: itemData.quantity,
          minQuantity: itemData.min_quantity,
          triggeredBy: currentProfile?.name || 'Team Member'
        };

        let sent = false;
        try {
          const res = await fetch('https://tasky-app-gilt.vercel.app/api/inventory-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) sent = true;
        } catch (e) {}

        if (!sent) {
          try {
            const localRes = await fetch('/api/inventory-alert', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (localRes.ok) sent = true;
          } catch (e) {}
        }

        if (sent) {
          showToast(`🔔 Slack reorder alert sent to ${targetName}!`);
        }
      }
    } catch (err) {
      console.error('Error sending low stock alert:', err);
    }
  };

  const handleEditRequestQty = (itemId, delta) => {
    setEditingRequest(prev => {
      const newItems = prev.items.map(it => {
        if (it.id === itemId) return { ...it, quantity: Math.max(0, it.quantity + delta) };
        return it;
      });
      return { ...prev, items: newItems };
    });
  };

  const handleApproveRequest = async () => {
    setIsApproving(true);
    const reviewerName = currentProfile?.name || 'Admin';

    try {
      const itemsToProcess = editingRequest.items || [];
      const originalRequest = allRequests.find(r => r.id === editingRequest.id);
      let wasModified = false;

      for (const reqItem of itemsToProcess) {
        const origItem = originalRequest?.items.find(o => o.id === reqItem.id);
        if (origItem && Number(origItem.quantity) !== Number(reqItem.quantity)) {
          wasModified = true;
          await supabase.from('supply_request_items').update({ quantity: reqItem.quantity }).eq('id', reqItem.id);
        }

        const requestedQty = Number(reqItem.quantity || 0);
        if (requestedQty === 0) continue;

        const invItem = inventory.find(i => String(i.id) === String(reqItem.item_id));
        if (!invItem) continue;
        const minQty = Number(invItem.min_quantity || 0);

        if (reqItem.is_bulk_refill || invItem.is_bulk_refill) {
          const cap = Number(invItem.refills_per_jug || 0);
          if (cap > 0) {
            const currentJugs = Number(invItem.quantity || 0);
            const currentUsed = Number(invItem.current_refill_usage || 0);
            const refillsLeftInOpenJug = Math.max(0, cap - currentUsed);
            const totalAvailableRefills = (currentJugs * cap) + refillsLeftInOpenJug;

            const actualDeduct = Math.min(requestedQty, totalAvailableRefills);
            const remainingRefills = Math.max(0, totalAvailableRefills - actualDeduct);

            let newJugQty = 0;
            let newUsed = cap;

            if (remainingRefills > 0) {
              newJugQty = Math.floor(remainingRefills / cap);
              const remainder = remainingRefills % cap;
              if (remainder === 0 && newJugQty > 0) {
                newJugQty -= 1;
                newUsed = 0;
              } else {
                newUsed = cap - remainder;
              }
            }

            const isZeroNow = newJugQty === 0 && remainingRefills === 0;
            const isNowLow = minQty > 0 && newJugQty <= minQty;
            const shouldNotify = (isZeroNow && !invItem.low_stock_notified) || (isNowLow && !invItem.low_stock_notified) || (isZeroNow && currentJugs > 0);

            await supabase.from('inventory').update({
              quantity: newJugQty,
              current_refill_usage: newUsed,
              low_stock_notified: (isNowLow || isZeroNow),
              updated_at: new Date().toISOString()
            }).eq('id', invItem.id);

            if (shouldNotify) {
              await triggerLowStockAlert({ ...invItem, quantity: newJugQty, min_quantity: minQty }, isZeroNow);
            }
          }
          continue;
        }

        const newQty = Math.max(0, Number(invItem.quantity || 0) - requestedQty);
        const isZeroNow = newQty === 0;
        const isNowLow = minQty > 0 && newQty <= minQty;
        const shouldNotify = (isZeroNow && Number(invItem.quantity || 0) > 0) || (isNowLow && !invItem.low_stock_notified);

        await supabase.from('inventory').update({
          quantity: newQty,
          low_stock_notified: (isNowLow || isZeroNow),
          updated_at: new Date().toISOString()
        }).eq('id', invItem.id);

        if (shouldNotify) {
          await triggerLowStockAlert({ ...invItem, quantity: newQty, min_quantity: minQty }, isZeroNow);
        }
      }

      await supabase.from('supply_requests').update({
        status: 'approved',
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString()
      }).eq('id', editingRequest.id);

      const noteText = wasModified ? '\n(Note: Some quantities were adjusted by Admin)' : '';
      
      await dispatchNotification(
        'userName',
        editingRequest.requested_by,
        'supply_approved',
        `✅ Supply Request Approved: Your supplies were approved by ${reviewerName}.${noteText}`,
        '✅ Supply Request Approved',
        `Your requested supplies were approved and are ready to grab.${noteText}`
      );

      setEditingRequest(null);
      await fetchInventory();
      await fetchSupplyRequests();
      if (typeof onRequestsUpdated === 'function') onRequestsUpdated();
      showToast(`✓ ${editingRequest.requested_by}'s supply request approved.`);
    } catch (err) {
      alert(`Error approving request: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!window.confirm(`Reject supply request from ${editingRequest.requested_by}?`)) return;
    const reviewerName = currentProfile?.name || 'Admin';

    await supabase.from('supply_requests').update({
      status: 'rejected',
      reviewed_by: reviewerName,
      reviewed_at: new Date().toISOString()
    }).eq('id', editingRequest.id);

    await dispatchNotification(
      'userName',
      editingRequest.requested_by,
      'supply_rejected',
      `❌ Supply Request Declined: Your supply sheet was declined by ${reviewerName}.`,
      '❌ Supply Request Declined',
      `Your supply sheet was declined by ${reviewerName}.`
    );

    setEditingRequest(null);
    await fetchSupplyRequests();
    if (typeof onRequestsUpdated === 'function') onRequestsUpdated();
  };

  // COMPLETE PURGE / DELETE A SUPPLY REQUEST ENTRY (TEST SHEETS & ACCIDENTS)
  const handleDeleteHistoricalRequest = async (requestId, requestedBy) => {
    if (!window.confirm(`Are you sure you want to permanently delete this supply sheet from ${requestedBy}? This will immediately remove it from all monthly matrix calculations.`)) {
      return;
    }

    try {
      await supabase.from('supply_request_items').delete().eq('request_id', requestId);
      const { error } = await supabase.from('supply_requests').delete().eq('id', requestId);
      if (error) throw error;

      setAllRequests(prev => prev.filter(r => r.id !== requestId));
      if (typeof onRequestsUpdated === 'function') onRequestsUpdated();
      showToast('✓ Supply request deleted successfully.');
    } catch (err) {
      alert(`Error deleting record: ${err.message}`);
    }
  };

  // INLINE QUANTITY ADJUSTMENT ON PAST APPROVED SHEETS
  const handleUpdateItemQuantityInPastRequest = async (requestId, itemId, delta) => {
    const targetReq = allRequests.find(r => r.id === requestId);
    if (!targetReq) return;

    const targetItem = targetReq.items.find(i => i.id === itemId);
    if (!targetItem) return;

    const newQty = Math.max(0, Number(targetItem.quantity || 0) + delta);
    if (newQty === targetItem.quantity) return;

    try {
      const { error } = await supabase
        .from('supply_request_items')
        .update({ quantity: newQty })
        .eq('id', itemId);

      if (error) throw error;

      setAllRequests(prev => prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            items: r.items.map(it => it.id === itemId ? { ...it, quantity: newQty } : it)
          };
        }
        return r;
      }));
    } catch (err) {
      alert(`Error updating item quantity: ${err.message}`);
    }
  };

  const handleQuickUpdateQuantity = async (id, delta) => {
    const target = inventory.find(i => i.id === id);
    if (!target) return;

    const newQty = Math.max(0, Number(target.quantity || 0) + delta);
    if (newQty === target.quantity) return;

    const minQty = Number(target.min_quantity || 0);
    const isNowLow = minQty > 0 && newQty <= minQty;
    const isZero = newQty === 0;

    const cap = Number(target.refills_per_jug || 0);
    let nextUsage = Number(target.current_refill_usage || 0);
    if (target.is_bulk_refill && cap > 0 && delta > 0) {
      const refillsLeft = Math.max(0, cap - nextUsage);
      if (refillsLeft === 0) {
        nextUsage = 0;
      }
    }

    setInventory(prev => prev.map(i => 
      i.id === id ? { 
        ...i, 
        quantity: newQty, 
        current_refill_usage: nextUsage,
        low_stock_notified: (isNowLow || isZero) 
      } : i
    ));

    const { error } = await supabase.from('inventory').update({
      quantity: newQty,
      current_refill_usage: nextUsage,
      low_stock_notified: (isNowLow || isZero),
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      fetchInventory();
      return;
    }

    const shouldNotify = (isZero && Number(target.quantity || 0) > 0) || (isNowLow && !target.low_stock_notified);
    if (shouldNotify) {
      await triggerLowStockAlert({ ...target, quantity: newQty, min_quantity: minQty }, isZero);
    }
  };

  const normalizedRole = String(userRole || currentProfile?.role || '').toLowerCase().trim();
  const isManagerOfAnyCompany = (companiesData || []).some(c => c.inventory_manager === currentProfile?.name);
  const hasInventoryPermission = normalizedRole === 'admin' || Boolean(currentProfile?.inventoryAccess) || isManagerOfAnyCompany;

  if (!hasInventoryPermission) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 mt-20">
        <span className="text-4xl">🔒</span>
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-sm">You do not have permission to view the Inventory System.</p>
      </div>
    );
  }

  const pendingRequests = allRequests.filter(r => r.status === 'pending' && (selectedCompany === 'All' || r.company === selectedCompany));
  const historyRequests = allRequests.filter(r => r.status !== 'pending' && (selectedCompany === 'All' || r.company === selectedCompany));

  const filteredInventory = inventory.filter(item => {
    const matchesCompany = selectedCompany === 'All' || item.company === selectedCompany;
    const matchesSearch = !searchQuery.trim() || item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCompany && matchesSearch;
  });

  const lowStockCount = filteredInventory.filter(i => Number(i.min_quantity || 0) > 0 && Number(i.quantity || 0) <= Number(i.min_quantity || 0)).length;
  const totalShelfValuation = filteredInventory.reduce((sum, item) => sum + getItemShelfValue(item), 0);

  // Month-Filtered Approved Requests
  const approvedInMonth = allRequests.filter(r => {
    if (r.status !== 'approved') return false;
    if (selectedCompany !== 'All' && r.company !== selectedCompany) return false;
    const dateStr = (r.submitted_at || '').slice(0, 7);
    return dateStr === selectedMonth;
  });

  const employeeColumns = [...new Set(approvedInMonth.map(r => r.requested_by || 'Unknown'))].sort();

  const usageMatrix = {};
  approvedInMonth.forEach(req => {
    const emp = req.requested_by || 'Unknown';
    (req.items || []).forEach(it => {
      const key = String(it.item_id);
      if (!usageMatrix[key]) usageMatrix[key] = {};
      usageMatrix[key][emp] = (usageMatrix[key][emp] || 0) + Number(it.quantity || 0);
    });
  });

  const employeeSpendTotals = {};
  employeeColumns.forEach(emp => { employeeSpendTotals[emp] = 0; });

  filteredInventory.forEach(item => {
    const dispensePrice = getDispenseUnitPrice(item);
    employeeColumns.forEach(emp => {
      const qtyUsed = usageMatrix[String(item.id)]?.[emp] || 0;
      employeeSpendTotals[emp] += qtyUsed * dispensePrice;
    });
  });

  const allEmployeeMonthlyTotal = Object.values(employeeSpendTotals).reduce((a, b) => a + b, 0);
  const currentMonthJobs = Number(monthlyMetricsMap[`${selectedMonth}__${selectedCompany}`] || 0);
  const avgCostPerJob = currentMonthJobs > 0 ? (allEmployeeMonthlyTotal / currentMonthJobs) : 0;

  const sortedSpenders = [...employeeColumns].sort((a, b) => employeeSpendTotals[b] - employeeSpendTotals[a]);
  const highestSpender = sortedSpenders.length > 0 ? sortedSpenders[0] : null;
  const lowestSpender = sortedSpenders.length > 1 ? sortedSpenders[sortedSpenders.length - 1] : null;

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {toastMessage && (
        <div className="mb-4 bg-amber-900 text-white px-4 py-2.5 rounded-lg shadow-md text-xs font-bold flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="ml-4 text-amber-200 hover:text-white">✕</button>
        </div>
      )}

      {/* TOP TITLE & NAVIGATION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-3xl font-serif font-bold">Master Inventory</h1>
          <span className="bg-[#A9B1A6] text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {filteredInventory.length} Items
          </span>
          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold px-3 py-1 rounded-full shadow-2xs" title="Total monetary value of stock & active jugs">
            💰 Shelf Value: ${totalShelfValuation.toFixed(2)}
          </span>
          {lowStockCount > 0 && (
            <span className="bg-red-100 text-red-800 border border-red-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⚠️ {lowStockCount} Needs Reorder
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="bg-gray-200 p-1 rounded-lg flex items-center gap-1 border border-gray-300">
            <button
              onClick={() => setSubView('grid')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${
                subView === 'grid' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📦 Stock Grid
            </button>
            <button
              onClick={() => setSubView('requests')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition flex items-center gap-1.5 ${
                subView === 'requests' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span>📋 Requests & Log</span>
              {pendingRequests.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setSubView('analytics')}
              className={`px-3 py-1.5 text-xs font-bold rounded transition ${
                subView === 'analytics' ? 'bg-white text-gray-900 shadow-2xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              📊 Monthly Cost & Matrix
            </button>
          </div>

          <button 
            onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
            className="bg-[#333333] text-white px-4 py-2 rounded text-xs font-bold shadow-sm hover:bg-black transition"
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* SUB-VIEW 1: MASTER INVENTORY GRID */}
      {subView === 'grid' && (
        <>
          <div className="flex gap-4 mb-6">
            <input 
              type="text" 
              placeholder="🔍 Search inventory by name or description..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] bg-white text-xs"
            />
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-64 px-4 py-2 border border-gray-300 rounded shadow-sm bg-white font-bold text-xs focus:outline-none"
            >
              <option value="All">All Enabled Companies</option>
              {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {isLoading ? (
            <div className="text-center text-gray-500 font-bold mt-10 tracking-widest uppercase">Loading Inventory...</div>
          ) : filteredInventory.length === 0 ? (
            <div className="text-center text-gray-400 font-bold mt-10 italic">No items found matching your filters.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pb-8">
              {filteredInventory.map(item => {
                const minQty = Number(item.min_quantity || 0);
                const isLowStock = minQty > 0 && Number(item.quantity || 0) <= minQty;
                const dispenseCost = getDispenseUnitPrice(item);

                return (
                  <div 
                    key={item.id} 
                    onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
                    className={`bg-white rounded-lg border shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition group flex flex-col ${
                      isLowStock ? 'border-red-400 ring-1 ring-red-200' : 'border-gray-200 hover:border-[#A9B1A6]'
                    }`}
                  >
                    <div className="h-40 bg-gray-100 relative">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
                      )}
                      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                        {item.company}
                      </div>

                      <div className="absolute bottom-2 right-2 bg-emerald-950/85 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded">
                        ${dispenseCost.toFixed(2)} {item.is_bulk_refill ? '/ refill' : '/ unit'}
                      </div>
                      
                      {item.is_bulk_refill && (
                        <div className="absolute bottom-2 left-2 bg-blue-900/85 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded">
                          🧴 {item.refill_unit_label || 'Bottle Refill'}
                        </div>
                      )}
                      {isLowStock && (
                        <div className="absolute top-2 right-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm uppercase tracking-wider">
                          ⚠️ Reorder (Min: {minQty})
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 flex flex-col flex-1">
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <div className="min-w-0">
                          <h3 className="font-bold text-gray-800 text-sm truncate" title={item.name}>{item.name}</h3>
                          <span className="text-[10px] font-semibold text-gray-400 block">
                            {item.is_bulk_refill ? `Jug: $${Number(item.unit_price || 0).toFixed(2)}` : `Min Stock: ${minQty}`}
                            {item.price_locked ? ' 🔒' : ''}
                          </span>
                        </div>
                        
                        <div 
                          className="flex items-center gap-1 shrink-0 bg-gray-50 p-0.5 rounded border border-gray-200"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => handleQuickUpdateQuantity(item.id, -1)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-white hover:bg-gray-200 text-gray-700 font-bold text-xs border border-gray-300 shadow-2xs active:scale-90 transition select-none"
                            title="Subtract 1"
                          >
                            −
                          </button>

                          <span className={`min-w-[24px] text-center text-xs font-bold px-1.5 py-0.5 rounded ${
                            item.quantity <= 0 || isLowStock ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleQuickUpdateQuantity(item.id, 1)}
                            className="w-5 h-5 rounded flex items-center justify-center bg-white hover:bg-gray-200 text-gray-700 font-bold text-xs border border-gray-300 shadow-2xs active:scale-90 transition select-none"
                            title="Add 1"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-gray-500 line-clamp-2 mt-auto">{item.description || 'No description provided.'}</p>

                      {item.is_bulk_refill && Number(item.refills_per_jug) > 0 && (() => {
                        const cap = Number(item.refills_per_jug);
                        const used = Number(item.current_refill_usage || 0);
                        const refillsLeft = Math.max(0, cap - used);
                        const isZero = Number(item.quantity || 0) <= 0 && refillsLeft <= 0;

                        return (
                          <div className={`mt-2 text-[10px] font-bold px-2 py-1.5 rounded text-center shadow-2xs border ${
                            isZero 
                              ? 'text-red-800 bg-red-50 border-red-300' 
                              : 'text-blue-800 bg-blue-50 border-blue-200'
                          }`}>
                            {isZero 
                              ? '🚫 Out of Stock (0 Refills Left)' 
                              : `💧 Jug Level: ${refillsLeft} / ${cap} Refills Left`}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* SUB-VIEW 2: SUPPLY REQUEST LOG & USAGE HISTORY */}
      {subView === 'requests' && (
        <div className="flex flex-col gap-4 pb-8">
          <div className="flex justify-between items-center">
            <h2 className="font-serif font-bold text-lg text-gray-800">Supply Sheet Queue & Log</h2>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-64 px-3 py-1.5 border border-gray-300 rounded bg-white font-bold text-xs focus:outline-none"
            >
              <option value="All">All Enabled Companies</option>
              {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {pendingRequests.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
              {pendingRequests.map(req => {
                const totalCount = (req.items || []).reduce((acc, i) => acc + Number(i.quantity || 0), 0);
                const submittedTime = new Date(req.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

                return (
                  <div 
                    key={req.id}
                    onClick={() => setEditingRequest(JSON.parse(JSON.stringify(req)))}
                    className="bg-amber-50 p-3 rounded-lg border border-amber-300 hover:border-amber-500 cursor-pointer shadow-sm flex justify-between items-center transition group"
                  >
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm">📋</span>
                        <span className="font-bold text-sm text-gray-900">{req.requested_by}</span>
                        {req.has_vehicle_warning && (
                          <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                            ⚠️ Issue Reported
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-600 block mt-1">
                        Company: <strong>{req.company}</strong> • {totalCount} items
                      </span>
                      <span className="text-[10px] text-gray-400 block">{submittedTime}</span>
                    </div>

                    <span className="text-xs font-bold bg-[#5B7049] text-white px-2.5 py-1 rounded group-hover:bg-[#465638] transition shrink-0">
                      Review →
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <h3 className="font-bold text-xs uppercase tracking-wider text-gray-500 border-b border-gray-300 pb-1 mt-2">Past Approvals & Rejections</h3>
          {historyRequests.length === 0 ? (
            <div className="bg-white p-8 rounded-lg border border-gray-200 text-center text-gray-400 italic text-xs">
              No past approved or rejected supply requests yet.
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {historyRequests.map(req => {
                const subDate = new Date(req.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                return (
                  <div key={req.id} className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          req.status === 'approved' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {req.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                        </span>
                        <span className="font-bold text-sm text-gray-900">👤 {req.requested_by}</span>
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold text-[10px]">{req.company}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(req.items || []).map(it => (
                          <span key={it.id} className={`border px-2 py-0.5 rounded text-[11px] font-semibold ${
                            it.is_bulk_refill ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-gray-50 border-gray-200 text-gray-700'
                          }`}>
                            {it.item_name}: <strong>{it.quantity}</strong> {it.is_bulk_refill ? '(Refill)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                      <div className="text-[10px] text-gray-400 sm:text-right">
                        <div>Submitted: {subDate}</div>
                        {req.reviewed_by && <div>Reviewed by: <strong>{req.reviewed_by}</strong></div>}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteHistoricalRequest(req.id, req.requested_by)}
                        className="text-red-500 hover:text-red-700 p-1.5 hover:bg-red-50 rounded transition"
                        title="Delete this record permanently"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-VIEW 3: MONTHLY CHEMICAL COST & EMPLOYEE USAGE MATRIX */}
      {subView === 'analytics' && (
        <div className="flex flex-col gap-5 pb-10">
          {/* Controls Row */}
          <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-2xs flex flex-wrap justify-between items-center gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Report Month</label>
                <input 
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded text-xs font-bold bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Company Filter</label>
                <select 
                  value={selectedCompany} 
                  onChange={(e) => setSelectedCompany(e.target.value)}
                  className="px-3 py-1.5 border border-gray-300 rounded bg-gray-50 font-bold text-xs"
                >
                  <option value="All">All Enabled Companies</option>
                  {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Data Cleanup Button */}
              <div className="self-end">
                <button
                  type="button"
                  onClick={() => setIsManageRecordsOpen(true)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 shadow-2xs"
                >
                  <span>🛠️</span>
                  <span>Manage / Clean Up Records ({approvedInMonth.length})</span>
                </button>
              </div>
            </div>

            {/* Jobs Completed Metric Input */}
            <div className="flex items-end gap-2 bg-amber-50/70 p-2.5 rounded-lg border border-amber-200">
              <div>
                <label className="block text-[10px] font-bold text-amber-900 uppercase mb-1">
                  Jobs Completed ({selectedMonth})
                </label>
                <input 
                  type="number"
                  min="0"
                  value={jobsInput}
                  onChange={(e) => setJobsInput(e.target.value)}
                  className="w-28 px-2.5 py-1 text-xs font-bold border border-amber-300 rounded bg-white text-center"
                />
              </div>
              <button
                type="button"
                disabled={isSavingJobs}
                onClick={handleSaveJobsCompleted}
                className="bg-[#333333] hover:bg-black text-white px-3 py-1.5 rounded text-xs font-bold transition"
              >
                {isSavingJobs ? 'Saving...' : 'Save Jobs'}
              </button>
            </div>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Total Chemical Spend ({selectedMonth})
              </span>
              <span className="text-2xl font-serif font-bold text-gray-900 mt-1 block">
                ${allEmployeeMonthlyTotal.toFixed(2)}
              </span>
              <span className="text-[11px] text-gray-500">
                Across {approvedInMonth.length} approved sheets
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-emerald-300 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                Avg Chemical Cost Per Job
              </span>
              <span className="text-2xl font-serif font-bold text-emerald-900 mt-1 block">
                {currentMonthJobs > 0 ? `$${avgCostPerJob.toFixed(2)}` : 'Enter Jobs ↑'}
              </span>
              <span className="text-[11px] text-gray-500">
                {currentMonthJobs > 0 ? `Based on ${currentMonthJobs} completed jobs` : 'Save monthly job count above'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                Highest Usage Employee
              </span>
              <span className="text-lg font-bold text-red-700 mt-1 block truncate">
                {highestSpender ? `${highestSpender} ($${employeeSpendTotals[highestSpender].toFixed(2)})` : 'N/A'}
              </span>
              <span className="text-[11px] text-gray-500">
                Lowest: {lowestSpender ? `${lowestSpender} ($${employeeSpendTotals[lowestSpender].toFixed(2)})` : 'N/A'}
              </span>
            </div>

            <div className="bg-white p-4 rounded-lg border border-blue-200 shadow-2xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-800 block">
                Current Total Shelf Value
              </span>
              <span className="text-2xl font-serif font-bold text-blue-950 mt-1 block">
                ${totalShelfValuation.toFixed(2)}
              </span>
              <span className="text-[11px] text-gray-500">
                Unopened stock + open jugs
              </span>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="bg-white rounded-lg border border-gray-300 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-200 text-gray-800 border-b border-gray-300">
                  <th className="p-2.5 font-bold border-r border-gray-300 min-w-[180px]">Chemical / Product</th>
                  <th className="p-2.5 font-bold border-r border-gray-300 text-center w-24">
                    Unit / Refill Price
                  </th>
                  {employeeColumns.length === 0 ? (
                    <th className="p-2.5 font-normal italic text-gray-400">No approved requests in {selectedMonth}</th>
                  ) : (
                    employeeColumns.map(emp => (
                      <th key={emp} className="p-2.5 font-bold border-r border-gray-300 text-center min-w-[110px]">
                        👤 {emp}
                      </th>
                    ))
                  )}
                  <th className="p-2.5 font-bold text-center bg-gray-100 w-28">Total Units</th>
                  <th className="p-2.5 font-bold text-right bg-gray-100 w-28">Total Cost</th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map(item => {
                  const dispensePrice = getDispenseUnitPrice(item);
                  const rowCounts = employeeColumns.map(emp => usageMatrix[String(item.id)]?.[emp] || 0);
                  const totalUnits = rowCounts.reduce((a, b) => a + b, 0);
                  const totalItemCost = totalUnits * dispensePrice;

                  return (
                    <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50/60">
                      <td className="p-2 font-bold text-gray-800 border-r border-gray-200 bg-gray-50/40">
                        <div className="flex items-center justify-between gap-1">
                          <span>{item.name}</span>
                          {item.is_bulk_refill && (
                            <span className="text-[9px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded font-semibold">
                              Refill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center font-mono font-bold text-gray-700 border-r border-gray-200 bg-emerald-50/30">
                        ${dispensePrice.toFixed(2)}
                      </td>

                      {employeeColumns.length === 0 ? (
                        <td className="p-2 text-center text-gray-300">—</td>
                      ) : (
                        employeeColumns.map(emp => {
                          const count = usageMatrix[String(item.id)]?.[emp] || 0;
                          let cellColor = '';
                          if (count >= 10) cellColor = 'bg-red-500 text-white font-black';
                          else if (count >= 7) cellColor = 'bg-orange-400 text-gray-900 font-bold';
                          else if (count >= 4) cellColor = 'bg-yellow-300 text-gray-900 font-bold';

                          return (
                            <td key={emp} className={`p-2 text-center border-r border-gray-200 ${cellColor}`}>
                              {count}
                            </td>
                          );
                        })
                      )}

                      <td className="p-2 text-center font-bold text-gray-800 bg-gray-50 border-r border-gray-200">
                        {totalUnits}
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-gray-900 bg-gray-50">
                        ${totalItemCost.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot>
                <tr className="bg-blue-50/80 border-t-2 border-gray-400 font-bold text-gray-900">
                  <td className="p-2.5 border-r border-gray-300">Total Value ($):</td>
                  <td className="p-2.5 border-r border-gray-300"></td>
                  {employeeColumns.length === 0 ? (
                    <td className="p-2.5"></td>
                  ) : (
                    employeeColumns.map(emp => (
                      <td key={emp} className="p-2.5 text-center font-mono border-r border-gray-300">
                        ${(employeeSpendTotals[emp] || 0).toFixed(2)}
                      </td>
                    ))
                  )}
                  <td className="p-2.5 border-r border-gray-300"></td>
                  <td className="p-2.5 text-right font-mono text-sm">
                    ${allEmployeeMonthlyTotal.toFixed(2)}
                  </td>
                </tr>

                <tr className="bg-blue-50/40 border-t border-gray-300 font-bold text-gray-800">
                  <td className="p-2.5 border-r border-gray-300">Jobs Completed:</td>
                  <td className="p-2.5 border-r border-gray-300 text-center font-mono">
                    {currentMonthJobs}
                  </td>
                  <td colSpan={Math.max(1, employeeColumns.length + 2)} className="p-2.5 text-xs text-gray-600">
                    Average Spend Per Job in {selectedMonth}:{' '}
                    <strong className="text-emerald-800 font-mono">
                      {currentMonthJobs > 0 ? `$${avgCostPerJob.toFixed(2)} / job` : 'N/A (Enter Jobs Completed above)'}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: MANAGE & CLEAN UP MONTH'S APPROVED SUBMISSIONS */}
      {isManageRecordsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onMouseDown={() => setIsManageRecordsOpen(false)}
        >
          <div 
            className="bg-[#F4F3ED] max-w-2xl w-full max-h-[88vh] rounded-lg shadow-2xl p-5 flex flex-col gap-3 animate-fade-in overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-gray-900">
                  Manage Monthly Submissions ({selectedMonth})
                </h3>
                <span className="text-[11px] text-gray-500">
                  Edit item quantities or delete accidental test submissions to keep matrix numbers accurate.
                </span>
              </div>
              <button onClick={() => setIsManageRecordsOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-3 min-h-[250px]">
              {approvedInMonth.length === 0 ? (
                <div className="text-center text-gray-400 italic text-xs py-10">
                  No approved submissions in {selectedMonth}.
                </div>
              ) : (
                approvedInMonth.map(req => {
                  const subDate = new Date(req.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={req.id} className="bg-white p-3.5 rounded-lg border border-gray-200 shadow-2xs flex flex-col gap-2">
                      <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-900">👤 {req.requested_by}</span>
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.2 rounded font-semibold">{req.company}</span>
                          <span className="text-[10px] text-gray-400">{subDate}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoricalRequest(req.id, req.requested_by)}
                          className="text-xs text-red-600 hover:text-red-800 font-bold hover:underline flex items-center gap-1"
                          title="Purge this request"
                        >
                          <span>🗑️</span>
                          <span>Delete Sheet</span>
                        </button>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {(req.items || []).map(it => (
                          <div key={it.id} className="flex justify-between items-center text-xs bg-gray-50 p-1.5 rounded border border-gray-100">
                            <span className="font-semibold text-gray-800">
                              {it.item_name} {it.is_bulk_refill ? '(Refill)' : ''}
                            </span>
                            <div className="flex items-center gap-1 bg-white p-0.5 rounded border border-gray-200">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantityInPastRequest(req.id, it.id, -1)}
                                disabled={it.quantity === 0}
                                className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 disabled:opacity-30"
                              >
                                −
                              </button>
                              <span className="min-w-[24px] text-center font-bold text-emerald-800">
                                {it.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQuantityInPastRequest(req.id, it.id, 1)}
                                className="w-5 h-5 rounded flex items-center justify-center bg-gray-100 text-gray-700 font-bold hover:bg-gray-200"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-gray-300">
              <button
                type="button"
                onClick={() => setIsManageRecordsOpen(false)}
                className="bg-[#333333] hover:bg-black text-white px-5 py-2 text-xs font-bold rounded shadow-sm transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REVIEW & APPROVE MODAL */}
      {editingRequest && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onMouseDown={() => setEditingRequest(null)}
        >
          <div 
            className="bg-[#F4F3ED] max-w-md w-full rounded-lg shadow-2xl p-5 flex flex-col gap-3 animate-fade-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-gray-900">
                  Review Supply Request
                </h3>
                <span className="text-[11px] text-gray-500">
                  Employee: <strong>{editingRequest.requested_by}</strong> ({editingRequest.company})
                </span>
              </div>
              <button onClick={() => setEditingRequest(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            {editingRequest.has_vehicle_warning && (
              <div className="bg-red-50 border border-red-300 p-2.5 rounded text-xs text-red-900">
                <strong>⚠️ Equipment / Vehicle Issue Reported!</strong>
                {editingRequest.vehicle_warning_note && (
                  <p className="mt-0.5 text-[11px] text-red-800">Note: {editingRequest.vehicle_warning_note}</p>
                )}
              </div>
            )}

            <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-2 max-h-60 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block border-b pb-1">
                Requested Items (Adjust quantities if needed)
              </span>
              {(editingRequest.items || []).map(item => {
                const invItem = inventory.find(i => String(i.id) === String(item.item_id));
                const jugs = Number(invItem?.quantity || 0);
                const cap = Number(invItem?.refills_per_jug || 0);
                
                const availableUnits = item.is_bulk_refill && cap > 0
                  ? (jugs * cap) + Math.max(0, cap - Number(invItem?.current_refill_usage || 0))
                  : jugs;

                const isShortage = Number(item.quantity) > availableUnits;
                const unitCost = getDispenseUnitPrice(invItem);

                return (
                  <div key={item.id} className="flex justify-between items-center text-xs py-1.5 border-b border-gray-100 last:border-0">
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-gray-800 truncate">{item.item_name}</span>
                        <span className="text-[10px] font-mono text-emerald-700 font-bold">
                          (${(unitCost * Number(item.quantity || 0)).toFixed(2)})
                        </span>
                        {isShortage && (
                          <span className="text-[9px] bg-red-100 text-red-700 px-1 py-0.2 rounded font-bold uppercase">
                            ⚠️ Shortage (Only {availableUnits} available)
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] block ${item.is_bulk_refill ? 'text-blue-600' : 'text-gray-500'}`}>
                        {item.is_bulk_refill 
                          ? `🧴 Bottle Refill ($${unitCost.toFixed(2)}/ea • ${availableUnits} left)` 
                          : `📦 Whole Unit ($${unitCost.toFixed(2)}/ea • ${availableUnits} in stock)`}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1 shrink-0 bg-gray-100 p-1 rounded border border-gray-200">
                      <button 
                        type="button" 
                        onClick={() => handleEditRequestQty(item.id, -1)} 
                        disabled={item.quantity === 0}
                        className="w-6 h-6 rounded bg-white text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200 shadow-2xs"
                      >
                        −
                      </button>
                      <span className={`min-w-[24px] text-center font-bold ${isShortage ? 'text-red-700' : 'text-emerald-800'}`}>
                        {item.quantity}
                      </span>
                      <button 
                        type="button" 
                        onClick={() => handleEditRequestQty(item.id, 1)} 
                        className="w-6 h-6 rounded bg-white text-gray-700 font-bold flex items-center justify-center hover:bg-gray-200 shadow-2xs"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <button 
                type="button" 
                onClick={handleRejectRequest}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Decline Request
              </button>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setEditingRequest(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded"
                >
                  Close
                </button>
                <button 
                  type="button" 
                  disabled={isApproving}
                  onClick={handleApproveRequest}
                  className="bg-[#5B7049] hover:bg-[#465638] text-white px-4 py-1.5 text-xs font-bold rounded shadow-sm transition"
                >
                  {isApproving ? 'Approving...' : '✓ Approve & Dispense'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EDIT/ADD ITEM MODAL */}
      <InventoryItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingItem={editingItem}
        activeCompanies={activeCompanies}
        refreshInventory={fetchInventory}
        currentProfile={currentProfile}
        userRole={userRole}
        onTriggerLowStockAlert={triggerLowStockAlert}
      />
    </div>
  );
}