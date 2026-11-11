'use client';

import React, { useState } from 'react';
import {
  Database,
  Download,
  FileJson,
  HardDrive,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { supabase } from '@/lib/supabase/client';
import { SettingsButton, SettingsLayout, SettingsSection, InfoRow } from '@/components/settings/SettingsLayout';

/** Tables d'opérations effacées (ordre = ordre des suppressions en base) */
const DELETABLE_TABLES = [
  'reports',
  'stock_movements',
  'sales', // cascade → sale_items
  'debts', // cascade → debt_payments, debt_history
  'expenses',
  'products',
  'customers',
] as const;

export default function DonneesPage() {
  const { t } = useI18n();
  const {
    products,
    sales,
    customers,
    expenses,
    debts,
    reports,
    stockMovements,
    userProfile,
    storeProfile,
    requestConfirmation,
  } = useCommerce();

  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  const counts = {
    sales: sales.length,
    products: products.length,
    customers: customers.length,
    expenses: expenses.length,
    debts: debts.length,
    reports: reports.length,
    movements: stockMovements.length,
  };
  const totalRows = Object.values(counts).reduce((a, b) => a + b, 0);

  // ── Export réel : instantané JSON de toutes les données du compte ──
  const handleExport = () => {
    if (exporting) return;
    setExporting(true);
    try {
      const snapshot = {
        format: 'comaxe-export',
        version: 1,
        exportedAt: new Date().toISOString(),
        account: { ...userProfile },
        store: { ...storeProfile },
        sales,
        products,
        customers,
        expenses,
        debts,
        reports,
        stockMovements,
      };
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `comaxe-export-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── Suppression réelle, avec confirmation obligatoire ──
  const handleDeleteAll = () => {
    requestConfirmation({
      title: t('Supprimer toutes les données ?', 'Delete all data?'),
      message: t(
        'Cette action est irréversible. Êtes-vous sûr de vouloir continuer ? Vos ventes, produits, clients, dettes, dépenses et rapports seront définitivement supprimés.',
        'This action is irreversible. Are you sure you want to continue? Your sales, products, customers, debts, expenses and reports will be permanently deleted.'
      ),
      onConfirm: async () => {
        if (deleting) return;
        setDeleting(true);
        try {
          for (const table of DELETABLE_TABLES) {
            const { error } = await supabase
              .from(table)
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw new Error(error.message);
          }
          setDone(true);
          window.setTimeout(() => window.location.reload(), 900);
        } catch {
          alert(
            t(
              'La suppression a échoué. Vos données sont intactes, réessayez plus tard.',
              'Deletion failed. Your data is intact, please try again later.'
            )
          );
        } finally {
          setDeleting(false);
        }
      },
    });
  };

  return (
    <SettingsLayout>
      {/* ── EXPORTER ── */}
      <SettingsSection
        icon={Download}
        title={t('Exporter les données', 'Export data')}
        description={t(
          'Télécharge une copie complète de vos données COMAXE au format JSON.',
          'Downloads a complete copy of your COMAXE data as JSON.'
        )}
        action={
          <span className="text-[11px] font-bold text-slate-500 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
            {totalRows} {t('enregistrements', 'records')}
          </span>
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
          {[
            { label: t('Ventes', 'Sales'), value: counts.sales },
            { label: t('Produits', 'Products'), value: counts.products },
            { label: t('Clients', 'Customers'), value: counts.customers },
            { label: t('Dettes', 'Debts'), value: counts.debts },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-slate-50/60 px-4 py-3">
              <p className="text-lg font-extrabold text-slate-900">{s.value}</p>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <SettingsButton onClick={handleExport} disabled={exporting}>
            <FileJson className="w-4 h-4" />
            {exporting ? t('Préparation…', 'Preparing…') : t('Exporter en JSON', 'Export as JSON')}
          </SettingsButton>
          <span className="text-[11px] text-slate-400">
            {t('Fichier comaxe-export-AAAA-MM-JJ.json', 'File comaxe-export-YYYY-MM-DD.json')}
          </span>
        </div>
      </SettingsSection>

      {/* ── GESTION DES DONNÉES ── */}
      <SettingsSection
        icon={HardDrive}
        title={t('Gestion des données', 'Data management')}
        description={t(
          'Où sont stockées vos données et ce qui compose votre compte.',
          'Where your data lives and what makes up your account.'
        )}
      >
        <div className="max-w-2xl">
          <InfoRow label={t('Ventes', 'Sales')} value={String(counts.sales)} />
          <InfoRow label={t('Produits & stock', 'Products & stock')} value={`${counts.products} · ${counts.movements} ${t('mouvements', 'movements')}`} />
          <InfoRow label={t('Clients', 'Customers')} value={String(counts.customers)} />
          <InfoRow label={t('Dépenses', 'Expenses')} value={String(counts.expenses)} />
          <InfoRow label={t('Dettes', 'Debts')} value={String(counts.debts)} />
          <InfoRow label={t('Rapports enregistrés', 'Saved reports')} value={String(counts.reports)} />
        </div>

        <div className="mt-4 p-3.5 rounded-xl bg-blue-50/60 border border-blue-100 flex items-start gap-2.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-[#1E5BF8] shrink-0 mt-0.5" />
          <p>
            {t(
              'Vos données sont stockées dans votre compte COMAXE et protégées : vous êtes le seul à y accéder.',
              'Your data is stored on your COMAXE account and protected: you are the only one with access to it.'
            )}
          </p>
        </div>
      </SettingsSection>

      {/* ── SUPPRESSION ── */}
      <SettingsSection
        icon={Trash2}
        title={t('Supprimer les données', 'Delete data')}
        description={t(
          'Efface définitivement toutes les opérations commerciales de votre compte.',
          'Permanently erases all business operations from your account.'
        )}
      >
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
          <p className="text-sm font-bold text-rose-700">
            {t(
              'Cette action est irréversible. Êtes-vous sûr de vouloir continuer ?',
              'This action is irreversible. Are you sure you want to continue?'
            )}
          </p>
          <p className="text-xs text-rose-600 leading-relaxed">
            {t(
              'Seront supprimés : ventes, lignes de vente, produits, mouvements de stock, clients, dépenses, dettes, paiements, historique et rapports. Votre compte, votre boutique, vos objectifs et vos préférences sont conservés.',
              'Deleted: sales, sale items, products, stock movements, customers, expenses, debts, payments, history and reports. Your account, store, goals and preferences are kept.'
            )}
          </p>
          <div className="flex flex-wrap gap-3">
            <SettingsButton variant="danger" onClick={handleDeleteAll} disabled={deleting || done}>
              <Trash2 className="w-4 h-4" />
              {deleting
                ? t('Suppression…', 'Deleting…')
                : done
                  ? t('Données supprimées', 'Data deleted')
                  : t('Supprimer toutes les données', 'Delete all data')}
            </SettingsButton>
            <SettingsButton variant="secondary" onClick={handleExport}>
              <Download className="w-4 h-4" />
              {t('Exporter avant de supprimer', 'Export before deleting')}
            </SettingsButton>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        icon={Database}
        title={t('Ce qui n’est jamais supprimé', 'What is never deleted')}
        description={t(
          'Les éléments conservés lors d’une suppression de données.',
          'Items kept when you delete data.'
        )}
      >
        <ul className="space-y-2 text-xs text-slate-600">
          {[
            t('Votre compte et votre identité.', 'Your account and identity.'),
            t('Votre fiche boutique (nom, coordonnées, devise).', 'Your store profile (name, contact details, currency).'),
            t('Vos objectifs commerciaux.', 'Your business goals.'),
            t('Vos préférences d’affichage et de notification.', 'Your display and notification preferences.'),
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </SettingsLayout>
  );
}
