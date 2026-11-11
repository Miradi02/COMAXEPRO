'use client';

import React, { useState } from 'react';
import {
  BadgeCheck,
  Coins,
  LogOut,
  Mail,
  Save,
  Store,
  Trash2,
  UserRound,
} from 'lucide-react';
import { useCommerce } from '@/context/CommerceContext';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { supabase } from '@/lib/supabase/client';
import { getCurrency } from '@/lib/currencies';
import { SettingsButton, SettingsLayout, SettingsSection, InfoRow } from '@/components/settings/SettingsLayout';

export default function ComptePage() {
  const { t, locale } = useI18n();
  const { userProfile, storeProfile, updateStoreProfile } = useCommerce();
  const { user, signOut } = useAuth();

  // Identité commerciale éditable (champ réellement enregistré en base)
  const [storeName, setStoreName] = useState(storeProfile.storeName);
  const [phone, setPhone] = useState(storeProfile.phone);
  const [address, setAddress] = useState(storeProfile.address);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [loggingOut, setLoggingOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deleting, setDeleting] = useState(false);

  const dirty =
    storeName !== storeProfile.storeName ||
    phone !== storeProfile.phone ||
    address !== storeProfile.address;

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await updateStoreProfile({ storeName, phone, address });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2200);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      window.location.assign('/login');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleting || deleteInput.trim().toUpperCase() !== 'SUPPRIMER') return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc('delete_my_account');
      if (error) throw new Error(error.message);
    } catch (e) {
      setDeleting(false);
      alert(t("La suppression du compte a échoué. Réessayez plus tard.", 'Account deletion failed. Please try again later.'));
      return;
    }
    // Purge locale puis redirection : la session n'existe plus en base
    window.location.assign('/login');
  };

  const emailConfirmed = Boolean(user?.email_confirmed_at);
  const currency = getCurrency(storeProfile.currency);
  const createdAt = user?.created_at ? new Date(user.created_at) : null;
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;

  const formatDate = (d: Date | null) =>
    d
      ? d.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        })
      : '—';

  return (
    <SettingsLayout>
      {/* ── IDENTITÉ DU COMPTE ── */}
      <SettingsSection
        icon={UserRound}
        title={t('Identité du compte', 'Account identity')}
        description={t(
          "Informations liées à votre compte COMAXE. Les données d'authentification sont protégées et restent en lecture seule.",
          'Information linked to your COMAXE account. Authentication data is protected and stays read-only.'
        )}
        action={
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
            <BadgeCheck className="w-3.5 h-3.5" />
            {t('Compte vérifié', 'Verified account')}
          </span>
        }
      >
        <div className="max-w-2xl">
          <InfoRow label={t('Prénom', 'First name')} value={userProfile.firstName || '—'} />
          <InfoRow label={t('Nom', 'Last name')} value={userProfile.lastName || '—'} />
          <InfoRow
            label={t('Adresse e-mail', 'Email address')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                {userProfile.email}
              </span>
            }
          />
          <InfoRow label={t('Rôle', 'Role')} value={userProfile.role} />
          <InfoRow
            label={t('Devise d’affichage', 'Display currency')}
            value={
              <span className="inline-flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-slate-400" />
                {`${currency?.code ?? 'USD'} · ${currency?.symbol ?? '$'} — ${currency?.name ?? 'US Dollar'}`}
              </span>
            }
          />
          <InfoRow
            label={t('Statut du compte', 'Account status')}
            value={
              emailConfirmed ? (
                <span className="text-emerald-600">{t('E-mail confirmé', 'Email confirmed')}</span>
              ) : (
                <span className="text-amber-600">{t('E-mail en attente de confirmation', 'Email pending confirmation')}</span>
              )
            }
          />
          <InfoRow label={t('Compte créé le', 'Account created on')} value={formatDate(createdAt)} />
          <InfoRow label={t('Dernière connexion', 'Last sign-in')} value={formatDate(lastSignIn)} />
        </div>
      </SettingsSection>

      {/* ── IDENTITÉ DU COMMERCE ── */}
      <SettingsSection
        icon={Store}
        title={t('Identité du commerce', 'Business identity')}
        description={t(
          'Le nom et les coordonnées de votre boutique, visibles dans COMAXE.',
          'Your store name and contact details, shown across COMAXE.'
        )}
        action={
          <span className="text-[11px] font-bold text-slate-400 px-2 py-1 rounded-lg bg-slate-100 border border-slate-200 shrink-0">
            {userProfile.email}
          </span>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
          <label className="block sm:col-span-2">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">
              {t('Nom commercial', 'Trade name')}
            </span>
            <input
              type="text"
              value={storeName}
              onChange={(e) => setStoreName(e.target.value)}
              maxLength={80}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t('Téléphone', 'Phone')}</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={40}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">{t('Adresse', 'Address')}</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={120}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
            />
          </label>
        </div>

        {(dirty || saved) && (
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            <SettingsButton onClick={handleSave} disabled={saving || !dirty}>
              <Save className={`w-4 h-4 ${saving ? 'animate-pulse' : ''}`} />
              {saving
                ? t('Enregistrement…', 'Saving…')
                : saved
                  ? t('Enregistré', 'Saved')
                  : t('Enregistrer', 'Save')}
            </SettingsButton>
            {saved && (
              <span className="text-xs font-bold text-emerald-600">
                {t('Mise à jour enregistrée en base', 'Update stored')}
              </span>
            )}
          </div>
        )}
      </SettingsSection>

      {/* ── SESSION ── */}
      <SettingsSection
        icon={LogOut}
        title={t('Session', 'Session')}
        description={t(
          'Fermez la session en cours sur cet appareil.',
          'Close the current session on this device.'
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <p className="text-xs text-slate-500 max-w-md">
            {t(
              'La déconnexion purge immédiatement les données locales et vous ramène à la page de connexion.',
              'Signing out immediately clears local data and returns you to the sign-in page.'
            )}
          </p>
          <SettingsButton variant="danger" onClick={handleLogout} disabled={loggingOut}>
            <LogOut className={`w-4 h-4 ${loggingOut ? 'animate-spin' : ''}`} />
            {loggingOut ? t('Déconnexion…', 'Signing out…') : t('Se déconnecter', 'Sign out')}
          </SettingsButton>
        </div>
      </SettingsSection>

      {/* ── SUPPRESSION DU COMPTE ── */}
      <SettingsSection
        icon={Trash2}
        title={t('Supprimer le compte', 'Delete account')}
        description={t(
          'Supprime définitivement votre compte et toutes les données commerciales associées.',
          'Permanently deletes your account and all associated business data.'
        )}
      >
        {!confirmDelete ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <p className="text-xs text-slate-500 max-w-md">
              {t(
                'Ventes, stock, clients, dettes, dépenses, objectifs et rapports seront supprimés sans possibilité de récupération.',
                'Sales, stock, customers, debts, expenses, goals and reports will be deleted with no recovery.'
              )}
            </p>
            <SettingsButton variant="secondary" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" />
              {t('Supprimer mon compte', 'Delete my account')}
            </SettingsButton>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 space-y-3">
            <p className="text-sm font-bold text-rose-700">
              {t(
                'Cette action est irréversible. Êtes-vous sûr de vouloir continuer ?',
                'This action is irreversible. Are you sure you want to continue?'
              )}
            </p>
            <p className="text-xs text-rose-600">
              {t(
                'Pour confirmer, tapez SUPPRIMER dans le champ ci-dessous.',
                'To confirm, type SUPPRIMER in the field below.'
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="SUPPRIMER"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-rose-300 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500/30"
              />
              <div className="flex gap-2">
                <SettingsButton
                  variant="danger"
                  onClick={handleDeleteAccount}
                  disabled={deleting || deleteInput.trim().toUpperCase() !== 'SUPPRIMER'}
                >
                  {deleting ? t('Suppression…', 'Deleting…') : t('Supprimer définitivement', 'Delete permanently')}
                </SettingsButton>
                <SettingsButton
                  variant="secondary"
                  onClick={() => {
                    setConfirmDelete(false);
                    setDeleteInput('');
                  }}
                >
                  {t('Annuler', 'Cancel')}
                </SettingsButton>
              </div>
            </div>
          </div>
        )}
      </SettingsSection>
    </SettingsLayout>
  );
}
