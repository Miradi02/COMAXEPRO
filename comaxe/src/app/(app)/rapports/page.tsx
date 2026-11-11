'use client';

import React, { useMemo, useEffect, useState } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  ShoppingBag,
  Receipt,
  Package,
  TrendingUp,
  Users,
  Wallet,
  CheckCircle2,
  Plus,
  X,
  Trash2,
  FileText,
} from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useI18n } from '@/context/I18nContext';
import { useAppShell } from '@/context/AppShellContext';
import type { ReportType } from '@/types';

type ReportColor = 'blue' | 'emerald' | 'rose' | 'amber' | 'purple' | 'indigo';

interface ReportDef {
  id: ReportType;
  title: string;
  description: string;
  icon: typeof ShoppingBag;
  color: ReportColor;
}

export default function RapportsPage() {
  const {
    sales,
    filteredSales,
    products,
    expenses,
    filteredExpenses,
    customers,
    activeDebtsCount,
    totalDebtRemaining,
    debtRecoveryRate,
    displayDateText,
    totalStockValue,
    totalStockCount,
    formatAmount,
    reports,
    addReport,
    deleteReport,
    requestConfirmation,
  } = useCommerce();
  const { t, locale } = useI18n();
  const { setHeaderAction } = useAppShell();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newReportType, setNewReportType] = useState<ReportType>('rep-sales');
  const [newReportPeriod, setNewReportPeriod] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedFlashId, setSavedFlashId] = useState<string | null>(null);

  const totalSales = useMemo(() => sales.reduce((acc, s) => acc + s.totalAmount, 0), [sales]);
  const totalExpenses = useMemo(() => expenses.reduce((acc, e) => acc + e.amount, 0), [expenses]);
  const totalCOGS = useMemo(() => {
    return sales.reduce((acc, s) => {
      return (
        acc +
        s.items.reduce((iAcc, item) => {
          const prod = products.find(
            (p) =>
              (item.productId && p.id === item.productId) ||
              p.name.toLowerCase() === item.productName.toLowerCase()
          );
          const cost = prod ? prod.purchasePrice : item.purchasePrice || item.unitPrice * 0.7;
          return iAcc + cost * item.quantity;
        }, 0)
      );
    }, 0);
  }, [sales, products]);

  const netProfit = Math.max(0, totalSales - totalCOGS - totalExpenses);
  const netMargin = totalSales > 0 ? Math.round((netProfit / totalSales) * 100) : 0;
  const avgBasket = sales.length > 0 ? Math.round(totalSales / sales.length) : 0;

  const activeDateSales = filteredSales.reduce((acc, s) => acc + s.totalAmount, 0);
  const activeDateExpenses = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Les 7 Rapports Métier Fondamentaux de COMAXE (Règle 27)
  const reportDefs: ReportDef[] = [
    {
      id: 'rep-sales',
      title: t('Rapport des Ventes', 'Sales Report'),
      description: t('Synthèse détaillée des transactions réelles, volumes encaissés et modes de paiement.', 'Detailed summary of real transactions, collected volumes and payment methods.'),
      icon: ShoppingBag,
      color: 'blue',
    },
    {
      id: 'rep-profit',
      title: t('Rapport des Bénéfices & Marges', 'Profit & Margins Report'),
      description: t('Analyse du bénéfice brut et net réalisé après déduction du coût réel des marchandises.', 'Analysis of gross and net profit after deducting the actual cost of goods.'),
      icon: TrendingUp,
      color: 'emerald',
    },
    {
      id: 'rep-expenses',
      title: t('Rapport des Dépenses & Charges', 'Expenses & Costs Report'),
      description: t('Ventilation complète des charges réelles décaissées pour le fonctionnement du commerce.', 'Full breakdown of actual operating costs paid out for the business.'),
      icon: Receipt,
      color: 'rose',
    },
    {
      id: 'rep-stock',
      title: t('Rapport d’Inventaire & Stock', 'Inventory & Stock Report'),
      description: t('État quantitatif des références, valorisation au prix de revient et alertes de seuil.', 'Quantitative status of items, valuation at cost price and threshold alerts.'),
      icon: Package,
      color: 'amber',
    },
    {
      id: 'rep-customers',
      title: t('Rapport d’Activité Clients', 'Customer Activity Report'),
      description: t('Répertoire des acheteurs réels, panier moyen et historique de fidélité.', 'Directory of real buyers, average basket and loyalty history.'),
      icon: Users,
      color: 'purple',
    },
    {
      id: 'rep-debts',
      title: t('Rapport des Dettes & Recouvrement', 'Debts & Collection Report'),
      description: t('Suivi des créances en cours, des règlements partiels et du taux de recouvrement.', 'Tracking of outstanding receivables, partial settlements and collection rate.'),
      icon: Wallet,
      color: 'amber',
    },
    {
      id: 'rep-performance',
      title: t('Rapport Global de Performance', 'Global Performance Report'),
      description: t('Bilan commercial consolidé pour le commerçant permettant de mesurer la rentabilité exacte.', 'Consolidated business statement for the merchant to measure exact profitability.'),
      icon: FileBarChart,
      color: 'indigo',
    },
  ];

  // Période + indicateurs calculés EN TEMPS RÉEL pour chaque type de rapport
  const buildReportContent = (id: ReportType): { periodLabel: string; metrics: string } => {
    switch (id) {
      case 'rep-sales':
        return {
          periodLabel: t('Date active : {d} ({n} ventes)', 'Active date: {d} ({n} sales)', { d: displayDateText, n: filteredSales.length }),
          metrics: t('{a} encaissés • {n} transactions totales', '{a} collected • {n} total transactions', { a: formatAmount(totalSales), n: sales.length }),
        };
      case 'rep-profit':
        return {
          periodLabel: t('Bilan calculé en temps réel', 'Statement calculated in real time'),
          metrics: t('{a} de bénéfice net (marge {m}%)', '{a} net profit (margin {m}%)', { a: formatAmount(netProfit), m: netMargin }),
        };
      case 'rep-expenses':
        return {
          periodLabel: t('Date active : {d} ({a})', 'Active date: {d} ({a})', { d: displayDateText, a: formatAmount(activeDateExpenses) }),
          metrics: t('{a} décaissés • {n} opérations enregistrées', '{a} paid out • {n} recorded operations', { a: formatAmount(totalExpenses), n: expenses.length }),
        };
      case 'rep-stock':
        return {
          periodLabel: t('Stock physique réel actuel', 'Current actual physical stock'),
          metrics: t('{a} immobilisés • {n} articles en rayon', '{a} tied up • {n} items on shelves', { a: formatAmount(totalStockValue), n: totalStockCount }),
        };
      case 'rep-customers':
        return {
          periodLabel: t('Base client complète', 'Complete customer database'),
          metrics: t('{n} clients enregistrés • {a} panier moyen', '{n} registered customers • {a} average basket', { n: customers.length, a: formatAmount(avgBasket) }),
        };
      case 'rep-debts':
        return {
          periodLabel: t('Portefeuille des créances', 'Receivables portfolio'),
          metrics: t('{n} dossiers actifs • {a} à recouvrer ({r}% réglé)', '{n} active records • {a} to collect ({r}% settled)', { n: activeDebtsCount, a: formatAmount(totalDebtRemaining), r: debtRecoveryRate }),
        };
      case 'rep-performance':
      default:
        return {
          periodLabel: t('Synthèse générale COMAXE', 'COMAXE general summary'),
          metrics: t('CA : {a} • Reste en caisse net : {b}', 'Revenue: {a} • Net cash left: {b}', { a: formatAmount(totalSales), b: formatAmount(netProfit) }),
        };
    }
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // --- CTA global « Nouveau Rapport » (en-tête) ---
  useEffect(() => {
    setHeaderAction({
      label: t('Nouveau Rapport', 'New Report'),
      onClick: () => {
        setNewReportPeriod(displayDateText);
        setIsAddModalOpen(true);
      },
    });
    return () => setHeaderAction(null);
  }, [setHeaderAction, t, displayDateText]);

  // --- Génération directe depuis une carte ---
  const handleGenerate = async (def: ReportDef) => {
    const { periodLabel, metrics } = buildReportContent(def.id);
    setSaving(true);
    try {
      await addReport({
        reportType: def.id,
        title: def.title,
        periodLabel,
        metrics,
        description: def.description,
      });
      setSavedFlashId(def.id);
      window.setTimeout(() => setSavedFlashId(null), 2500);
    } finally {
      setSaving(false);
    }
  };

  // --- Création via la modale « Nouveau Rapport » ---
  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    const def = reportDefs.find((d) => d.id === newReportType);
    if (!def) return;
    const { periodLabel, metrics } = buildReportContent(def.id);
    setSaving(true);
    try {
      await addReport({
        reportType: def.id,
        title: def.title,
        periodLabel: newReportPeriod.trim() || periodLabel,
        metrics,
        description: def.description,
      });
      setIsAddModalOpen(false);
      setNewReportPeriod(displayDateText);
    } finally {
      setSaving(false);
    }
  };

  // --- Suppression d'un rapport ---
  const handleDeleteReport = (reportId: string, reportTitle: string) => {
    requestConfirmation({
      title: t('Supprimer le rapport', 'Delete report'),
      message: t(
        'Voulez-vous vraiment supprimer le rapport « {t} » ? Cette action est définitive.',
        'Do you really want to delete the report "{t}"? This action cannot be undone.',
        { t: reportTitle }
      ),
      onConfirm: () => {
        deleteReport(reportId);
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Active Global Date Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-[#1E5BF8]" />
          <span className="text-xs font-semibold text-slate-700">
            {t('Période active globale : ', 'Global active period: ')}<strong className="text-slate-900">📅 {displayDateText}</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold flex-wrap">
          <span>{t('Ventes date active : ', 'Active date sales: ')}<strong className="text-slate-900">{formatAmount(activeDateSales)}</strong></span>
          <span>•</span>
          <span>{t('Dépenses date active : ', 'Active date expenses: ')}<strong className="text-rose-600">{formatAmount(activeDateExpenses)}</strong></span>
        </div>
      </div>

      {/* ===== RAPPORTS ENREGISTRÉS (persistés en base) ===== */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {t('Mes rapports enregistrés', 'My saved reports')}
              </h3>
              <p className="text-[11px] font-semibold text-slate-400">
                {t('{n} rapport(s) conservé(s) dans COMAXE', '{n} report(s) stored in COMAXE', { n: reports.length })}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setNewReportPeriod(displayDateText);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-xs font-bold shadow-md shadow-blue-500/25 active:scale-95 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('Nouveau Rapport', 'New Report')}</span>
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="py-10 text-center">
            <FileBarChart className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-500">
              {t('Aucun rapport enregistré pour le moment.', 'No report saved yet.')}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {t('Cliquez sur « Nouveau Rapport » ou générez-en un depuis les cartes ci-dessous.', 'Click "New Report" or generate one from the cards below.')}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((rep) => {
              const def = reportDefs.find((d) => d.id === rep.reportType);
              const IconComp = def?.icon ?? FileBarChart;
              return (
                <div
                  key={rep.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-xl bg-blue-50 text-[#1E5BF8] shrink-0">
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate">{rep.title}</p>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">{rep.periodLabel}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        <span className="font-bold text-slate-600">{rep.metrics}</span>
                        {rep.createdAt && (
                          <>
                            <span>•</span>
                            <span>{formatDate(rep.createdAt)}</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteReport(rep.id, rep.title)}
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-500 text-[11px] font-bold shadow-xs transition-colors shrink-0"
                    title={t('Supprimer ce rapport', 'Delete this report')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('Supprimer', 'Delete')}</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== LES 7 RAPPORTS FONDAMENTAUX ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {reportDefs.map((rep) => {
          const IconComp = rep.icon;
          const content = buildReportContent(rep.id);
          const isSaved = savedFlashId === rep.id;

          return (
            <div
              key={rep.id}
              className="bg-white rounded-2xl sm:rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between group hover:-translate-y-1 transition-transform duration-200"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-blue-50 text-[#1E5BF8]">
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        {rep.title}
                      </h3>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {content.periodLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-500 leading-relaxed mb-4">
                  {rep.description}
                </p>

                {/* Metrics Pill Badge */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 mb-5">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {content.metrics}
                  </span>
                </div>
              </div>

              {/* Action Button : génère et conserve réellement le rapport */}
              <button
                onClick={() => handleGenerate(rep)}
                disabled={saving}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold shadow-xs transition-colors disabled:opacity-70 disabled:cursor-wait ${
                  isSaved
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t('Rapport enregistré', 'Report saved')}</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{t('Générer & conserver ce rapport', 'Generate & save this report')}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* ===== MODALE : NOUVEAU RAPPORT ===== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-slate-100 relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <FileBarChart className="w-4 h-4" />
                </div>
                <h4 className="text-lg font-bold text-slate-900">
                  {t('Nouveau Rapport', 'New Report')}
                </h4>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                aria-label={t('Fermer', 'Close')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddReport} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Type de rapport *', 'Report type *')}
                </label>
                <select
                  value={newReportType}
                  onChange={(e) => setNewReportType(e.target.value as ReportType)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                >
                  {reportDefs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  {t('Période couverte', 'Covered period')}
                </label>
                <input
                  type="text"
                  value={newReportPeriod}
                  onChange={(e) => setNewReportPeriod(e.target.value)}
                  placeholder={t('ex : Date active du 03/11/2026', 'e.g. Active date of 03/11/2026')}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  {t('Les indicateurs sont calculés en direct depuis vos données COMAXE.', 'Metrics are calculated live from your COMAXE data.')}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  {t('Aperçu des indicateurs', 'Metrics preview')}
                </span>
                <p className="text-xs font-bold text-slate-800 mt-1.5 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  {buildReportContent(newReportType).metrics}
                </p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-bold text-sm shadow-md shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-wait"
              >
                {saving
                  ? t('Enregistrement...', 'Saving...')
                  : t('Enregistrer le rapport dans COMAXE', 'Save the report in COMAXE')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
