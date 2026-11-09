// src/components/SupplyRequestModal.tsx
// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export default function SupplyRequestModal({
  isOpen,
  onClose,
  inventory,
  activeCompanies,
  currentProfile,
  onSubmitted
}) {
  const [carNumber, setCarNumber] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('');
  const [hasWarningLight, setHasWarningLight] = useState(false);
  const [warningLightNote, setWarningLightNote] = useState('');
  const [quantities, setQuantities] = useState({});
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedRole = String(currentProfile?.role || '').toLowerCase().trim();

  const allowedCompanies = (() => {
    if (normalizedRole === 'admin') {
      return activeCompanies || [];
    }
    const profilePerms = currentProfile?.supplySheetCompanies || currentProfile?.supply_sheet_companies || [];
    const parsed = Array.isArray(profilePerms) ? profilePerms : JSON.parse(profilePerms || '[]');
    const matching = (activeCompanies || []).filter(c => parsed.includes(c));
    return matching.length > 0 ? matching : (activeCompanies || []);
  })();

  useEffect(() => {
    if (allowedCompanies.length > 0 && (!selectedCompany || !allowedCompanies.includes(selectedCompany))) {
      setSelectedCompany(allowedCompanies[0]);
    }
  }, [allowedCompanies, selectedCompany]);

  useEffect(() => {
    if (!isOpen) {
      setQuantities({});
      setHasWarningLight(false);
      setWarningLightNote('');
      setCarNumber('');
      setSearch('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const companyItems = (inventory || []).filter(item => item.company === selectedCompany);
  const filteredItems = companyItems.filter(item => 
    !search.trim() || item.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleQtyChange = (itemId, delta) => {
    setQuantities(prev => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const totalItemsSelected = Object.values(quantities).reduce((acc, q) => acc + q, 0);

  const handleSubmit = async () => {
    if (!carNumber.trim()) {
      return alert('Please enter a Car / Van # (Por favor ingresa el Número de Coche).');
    }
    if (totalItemsSelected === 0) {
      return alert('Please select at least 1 item (Por favor selecciona al menos un producto).');
    }

    setIsSubmitting(true);
    const applicantName = currentProfile?.name || 'Cleaner';

    try {
      const { data: requestData, error: reqErr } = await supabase
        .from('supply_requests')
        .insert({
          company: selectedCompany,
          requested_by: applicantName,
          car_number: carNumber.trim(),
          has_vehicle_warning: hasWarningLight,
          vehicle_warning_note: hasWarningLight ? warningLightNote.trim() : null,
          status: 'pending'
        })
        .select()
        .single();

      if (reqErr) throw reqErr;

      const itemRows = Object.entries(quantities).map(([itemId, qty]) => {
        const itemObj = inventory.find(i => i.id === itemId);
        return {
          request_id: requestData.id,
          item_id: String(itemId),
          item_name: itemObj?.name || 'Product',
          quantity: Number(qty),
          is_bulk_refill: Boolean(itemObj?.is_bulk_refill)
        };
      });

      const { error: itemsErr } = await supabase
        .from('supply_request_items')
        .insert(itemRows);

      if (itemsErr) throw itemsErr;

      // Look up who manages inventory/supply sheets for this company
      const { data: compData } = await supabase
        .from('companies')
        .select('inventory_manager')
        .eq('name', selectedCompany)
        .single();

      const managerName = compData?.inventory_manager || '';
      const notifText = `📋 Supply Request: Car #${carNumber.trim()} (${applicantName}) requested ${totalItemsSelected} items for ${selectedCompany}.${hasWarningLight ? ' ⚠️ Vehicle Light ON!' : ''}`;

      // 1. Send notification to the assigned Manager (e.g., Alex M.)
      if (managerName) {
        await supabase.from('notifications').insert({
          text: notifText,
          type: 'supply_request',
          target_type: 'userName',
          target_value: managerName,
          read: false
        });
      }

      // 2. Also send to role='admin' so Admin / Dev Account always sees it too
      await supabase.from('notifications').insert({
        text: notifText,
        type: 'supply_request',
        target_type: 'role',
        target_value: 'admin',
        read: false
      });

      if (typeof onSubmitted === 'function') onSubmitted();
      alert('✓ Supply request submitted! (Solicitud enviada con éxito).');
      onClose();
    } catch (err) {
      alert(`Error submitting request: ${err.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 z-50"
      onMouseDown={onClose}
    >
      <div 
        className="bg-[#F4F3ED] max-w-lg w-full max-h-[90vh] rounded-lg shadow-2xl p-5 flex flex-col gap-3 animate-fade-in overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-300 pb-3 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">🧴</span>
              <h2 className="text-xl font-serif font-bold text-gray-900 leading-tight">
                Daily Supply Sheet <span className="text-sm font-sans font-normal text-gray-500">/ Hoja de Químicos</span>
              </h2>
            </div>
            <p className="text-[11px] text-gray-500 font-semibold mt-0.5">
              Daily chemical & equipment request <span className="italic">(Solicitud de productos para limpieza)</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold text-lg">✕</button>
        </div>

        <div className="bg-white p-3 rounded-lg border border-gray-200 grid grid-cols-2 gap-3 text-xs shadow-2xs">
          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
              Car / Van # <span className="font-normal text-gray-400 lowercase">(número de coche)</span> *
            </label>
            <input 
              type="text" 
              value={carNumber} 
              onChange={(e) => setCarNumber(e.target.value)} 
              placeholder="e.g., Van 4 / Car 2" 
              className="w-full p-2 border border-gray-300 rounded font-bold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]" 
            />
          </div>

          <div>
            <label className="block font-bold text-gray-700 uppercase tracking-wider text-[10px] mb-1">
              Company <span className="font-normal text-gray-400 lowercase">(compañía)</span>
            </label>
            {allowedCompanies.length > 1 ? (
              <select 
                value={selectedCompany} 
                onChange={(e) => setSelectedCompany(e.target.value)}
                className="w-full p-2 border border-gray-300 rounded font-bold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none"
              >
                {allowedCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <div className="w-full p-2 border border-gray-200 rounded font-bold text-gray-700 bg-gray-100 truncate">
                {selectedCompany || 'Sparkulous'}
              </div>
            )}
          </div>
        </div>

        <div className="relative">
          <input 
            type="text" 
            placeholder="🔍 Search items by name (Buscar producto)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-[#A9B1A6]"
          />
        </div>

        <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 min-h-[220px]">
          {filteredItems.length === 0 ? (
            <div className="text-center text-gray-400 italic text-xs py-8">
              No products found for {selectedCompany}.
            </div>
          ) : (
            filteredItems.map(item => {
              const qty = quantities[item.id] || 0;
              const unitText = item.is_bulk_refill 
                ? `🧴 ${item.refill_unit_label || '8oz Bottle Refill'} (Relleno)` 
                : '📦 Whole Unit (Unidad entera)';

              return (
                <div 
                  key={item.id} 
                  className={`p-2 rounded-lg border transition flex items-center justify-between text-xs ${
                    qty > 0 
                      ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs' 
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded object-cover border border-gray-200 shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-sm shrink-0">📦</div>
                    )}
                    <div className="min-w-0">
                      <span className="font-bold text-gray-800 block truncate">{item.name}</span>
                      <span className={`text-[10px] block truncate font-semibold ${item.is_bulk_refill ? 'text-blue-700' : 'text-gray-400'}`}>
                        {unitText}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0 bg-gray-100 p-1 rounded border border-gray-200">
                    <button 
                      type="button" 
                      onClick={() => handleQtyChange(item.id, -1)} 
                      disabled={qty === 0}
                      className="w-6 h-6 rounded bg-white text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs active:scale-95"
                    >
                      −
                    </button>

                    <span className={`min-w-[26px] text-center font-bold text-xs ${qty > 0 ? 'text-emerald-700 font-black' : 'text-gray-400'}`}>
                      {qty}
                    </span>

                    <button 
                      type="button" 
                      onClick={() => handleQtyChange(item.id, 1)} 
                      className="w-6 h-6 rounded bg-white text-gray-700 font-bold text-xs flex items-center justify-center hover:bg-gray-200 shadow-2xs active:scale-95"
                    >
                      +
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={`p-3 rounded-lg border text-xs transition ${hasWarningLight ? 'bg-amber-50 border-amber-300' : 'bg-white border-gray-200'}`}>
          <label className="flex items-center gap-2 cursor-pointer font-bold text-gray-800">
            <input 
              type="checkbox" 
              checked={hasWarningLight} 
              onChange={(e) => setHasWarningLight(e.target.checked)} 
              className="accent-amber-600 w-4 h-4 cursor-pointer" 
            />
            <span>Vehicle warning light ON? <span className="font-normal text-gray-500">(¿Luz de advertencia encendida?)</span></span>
          </label>

          {hasWarningLight && (
            <input 
              type="text" 
              value={warningLightNote} 
              onChange={(e) => setWarningLightNote(e.target.value)} 
              placeholder="Details: Check Engine, Tire Pressure, Oil change... (Detalles)" 
              className="w-full mt-2 p-1.5 border border-amber-300 rounded bg-white text-xs focus:outline-none" 
            />
          )}
        </div>

        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
          <div className="text-xs text-gray-500 font-semibold">
            Requester: <span className="font-bold text-gray-800">{currentProfile?.name || 'Cleaner'}</span>
          </div>

          <div className="flex gap-2">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-3 py-1.5 text-xs font-bold text-gray-600 hover:bg-gray-200 rounded"
            >
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSubmit} 
              disabled={isSubmitting || totalItemsSelected === 0}
              className="bg-[#5B7049] hover:bg-[#465638] text-white px-5 py-2 text-xs font-bold rounded shadow-sm disabled:opacity-40 transition flex items-center gap-1.5"
            >
              <span>{isSubmitting ? 'Submitting...' : `✓ Submit Request (${totalItemsSelected})`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}