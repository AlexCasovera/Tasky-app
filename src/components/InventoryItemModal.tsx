// src/components/InventoryItemModal.tsx
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { compressImage } from '../utils';

export default function InventoryItemModal({
  isOpen,
  onClose,
  editingItem,
  activeCompanies,
  refreshInventory,
  currentProfile,
  userRole,
  onTriggerLowStockAlert
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [minQuantity, setMinQuantity] = useState(0);
  const [isBulkRefill, setIsBulkRefill] = useState(false);
  const [refillUnitLabel, setRefillUnitLabel] = useState('8oz Bottle Refill');
  const [refillsPerJug, setRefillsPerJug] = useState(0);
  const [currentRefillsLeft, setCurrentRefillsLeft] = useState(0);

  // Pricing & Vendor States
  const [unitPrice, setUnitPrice] = useState('0.00');
  const [vendorName, setVendorName] = useState('Manual');
  const [vendorUrl, setVendorUrl] = useState('');
  const [priceLocked, setPriceLocked] = useState(false);
  const [isSyncingPrice, setIsSyncingPrice] = useState(false);

  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

  const normalizedRole = String(userRole || currentProfile?.role || '').toLowerCase().trim();
  const isAdmin = normalizedRole === 'admin' || Boolean(currentProfile?.inventoryAccess);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (editingItem) {
      setName(editingItem.name || '');
      setDescription(editingItem.description || '');
      setCompany(editingItem.company || '');
      setQuantity(editingItem.quantity ?? 0);
      setMinQuantity(editingItem.min_quantity ?? 0);
      setIsBulkRefill(Boolean(editingItem.is_bulk_refill));
      setRefillUnitLabel(editingItem.refill_unit_label || '8oz Bottle Refill');
      const perJug = Number(editingItem.refills_per_jug ?? 0);
      setRefillsPerJug(perJug);
      const used = Number(editingItem.current_refill_usage ?? 0);
      setCurrentRefillsLeft(perJug > 0 ? Math.max(0, perJug - used) : 0);
      setUnitPrice(Number(editingItem.unit_price ?? 0).toFixed(2));
      setVendorName(editingItem.vendor_name || 'Manual');
      setVendorUrl(editingItem.vendor_url || '');
      setPriceLocked(Boolean(editingItem.price_locked));
      setImageUrl(editingItem.image_url || '');
    } else {
      setName('');
      setDescription('');
      setCompany(activeCompanies[0] || '');
      setQuantity(0);
      setMinQuantity(0);
      setIsBulkRefill(false);
      setRefillUnitLabel('8oz Bottle Refill');
      setRefillsPerJug(0);
      setCurrentRefillsLeft(0);
      setUnitPrice('0.00');
      setVendorName('Manual');
      setVendorUrl('');
      setPriceLocked(false);
      setImageUrl('');
    }
    setIsDragging(false);
  }, [editingItem, activeCompanies, isOpen]);

  if (!isOpen) return null;

  // Automatic division for bulk jugs
  const numericJugOrUnitPrice = Math.max(0, parseFloat(unitPrice) || 0);
  const perRefillCost = (isBulkRefill && Number(refillsPerJug) > 0)
    ? (numericJugOrUnitPrice / Number(refillsPerJug))
    : numericJugOrUnitPrice;

  const handleFetchVendorPrice = async () => {
    if (priceLocked) {
      return alert('Price is currently locked. Uncheck "Lock Price" to sync from vendor URL.');
    }
    if (!vendorUrl.trim()) {
      return alert('Please paste a Home Depot or Amazon product URL first.');
    }

    setIsSyncingPrice(true);
    try {
      const res = await fetch('/api/sync-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: vendorUrl.trim() })
      });
      const data = await res.json();
      if (data.success && data.price) {
        setUnitPrice(Number(data.price).toFixed(2));
        alert(`✓ Updated price to $${Number(data.price).toFixed(2)} from vendor page!`);
      } else {
        alert(`ℹ️ ${data.reason || 'Could not auto-read price from URL. Please enter price manually.'}`);
      }
    } catch (err) {
      alert('Could not reach price sync endpoint. You can type the price manually.');
    } finally {
      setIsSyncingPrice(false);
    }
  };

  const processAndUploadFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please upload an image file.');

    setIsUploading(true);
    try {
      const compressedFile = await compressImage(file, 1280, 1280, 0.7);
      const fileExt = compressedFile.name?.split('.').pop() || 'jpg';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('inventory-images')
        .upload(fileName, compressedFile);

      if (uploadErr) throw uploadErr;

      const { data } = supabase.storage.from('inventory-images').getPublicUrl(fileName);
      setImageUrl(data.publicUrl);
    } catch (err) {
      alert(`Image upload failed: ${err.message}`);
    } finally {
      setIsUploading(false);
      setIsDragging(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAndUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return alert('Item name is required.');
    if (!company) return alert('Company is required.');

    setIsSaving(true);
    const numQty = Number(quantity);
    const numMin = Number(minQuantity);
    const isAtOrBelowMin = numMin > 0 && numQty <= numMin;

    const minWasChanged = !editingItem || Number(editingItem.min_quantity || 0) !== numMin;
    const shouldFireAlert = isAtOrBelowMin && (!editingItem?.low_stock_notified || minWasChanged);

    const perJug = Math.max(0, Number(refillsPerJug || 0));
    const refillsLeft = Math.max(0, Math.min(perJug, Number(currentRefillsLeft || 0)));
    const calculatedUsed = perJug > 0 ? (perJug - refillsLeft) : 0;

    const payload = {
      name: name.trim(),
      description: description.trim(),
      company,
      quantity: numQty,
      min_quantity: numMin,
      is_bulk_refill: isBulkRefill,
      refill_unit_label: isBulkRefill ? (refillUnitLabel.trim() || 'Bottle Refill') : null,
      refills_per_jug: perJug,
      current_refill_usage: isBulkRefill ? calculatedUsed : 0,
      unit_price: numericJugOrUnitPrice,
      vendor_name: vendorName,
      vendor_url: vendorUrl.trim(),
      price_locked: priceLocked,
      low_stock_notified: isAtOrBelowMin,
      image_url: imageUrl,
      updated_at: new Date().toISOString()
    };

    try {
      if (editingItem) {
        const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('inventory').insert(payload);
        if (error) throw error;
      }

      if (shouldFireAlert && typeof onTriggerLowStockAlert === 'function') {
        await onTriggerLowStockAlert({
          name: payload.name,
          company: payload.company,
          quantity: numQty,
          min_quantity: numMin
        });
      }

      refreshInventory();
      onClose();
    } catch (err) {
      alert(`Error saving item: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', editingItem.id);
      if (error) throw error;
      refreshInventory();
      onClose();
    } catch (err) {
      alert(`Error deleting item: ${err.message}`);
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onMouseDown={onClose}
    >
      <div 
        className="bg-[#F4F3ED] max-w-md w-full max-h-[92vh] overflow-y-auto rounded-lg shadow-2xl p-6 flex flex-col gap-4 animate-fade-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center border-b border-gray-300 pb-3">
          <h2 className="text-xl font-serif font-bold text-gray-900">
            {editingItem ? 'Edit Inventory Item' : 'New Inventory Item'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Item Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)} 
              placeholder="e.g., Dawn Soap / Sparoxide"
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] bg-white" 
            />
          </div>

          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="block text-xs font-bold text-gray-700 mb-1">Company</label>
              <select 
                value={company} 
                onChange={(e) => setCompany(e.target.value)} 
                className="w-full p-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]">
                {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-1/4">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                {isBulkRefill ? 'Unopened Jugs' : 'Backstock'}
              </label>
              <input 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] text-center font-bold bg-white" 
              />
            </div>
            <div className="w-1/4">
              <label className="block text-xs font-bold text-amber-800 mb-1" title="Sends a Slack alert when stock is at or below this number">
                Min Alert 🔔
              </label>
              <input 
                type="number" 
                min="0"
                value={minQuantity} 
                disabled={!isAdmin}
                onChange={(e) => setMinQuantity(e.target.value)} 
                className={`w-full p-2 text-sm border rounded focus:outline-none text-center font-bold transition ${
                  isAdmin 
                    ? 'border-amber-300 bg-amber-50/60 text-amber-900 focus:ring-2 focus:ring-amber-400 cursor-text' 
                    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                }`} 
              />
            </div>
          </div>

          {/* PRICING, VENDOR & COST CALCULATION */}
          <div className="bg-white p-3 rounded-lg border border-emerald-200 flex flex-col gap-2.5 shadow-2xs">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-950">
                💲 Pricing & Vendor Tracking
              </span>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-700 cursor-pointer">
                <input 
                  type="checkbox"
                  checked={priceLocked}
                  onChange={(e) => setPriceLocked(e.target.checked)}
                  className="accent-emerald-700 w-3.5 h-3.5 cursor-pointer"
                />
                <span>🔒 Lock / In-House Override</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  {isBulkRefill ? 'Price Per Full Jug ($)' : 'Price Per Unit ($)'}
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-2 text-xs font-bold text-gray-500">$</span>
                  <input 
                    type="number"
                    step="0.01"
                    min="0"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full pl-6 pr-2 py-1.5 text-xs border border-gray-300 rounded font-bold text-gray-900 bg-gray-50 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-600 uppercase mb-1">
                  Primary Vendor
                </label>
                <select
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full p-1.5 text-xs border border-gray-300 rounded bg-white font-semibold"
                >
                  <option value="Manual">Manual / In-House</option>
                  <option value="Amazon">Amazon</option>
                  <option value="Home Depot">Home Depot</option>
                  <option value="Wholesale">Wholesale / Other</option>
                </select>
              </div>
            </div>

            {/* Automatic Refill Cost Division Preview */}
            {isBulkRefill && Number(refillsPerJug) > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded flex justify-between items-center text-xs">
                <span className="text-emerald-900 font-semibold">
                  🧴 Auto-Calculated Cost Per Refill:
                </span>
                <span className="font-black text-emerald-800">
                  ${perRefillCost.toFixed(2)} / {refillUnitLabel || 'Refill'}
                </span>
              </div>
            )}

            {/* Optional Vendor URL & Auto-Fetch */}
            {vendorName !== 'Manual' && (
              <div className="pt-1 border-t border-gray-100 flex flex-col gap-1.5">
                <label className="block text-[10px] font-bold text-gray-500 uppercase">
                  Product Link ({vendorName} URL)
                </label>
                <div className="flex gap-1.5">
                  <input 
                    type="url"
                    value={vendorUrl}
                    onChange={(e) => setVendorUrl(e.target.value)}
                    placeholder={`Paste ${vendorName} product link...`}
                    className="flex-1 p-1.5 text-xs border border-gray-300 rounded bg-white"
                  />
                  {!priceLocked && (
                    <button
                      type="button"
                      disabled={isSyncingPrice || !vendorUrl.trim()}
                      onClick={handleFetchVendorPrice}
                      className="bg-emerald-700 hover:bg-emerald-800 text-white px-2.5 py-1 rounded text-[10px] font-bold shrink-0 disabled:opacity-40 transition"
                    >
                      {isSyncingPrice ? 'Checking...' : '🔄 Fetch Price'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* BULK REFILL CONFIGURATION & JUG LEVEL ADJUSTER */}
          <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col gap-2.5">
            <div className="flex items-start gap-2.5">
              <input 
                type="checkbox"
                id="isBulkRefillCheck"
                checked={isBulkRefill}
                onChange={(e) => setIsBulkRefill(e.target.checked)}
                className="accent-blue-600 w-4 h-4 mt-0.5 cursor-pointer"
              />
              <label htmlFor="isBulkRefillCheck" className="text-xs cursor-pointer">
                <span className="font-bold text-gray-800 block">Dispensed into Smaller Refill Bottles (e.g., Dawn, Bona, Vinegar)</span>
                <span className="text-[11px] text-gray-500">
                  Tasky divides the Full Jug Price by Refills Per Jug to calculate exact employee refill costs.
                </span>
              </label>
            </div>

            {isBulkRefill && (
              <div className="pt-2 border-t border-gray-100 flex flex-col gap-2 text-xs bg-blue-50/40 p-2.5 rounded">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
                      Cleaner Request Unit
                    </label>
                    <input 
                      type="text"
                      value={refillUnitLabel}
                      onChange={(e) => setRefillUnitLabel(e.target.value)}
                      placeholder="e.g., 8oz Bottle Refill"
                      className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-blue-900 uppercase mb-1">
                      Refills Per 1 Jug
                    </label>
                    <input 
                      type="number"
                      min="0"
                      value={refillsPerJug}
                      onChange={(e) => {
                        const val = Number(e.target.value || 0);
                        setRefillsPerJug(val);
                        if (currentRefillsLeft > val) setCurrentRefillsLeft(val);
                      }}
                      placeholder="e.g., 7"
                      className="w-full p-1.5 text-xs border border-blue-200 rounded bg-white font-bold text-center"
                    />
                  </div>
                </div>

                {/* EDITABLE ACTIVE JUG LEVEL */}
                {Number(refillsPerJug) > 0 && (
                  <div className="bg-white p-2 rounded border border-blue-200 flex justify-between items-center mt-1">
                    <div>
                      <span className="font-bold text-[11px] text-blue-950 block">💧 Active Open Jug:</span>
                      <span className="text-[10px] text-gray-500">Refills left before next full jug deduction</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input 
                        type="number"
                        min="0"
                        max={refillsPerJug}
                        value={currentRefillsLeft}
                        onChange={(e) => setCurrentRefillsLeft(Math.max(0, Math.min(Number(refillsPerJug), Number(e.target.value || 0))))}
                        className="w-14 p-1 text-xs border border-blue-300 rounded font-bold text-center bg-blue-50/50"
                      />
                      <span className="text-[11px] font-bold text-gray-500">/ {refillsPerJug}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
            <textarea 
              rows={2} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Storage location, dilution ratio, or reorder notes..."
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] bg-white" 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Item Photo</label>
            {imageUrl ? (
              <div className="relative w-full h-36 rounded-lg border border-gray-300 overflow-hidden bg-gray-100 shadow-2xs">
                <img src={imageUrl} alt="Inventory Item" className="w-full h-full object-cover" />
                <button 
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 text-[11px] font-bold rounded shadow-sm hover:bg-red-700 transition">
                  ✕ Remove Photo
                </button>
              </div>
            ) : (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`w-full h-28 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition select-none ${
                  isDragging
                    ? 'border-[#5B7049] bg-[#A9B1A6]/20 ring-2 ring-[#5B7049]/40'
                    : 'border-gray-300 bg-white hover:border-[#A9B1A6] hover:bg-gray-50/70'
                }`}
              >
                <input 
                  ref={fileInputRef}
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processAndUploadFile(e.target.files[0]);
                    }
                  }} 
                  className="hidden" 
                />

                {isUploading ? (
                  <div className="flex flex-col items-center gap-1.5 animate-pulse text-[#5B7049]">
                    <span className="text-2xl">⏳</span>
                    <span className="text-xs font-bold">Compressing & Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-gray-500">
                    <span className="text-2xl">{isDragging ? '📥' : '📷'}</span>
                    <span className="text-xs font-bold text-gray-700">
                      {isDragging ? 'Drop photo to upload' : 'Drag & drop item photo here'}
                    </span>
                    <span className="text-[11px] text-gray-400">or click to browse from device</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 mt-2 border-t border-gray-300">
          {editingItem ? (
            <button type="button" onClick={handleDelete} className="text-xs text-red-600 font-bold hover:underline">
              Delete Item
            </button>
          ) : <div />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded text-xs font-bold text-gray-600 hover:bg-gray-200">
              Cancel
            </button>
            <button 
              type="button" 
              onClick={handleSave} 
              disabled={isSaving || isUploading} 
              className="bg-[#333333] text-white px-6 py-2 rounded text-xs font-bold hover:bg-black transition disabled:opacity-50 shadow-sm"
            >
              {isSaving ? 'Saving...' : 'Save Item'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}