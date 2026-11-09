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

  useEffect(() => {
    fetchInventory();

    const channel = supabase
      .channel('inventory-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory' }, () => {
        fetchInventory();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
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

      // Bell notification
      await supabase.from('notifications').insert({
        text: `🚨 Low Stock (${itemData.company}): "${itemData.name}" is at ${itemData.quantity} (Min: ${itemData.min_quantity}). Time to reorder!`,
        type: 'inventory_low',
        target_type: 'userName',
        target_value: targetName,
        read: false
      });

      // Slack push
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
      } else {
        showToast(`⚠️ "${itemData.name}" is below minimum! (Set a Slack ID for ${targetName} in Settings for Slack DMs).`);
      }
    } catch (err) {
      console.error('Error sending low stock alert:', err);
    }
  };

  const handleQuickUpdateQuantity = async (id, delta) => {
    const target = inventory.find(i => i.id === id);
    if (!target) return;

    const newQty = Math.max(0, Number(target.quantity || 0) + delta);
    if (newQty === target.quantity) return;

    const minQty = Number(target.min_quantity || 0);
    const isNowLow = minQty > 0 && newQty <= minQty;
    const shouldNotify = isNowLow && !target.low_stock_notified;
    const nextNotifiedState = isNowLow ? true : false;

    setInventory(prev => prev.map(i => 
      i.id === id ? { ...i, quantity: newQty, low_stock_notified: nextNotifiedState } : i
    ));

    const { error } = await supabase
      .from('inventory')
      .update({
        quantity: newQty,
        low_stock_notified: nextNotifiedState,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to update quantity:', error);
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
  const hasInventoryPermission = normalizedRole === 'admin' || Boolean(currentProfile?.inventoryAccess);

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

      <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-serif font-bold">Master Inventory</h1>
          <span className="bg-[#A9B1A6] text-white text-xs font-bold px-2.5 py-1 rounded-full">{filteredInventory.length} Items</span>
          {lowStockCount > 0 && (
            <span className="bg-red-100 text-red-800 border border-red-300 text-xs font-bold px-2.5 py-1 rounded-full">
              ⚠️ {lowStockCount} Needs Reorder
            </span>
          )}
        </div>
        <button 
          onClick={() => { setEditingItem(null); setIsModalOpen(true); }}
          className="bg-[#333333] text-white px-5 py-2 rounded text-sm font-bold shadow-sm hover:bg-black transition">
          + Add Item
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <input 
          type="text" 
          placeholder="🔍 Search inventory by name or description..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 px-4 py-2 border border-gray-300 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] bg-white"
        />
        <select 
          value={selectedCompany} 
          onChange={(e) => setSelectedCompany(e.target.value)}
          className="w-64 px-4 py-2 border border-gray-300 rounded shadow-sm bg-white font-bold text-sm focus:outline-none">
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
                          Min Required: {minQty}
                        </span>
                      )}
                    </div>
                    
                    {/* Quick Quantity Stepper */}
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