// src/components/InventoryItemModal.tsx
// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { compressImage } from '../utils';

export default function InventoryItemModal({ isOpen, onClose, editingItem, activeCompanies, refreshInventory }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [company, setCompany] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef(null);

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
      setQuantity(editingItem.quantity || 0);
      setImageUrl(editingItem.image_url || '');
    } else {
      setName('');
      setDescription('');
      setCompany(activeCompanies[0] || '');
      setQuantity(0);
      setImageUrl('');
    }
    setIsDragging(false);
  }, [editingItem, activeCompanies, isOpen]);

  if (!isOpen) return null;

  const processAndUploadFile = async (file) => {
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      return alert('Please upload an image file (PNG, JPG, WEBP, etc.).');
    }

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
    const payload = {
      name: name.trim(),
      description: description.trim(),
      company,
      quantity: Number(quantity),
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
        className="bg-[#F4F3ED] max-w-md w-full rounded-lg shadow-2xl p-6 flex flex-col gap-4 animate-fade-in"
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
              placeholder="e.g., Heavy Duty Filter Cartridge"
              className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] bg-white" 
            />
          </div>

          <div className="flex gap-3">
            <div className="w-2/3">
              <label className="block text-xs font-bold text-gray-700 mb-1">Company</label>
              <select 
                value={company} 
                onChange={(e) => setCompany(e.target.value)} 
                className="w-full p-2 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-[#A9B1A6]">
                {activeCompanies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-1/3">
              <label className="block text-xs font-bold text-gray-700 mb-1">Quantity</label>
              <input 
                type="number" 
                value={quantity} 
                onChange={(e) => setQuantity(e.target.value)} 
                className="w-full p-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#A9B1A6] text-center font-bold bg-white" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Description (Optional)</label>
            <textarea 
              rows={2} 
              value={description} 
              onChange={(e) => setDescription(e.target.value)} 
              placeholder="Storage location, specs, or reorder notes..."
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
                className={`w-full h-32 rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-3 text-center cursor-pointer transition select-none ${
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