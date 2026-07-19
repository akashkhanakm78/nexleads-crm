'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';

interface Option {
  id: string;
  name: string;
}

interface SearchableDropdownProps {
  options: Option[];
  selectedId: string;
  onChange: (id: string, name?: string) => void;
  placeholder: string;
  emptyLabel?: string;
  required?: boolean;
  allowCustom?: boolean;
  customActionLabel?: string;
}

export default function SearchableDropdown({
  options,
  selectedId,
  onChange,
  placeholder,
  emptyLabel = 'No options found',
  required = false,
  allowCustom = false,
  customActionLabel = 'Create new',
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync input value with selected option
  useEffect(() => {
    const selectedOption = options.find((opt) => opt.id === selectedId);
    if (selectedOption) {
      setInputValue(selectedOption.name);
    } else {
      // If allowCustom is true and selectedId is set, it might be the custom name itself
      if (allowCustom && selectedId) {
        setInputValue(selectedId);
      } else {
        setInputValue('');
      }
    }
    setDebouncedValue('');
  }, [selectedId, options, allowCustom]);

  // Debounce logic: 300ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset input value to match selection if dropdown is closed without selecting
        const selectedOption = options.find((opt) => opt.id === selectedId);
        if (selectedOption) {
          setInputValue(selectedOption.name);
        } else if (allowCustom && selectedId) {
          setInputValue(selectedId);
        } else {
          setInputValue('');
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedId, options, allowCustom]);

  // Filter options based on debounced search query (start filtering after 3 characters)
  const isSearching = debouncedValue.trim().length >= 3;
  const filteredOptions = isSearching
    ? options.filter((opt) =>
        opt.name.toLowerCase().includes(debouncedValue.toLowerCase())
      )
    : options;

  const handleSelect = (option: Option) => {
    onChange(option.id, option.name);
    setInputValue(option.name);
    setIsOpen(false);
  };

  const handleCustomSelect = () => {
    onChange(inputValue, inputValue);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (!isOpen) {
      setIsOpen(true);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setInputValue('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative w-full text-xs">
      <div
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all cursor-pointer relative"
      >
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full bg-transparent focus:outline-none text-slate-700 font-medium pr-6"
          required={required && !selectedId}
        />
        {selectedId ? (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-9 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
          >
            ✕
          </button>
        ) : null}
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 mt-1 max-h-56 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-y-auto divide-y divide-slate-100 custom-scrollbar font-medium">
          {filteredOptions.length === 0 && !allowCustom ? (
            <div className="px-3.5 py-3 text-slate-400 italic text-center">
              {emptyLabel}
            </div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = opt.id === selectedId;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSelect(opt)}
                  className={`w-full px-3.5 py-2.5 text-left hover:bg-slate-50 text-slate-700 transition-colors flex justify-between items-center ${
                    isSelected ? 'bg-primary/5 text-primary font-semibold' : ''
                  }`}
                >
                  <span className="truncate">{opt.name}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
          {inputValue.trim().length > 0 && inputValue.trim().length < 3 && (
            <div className="px-3.5 py-2 text-[10px] text-slate-400 bg-slate-50 font-semibold">
              Type at least 3 characters to search...
            </div>
          )}
          {allowCustom && inputValue.trim() && !options.some((opt) => opt.name.toLowerCase() === inputValue.toLowerCase()) && (
            <button
              type="button"
              onClick={handleCustomSelect}
              className="w-full px-3.5 py-2.5 text-left hover:bg-blue-50 text-primary text-xs flex justify-between items-center font-bold border-t border-slate-100"
            >
              <span>{customActionLabel}: "{inputValue}"</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
