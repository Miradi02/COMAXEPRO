'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/context/I18nContext';

/**
 * Gabarit commun des pages de configuration (sous-branches de /parametres) :
 * lien de retour + largeur cohérente. Le titre de page est géré par le
 * Header global via ROUTE_INFO.
 */
export function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="space-y-6 max-w-[1100px]">
      <Link
        href="/parametres"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-[#1E5BF8] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        {t('Tous les paramètres', 'All settings')}
      </Link>
      {children}
    </div>
  );
}

/**
 * Carte de section : icône dans la boîte bleue du design system,
 * titre, description courte, puis le contenu.
 */
export function SettingsSection({
  icon: Icon,
  title,
  description,
  action,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Élément aligné à droite de l'en-tête (badge, lien…) */
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0">
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-slate-900">{title}</h3>
            {description && (
              <p className="text-xs text-slate-500 mt-0.5">{description}</p>
            )}
          </div>
        </div>
        {action}
      </div>
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

/** Ligne d'information libellé → valeur (lecture seule) */
export function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 border-b border-slate-100 last:border-0">
      <span className="text-xs font-bold text-slate-500 sm:w-56 shrink-0">{label}</span>
      <span className="text-sm font-semibold text-slate-800 break-words">{value}</span>
    </div>
  );
}

/** Bouton d'action standard des pages de configuration */
export function SettingsButton({
  onClick,
  children,
  variant = 'primary',
  disabled = false,
  type = 'button',
}: {
  onClick?: () => void;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
}) {
  const styles = {
    primary: 'bg-[#1E5BF8] hover:bg-[#1548CF] text-white shadow-md shadow-blue-500/25',
    secondary:
      'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/25',
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  );
}
