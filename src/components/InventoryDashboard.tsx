// src/components/InventoryDashboard.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import InventoryItemModal from './InventoryItemModal';

export default function InventoryDashboard({ companiesData, currentProfile }) {
  const [inventory, setInventory] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeCompanies = (companiesData || [])
    .filter(c => c.inventory_enabled)
    .map(c => c.name);
    
  const [selectedCompany, setSelectedCompany] = useState('All');

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

  const handleQuickUpdateQuantity = async (id, delta) => {
    const target = inventory.find(i => i.id === id);
    if (!target) return;

    const newQty = Math.max(0, Number(target.quantity || 0) + delta);
    if (newQty === target.quantity) return;

    // Optimistic state update
    setInventory(prev => prev.map(i => i.id === id ? { ...i, quantity: newQty } : i));

    const { error } = await supabase
      .from('inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Failed to update quantity:', error);
      fetchInventory();
    }
  };

  if (currentProfile?.role !== 'admin' && !currentProfile?.inventoryAccess) {
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

  return (
    <div className="flex flex-col h-full animate-fade-in">
      <div className="flex justify-between items-center mb-6 border-b border-gray-300 pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-3xl font-serif font-bold">Master Inventory</h1>
          <span className="bg-[#A9B1A6] text-white text-xs font-bold px-2 py-1 rounded-full">{inventory.length} Items</span>
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
          {filteredInventory.map(item => (
            <div 
              key={item.id} 
              onClick={() => { setEditingItem(item); setIsModalOpen(true); }}
              className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-[#A9B1A6] transition group flex flex-col">
              
              <div className="h-40 bg-gray-100 relative">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">📦</div>
                )}
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                  {item.company}
                </div>
              </div>
              
              <div className="p-3 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2 gap-2">
                  <h3 className="font-bold text-gray-800 text-sm truncate" title={item.name}>{item.name}</h3>
                  
                  {/* QUICK QUANTITY STEPPER */}
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
                      item.quantity <= 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-800'
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
          ))}
        </div>
      )}

      <InventoryItemModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        editingItem={editingItem}
        activeCompanies={activeCompanies}
        refreshInventory={fetchInventory}
      />
    </div>
  );
}