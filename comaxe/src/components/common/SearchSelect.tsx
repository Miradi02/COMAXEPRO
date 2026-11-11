'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, Search, SearchX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/context/I18nContext';

export interface SearchSelectOption {
  /** Valeur stockée (code ISO…) */
  value: string;
  /** Libellé principal affiché */
  label: string;
  /** Élément visuel à gauche (drapeau emoji, pastille symbole…) */
  leading?: React.ReactNode;
  /** Seconde ligne discrète (continent…) */
  hint?: string;
  /** Pastille à droite (code devise…) */
  badge?: string;
  /** Termes additionnels indexés par la recherche (code ISO, synonymes) */
  keywords?: string;
}

interface SearchSelectProps {
  options: SearchSelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Texte affiché tant qu'aucune sélection */
  placeholder?: string;
  /** Icône de repli dans le déclencheur */
  icon?: React.ReactNode;
  'aria-label'?: string;
}

/** Recherche insensible à la casse et aux accents (« cote d ivoire » → « Côte d'Ivoire ») */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Liste déroulante recherchable (pays, devises…).
 * Déclencheur aligné sur les inputs du formulaire (py-2.5, rounded-xl, ring bleu),
 * panneau animé avec recherche collante et état vide soigné.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  icon,
  'aria-label': ariaLabel,
}: SearchSelectProps) {
  const { t } = useI18n();
  const resolvedPlaceholder = placeholder ?? t('Choisir…', 'Choose…');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);

  // Fermeture au clic à l'extérieur
  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  // À l'ouverture : recherche vidée et focusée
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const timer = setTimeout(() => searchRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [open]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) =>
      normalize(`${o.label} ${o.hint ?? ''} ${o.badge ?? ''} ${o.keywords ?? ''}`).includes(q)
    );
  }, [options, query]);

  const selectOption = (opt: SearchSelectOption) => {
    onChange(opt.value);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* ── Déclencheur ── */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          'w-full flex items-center gap-2.5 pl-3.5 pr-3 py-2.5 rounded-xl border bg-white text-sm text-left transition-all',
          'focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]',
          open
            ? 'border-[#1E5BF8] ring-2 ring-[#1E5BF8]/20'
            : 'border-slate-200 hover:border-slate-300'
        )}
      >
        {selected ? (
          <>
            {selected.leading && (
              <span className="shrink-0 flex items-center justify-center text-base leading-none">
                {selected.leading}
              </span>
            )}
            <span className="flex-1 min-w-0 truncate font-semibold text-slate-900">
              {selected.label}
            </span>
            {selected.badge && (
              <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-[#1E5BF8] border border-blue-100">
                {selected.badge}
              </span>
            )}
          </>
        ) : (
          <>
            {icon && <span className="shrink-0 text-slate-400">{icon}</span>}
            <span className="flex-1 text-slate-400">{resolvedPlaceholder}</span>
          </>
        )}
        <ChevronDown
          className={cn(
            'w-4 h-4 shrink-0 text-slate-400 transition-transform duration-200',
            open && 'rotate-180 text-[#1E5BF8]'
          )}
        />
      </button>

      {/* ── Panneau ── */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 bg-white rounded-xl border border-slate-200 shadow-xl shadow-slate-900/10 overflow-hidden animate-comaxe-dropdown">
          {/* Recherche collante */}
          <div className="relative border-b border-slate-100 bg-white">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={searchRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setOpen(false);
                if (e.key === 'Enter' && filtered.length > 0) {
                  e.preventDefault();
                  selectOption(filtered[0]);
                }
              }}
              placeholder={t('Rechercher…', 'Search…')}
              className="w-full pl-8 pr-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400 text-slate-800"
            />
          </div>

          {/* Liste */}
          <ul role="listbox" className="max-h-56 overflow-y-auto py-1.5">
            {filtered.length === 0 && (
              <li className="flex flex-col items-center gap-1.5 px-4 py-7 text-center">
                <SearchX className="w-5 h-5 text-slate-300" />
                <p className="text-xs text-slate-400">
                  {query
                    ? t('Aucun résultat pour', 'No results for') +
                      ' «\u00A0' +
                      query +
                      '\u00A0»'
                    : t('Aucun résultat', 'No results')}
                </p>
              </li>
            )}
            {filtered.map((o) => {
              const isSelected = o.value === value;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => selectOption(o)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors',
                      isSelected
                        ? 'bg-blue-50 text-[#1E5BF8]'
                        : 'text-slate-700 hover:bg-slate-50'
                    )}
                  >
                    {o.leading && (
                      <span className="shrink-0 flex items-center justify-center text-base leading-none">
                        {o.leading}
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span
                        className={cn(
                          'block truncate',
                          isSelected ? 'font-bold' : 'font-medium'
                        )}
                      >
                        {o.label}
                      </span>
                      {o.hint && (
                        <span className="block truncate text-[11px] text-slate-400">
                          {o.hint}
                        </span>
                      )}
                    </span>
                    {o.badge && (
                      <span
                        className={cn(
                          'shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-md border',
                          isSelected
                            ? 'bg-white text-[#1E5BF8] border-blue-200'
                            : 'bg-slate-50 text-slate-500 border-slate-200'
                        )}
                      >
                        {o.badge}
                      </span>
                    )}
                    {isSelected && <Check className="w-4 h-4 shrink-0 text-[#1E5BF8]" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
