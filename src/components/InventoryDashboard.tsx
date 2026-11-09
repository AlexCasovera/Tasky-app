// src/components/InventoryDashboard.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import InventoryItemModal from './InventoryItemModal';

export default function InventoryDashboard({ companiesData, currentProfile, userRole }) {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');

  // Sub-view: 'grid' | 'requests'
  const [subView, setSubView] = useState('grid');
  const [allRequests, setAllRequests] = useState([]);
  const [selectedRequestDetails, setSelectedRequestDetails] = useState(null);
  const [isApproving, setIsApproving] = useState(false);

  const activeCompanies = (companiesData || [])
    .filter(c => c.inventory_enabled)
    .map(c => c.name);
    
  const [selectedCompany, setSelectedCompany] = useState('All');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4500);
  };

  const fetchInventory = async () => {
    if (activeCompanies.length === 0) {
      setIsLoading(false);
      return;
    }
    
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .in('company', activeCompanies)
      .order('name');
      
    if (!error && data) {
      setInventory(data);
    }
    setIsLoading(false);
  };

  // Fetch requests and their items separately so foreign-key cache never blocks rendering
  const fetchSupplyRequests = async () => {
    if (activeCompanies.length === 0) return;

    const { data: reqs, error: reqErr } = await supabase
      .from('supply_requests')
      .select('*')
      .in('company', activeCompanies)
      .order('submitted_at', { ascending: false })
      .limit(100);

    if (reqErr || !reqs) return;

    const reqIds = reqs.map(r => r.id);
    let itemsMap = {};

    if (reqIds.length > 0) {
      const { data: itemRows } = await supabase
        .from('supply_request_items')
        .select('*')
        .in('request_id', reqIds);

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

  useEffect(() => {
    fetchInventory();
    fetchSupplyRequests();

    const invChannel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory();
      })
      .subscribe();

    const reqChannel = supabase
      .channel('supply-requests-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supply_requests' }, () => {
        fetchSupplyRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(invChannel);
      supabase.removeChannel(reqChannel);
    };
  }, [companiesData]);

  const triggerLowStockAlert = async (itemData) => {
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

      await supabase.from('notifications').insert({
        text: `🚨 Low Stock (${itemData.company}): "${itemData.name}" is at ${itemData.quantity} (Min: ${itemData.min_quantity}). Time to reorder!`,
        type: 'inventory_low',
        target_type: 'userName',
        target_value: targetName,
        read: false
      });

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

        let response;
        try {
          response = await fetch('/api/inventory-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!response.ok) throw new Error('Local route unavailable');
        } catch (localErr) {
          response = await fetch('https://tasky-app-gilt.vercel.app/api/inventory-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
        }

        if (response && response.ok) {
          showToast(`🔔 Low-stock Slack alert sent to ${targetName} for "${itemData.name}"!`);
        } else {
          showToast(`🔔 Low-stock alert logged for ${targetName} in notification center.`);
        }
      }
    } catch (err) {
      console.error('Error sending low stock alert:', err);
    }
  };

  const handleApproveRequest = async (request) => {
    setIsApproving(true);
    const reviewerName = currentProfile?.name || 'Admin';

    try {
      const items = request.items || [];

      for (const reqItem of items) {
        const invItem = inventory.find(i => String(i.id) === String(reqItem.item_id));
        if (!invItem) continue;

        const requestedQty = Number(reqItem.quantity || 1);
        const minQty = Number(invItem.min_quantity || 0);

        // Case 1: Bulk / Station Refill Item
        if (reqItem.is_bulk_refill || invItem.is_bulk_refill) {
          const cap = Number(invItem.refills_per_jug || 0);
          if (cap > 0) {
            // Auto-deduct 1 full jug every N refills
            const totalRefillsUsed = Number(invItem.current_refill_usage || 0) + requestedQty;
            const jugsToDeduct = Math.floor(totalRefillsUsed / cap);
            const remainderRefills = totalRefillsUsed % cap;
            const newJugQty = Math.max(0, Number(invItem.quantity || 0) - jugsToDeduct);
            const isNowLow = minQty > 0 && newJugQty <= minQty;
            const shouldNotify = isNowLow && !invItem.low_stock_notified;

            await supabase
              .from('inventory')
              .update({
                quantity: newJugQty,
                current_refill_usage: remainderRefills,
                low_stock_notified: isNowLow,
                updated_at: new Date().toISOString()
              })
              .eq('id', invItem.id);

            if (shouldNotify) {
              await triggerLowStockAlert({ ...invItem, quantity: newJugQty, min_quantity: minQty });
            }
          }
          continue;
        }

        // Case 2: Standard 1:1 Consumable Item
        const newQty = Math.max(0, Number(invItem.quantity || 0) - requestedQty);
        const isNowLow = minQty > 0 && newQty <= minQty;
        const shouldNotify = isNowLow && !invItem.low_stock_notified;

        await supabase
          .from('inventory')
          .update({
            quantity: newQty,
            low_stock_notified: isNowLow,
            updated_at: new Date().toISOString()
          })
          .eq('id', invItem.id);

        if (shouldNotify) {
          await triggerLowStockAlert({
            ...invItem,
            quantity: newQty,
            min_quantity: minQty
          });
        }
      }

      await supabase
        .from('supply_requests')
        .update({
          status: 'approved',
          reviewed_by: reviewerName,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', request.id);

      await supabase.from('notifications').insert({
        text: `✅ Supply Request Approved: Your items for Car #${request.car_number} were approved by ${reviewerName}. You can grab them now!`,
        type: 'supply_approved',
        target_type: 'userName',
        target_value: request.requested_by,
        read: false
      });

      setSelectedRequestDetails(null);
      fetchInventory();
      fetchSupplyRequests();
      showToast(`✓ Car #${request.car_number} request approved & inventory updated.`);
    } catch (err) {
      alert(`Error approving request: ${err.message}`);
    } finally {
      setIsApproving(false);
    }
  };

  const handleRejectRequest = async (request) => {
    if (!window.confirm(`Reject supply request for Car #${request.car_number}?`)) return;
    const reviewerName = currentProfile?.name || 'Admin';

    await supabase
      .from('supply_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewerName,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', request.id);

    await supabase.from('notifications').insert({
      text: `❌ Supply Request Declined: Your supply sheet for Car #${request.car_number} was declined by ${reviewerName}.`,
      type: 'supply_rejected',
      target_type: 'userName',
      target_value: request.requested_by,
      read: false
    });

    setSelectedRequestDetails(null);
    fetchSupplyRequests();
  };

  const handleQuickUpdateQuantity = async (id, delta) => {
    const target = inventory.find(i => i.id === id);
    if (!target) return;

    const newQty = Math.max(0, Number(target.quantity || 0) + delta);
    if (newQty === target.quantity) return;

    const minQty = Number(target.min_quantity || 0);
    const isNowLow = minQty > 0 && newQty <= minQty;
    const shouldNotify = isNowLow && !target.low_stock_notified;

    setInventory(prev => prev.map(i => 
      i.id === id ? { ...i, quantity: newQty, low_stock_notified: isNowLow } : i
    ));

    const { error } = await supabase
      .from('inventory')
      .update({
        quantity: newQty,
        low_stock_notified: isNowLow,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      fetchInventory();
      return;
    }

    if (shouldNotify) {
      await triggerLowStockAlert({
        ...target,
        quantity: newQty,
        min_quantity: minQty
      });
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

  if (activeCompanies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-2 mt-20">
        <span className="text-4xl">📦</span>
        <h2 className="text-xl font-bold">Inventory System Inactive</h2>
        <p className="text-sm">Enable the Inventory Module for at least one company in Settings.</p>
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

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {toastMessage && (
        <div className="mb-4 bg-amber-900 text-white px-4 py-2.5 rounded-lg shadow-md text-xs font-bold flex items-center justify-between animate-fade-in">
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage('')} className="ml-4 text-amber-200 hover:text-white">✕</button>
        </div>
      )}

      {/* TOP TITLE & SUB-NAVIGATION BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-serif font-bold">Master Inventory</h1>
          <span className="bg-[#A9B1A6] text-white text-xs font-bold px-2.5 py-1 rounded-full">{filteredInventory.length} Items</span>
          {lowStockCount > 0 && (
            <span className="bg-red-100 text-red-800 border border-red-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⚠️ {lowStockCount} Needs Reorder
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Sub-Tabs: Stock Grid vs Supply Requests Log */}
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
              <span>📋 Supply Requests & Log</span>
              {pendingRequests.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full animate-pulse">
                  {pendingRequests.length}
                </span>
              )}
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

      {/* PENDING SUPPLY REQUESTS BANNER (ALWAYS VISIBLE AT TOP WHEN PENDING > 0) */}
      {pendingRequests.length > 0 && (
        <div className="mb-6 bg-amber-50 border-2 border-amber-300 rounded-lg p-3.5 shadow-sm">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="text-lg">📋</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-amber-950">
                Action Required: Pending Supply Requests ({pendingRequests.length})
              </h3>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold">Click a request to review & approve</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {pendingRequests.map(req => {
              const totalCount = (req.items || []).reduce((acc, i) => acc + Number(i.quantity || 0), 0);
              const submittedTime = new Date(req.submitted_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

              return (
                <div 
                  key={req.id}
                  onClick={() => setSelectedRequestDetails(req)}
                  className="bg-white p-3 rounded-lg border border-amber-300 hover:border-amber-500 cursor-pointer shadow-2xs flex justify-between items-center transition group"
                >
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-gray-900">Car #{req.car_number}</span>
                      <span className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold">
                        {req.company}
                      </span>
                      {req.has_vehicle_warning && (
                        <span className="text-[9px] bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">
                          ⚠️ Vehicle Light
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-gray-600 block mt-1">
                      By: <strong>{req.requested_by}</strong> • {totalCount} item{totalCount === 1 ? '' : 's'}
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
        </div>
      )}

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
                      {item.is_bulk_refill && (
                        <div className="absolute bottom-2 left-2 bg-blue-900/85 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded">
                          🧴 {item.refill_unit_label || 'Bottle Refill'}
                          {Number(item.refills_per_jug) > 0 && ` (${item.current_refill_usage || 0}/${item.refills_per_jug})`}
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
                          {minQty > 0 && (
                            <span className="text-[10px] font-semibold text-gray-400 block">
                              Min Backstock: {minQty}
                            </span>
                          )}
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
            <h2 className="font-serif font-bold text-lg text-gray-800">Supply Sheet History & Crew Usage Log</h2>
            <select 
              value={selectedCompany} 
              onChange={(e) => setSelectedCompany(e.target.value)}
              className="w-64 px-3 py-1.5 border border-gray-300 rounded bg-white font-bold text-xs focus:outline-none"
            >
              <option value="All">All Enabled Companies</option>
              {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

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
                        <span className="font-bold text-sm text-gray-900">Car #{req.car_number}</span>
                        <span className="text-gray-500">• Requested by <strong>{req.requested_by}</strong></span>
                        <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold text-[10px]">{req.company}</span>
                        {req.has_vehicle_warning && (
                          <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold text-[10px]">
                            ⚠️ Vehicle Warning: {req.vehicle_warning_note || 'Yes'}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(req.items || []).map(it => (
                          <span key={it.id} className="bg-gray-50 border border-gray-200 px-2 py-0.5 rounded text-[11px] font-semibold text-gray-700">
                            {it.item_name}: <strong>{it.quantity}</strong> {it.is_bulk_refill ? '(Refill)' : ''}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-[10px] text-gray-400 sm:text-right shrink-0">
                      <div>Submitted: {subDate}</div>
                      {req.reviewed_by && <div>Reviewed by: <strong>{req.reviewed_by}</strong></div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* REQUEST REVIEW & APPROVAL MODAL */}
      {selectedRequestDetails && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onMouseDown={() => setSelectedRequestDetails(null)}
        >
          <div 
            className="bg-[#F4F3ED] max-w-md w-full rounded-lg shadow-2xl p-5 flex flex-col gap-3 animate-fade-in"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center border-b border-gray-300 pb-2">
              <div>
                <h3 className="font-serif font-bold text-lg text-gray-900">
                  Review Supply Request — Car #{selectedRequestDetails.car_number}
                </h3>
                <span className="text-[11px] text-gray-500">
                  Requester: <strong>{selectedRequestDetails.requested_by}</strong> ({selectedRequestDetails.company})
                </span>
              </div>
              <button onClick={() => setSelectedRequestDetails(null)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            {selectedRequestDetails.has_vehicle_warning && (
              <div className="bg-red-50 border border-red-300 p-2.5 rounded text-xs text-red-900">
                <strong>⚠️ Vehicle Warning Light Reported ON!</strong>
                {selectedRequestDetails.vehicle_warning_note && (
                  <p className="mt-0.5 text-[11px] text-red-800">Note: {selectedRequestDetails.vehicle_warning_note}</p>
                )}
              </div>
            )}

            <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-2 max-h-60 overflow-y-auto">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block border-b pb-1">
                Requested Items
              </span>
              {(selectedRequestDetails.items || []).map(item => (
                <div key={item.id} className="flex justify-between items-center text-xs py-1 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="font-bold text-gray-800">{item.item_name}</span>
                    <span className="text-[10px] text-gray-500 block">
                      {item.is_bulk_refill ? '🧴 Small Bottle Refill (Logs usage)' : '📦 Whole Unit (Deducts 1:1 from stock)'}
                    </span>
                  </div>
                  <span className="font-bold bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded text-emerald-900">
                    Qty: {item.quantity}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <button 
                type="button" 
                onClick={() => handleRejectRequest(selectedRequestDetails)}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Decline Request
              </button>

              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => setSelectedRequestDetails(null)}
                  className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded"
                >
                  Close
                </button>
                <button 
                  type="button" 
                  disabled={isApproving}
                  onClick={() => handleApproveRequest(selectedRequestDetails)}
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