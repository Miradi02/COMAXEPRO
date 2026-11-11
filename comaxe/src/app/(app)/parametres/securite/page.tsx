'use client';

import React, { useState } from 'react';
import {
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  MonitorSmartphone,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { supabase } from '@/lib/supabase/client';
import { SettingsButton, SettingsLayout, SettingsSection, InfoRow } from '@/components/settings/SettingsLayout';

const inputStyle =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]';

export default function SecuritePage() {
  const { t } = useI18n();
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const [signingOutOthers, setSigningOutOthers] = useState(false);
  const [othersDone, setOthersDone] = useState(false);

  const email = user?.email ?? '';
  const lastSignIn = user?.last_sign_in_at ? new Date(user.last_sign_in_at) : null;

  const handleChangePassword = async () => {
    if (saving) return;
    setMessage(null);

    if (newPassword.length < 8) {
      setMessage({ ok: false, text: t('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'The new password must be at least 8 characters.') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage({ ok: false, text: t('Les deux mots de passe ne correspondent pas.', 'The two passwords do not match.') });
      return;
    }
    if (!currentPassword) {
      setMessage({ ok: false, text: t('Saisissez votre mot de passe actuel.', 'Enter your current password.') });
      return;
    }

    setSaving(true);
    try {
      // 1. Vérification réelle des identifiants avant toute modification
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        setMessage({ ok: false, text: t('Mot de passe actuel incorrect.', 'Current password is incorrect.') });
        return;
      }

      // 2. Mise à jour du mot de passe (authentification Supabase)
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) {
        setMessage({ ok: false, text: updateError.message || t('Impossible de modifier le mot de passe.', 'Could not change the password.') });
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage({ ok: true, text: t('Mot de passe modifié avec succès.', 'Password changed successfully.') });
    } catch {
      setMessage({ ok: false, text: t('Une erreur est survenue. Réessayez.', 'An error occurred. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOutOthers = async () => {
    if (signingOutOthers) return;
    setSigningOutOthers(true);
    try {
      // Supabase : révoque toutes les sessions SAUF celle-ci
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) throw error;
      setOthersDone(true);
    } catch {
      setOthersDone(false);
    } finally {
      setSigningOutOthers(false);
    }
  };

  return (
    <SettingsLayout>
      {/* ── MODIFIER LE MOT DE PASSE ── */}
      <SettingsSection
        icon={KeyRound}
        title={t('Modifier le mot de passe', 'Change password')}
        description={t(
          'Votre mot de passe actuel est vérifié avant toute modification.',
          'Your current password is verified before any change.'
        )}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">
              {t('Mot de passe actuel', 'Current password')}
            </span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className={inputStyle}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">
              {t('Nouveau mot de passe', 'New password')}
            </span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className={inputStyle}
            />
          </label>
          <label className="block">
            <span className="block text-xs font-bold text-slate-500 mb-1.5">
              {t('Confirmer', 'Confirm')}
            </span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className={inputStyle}
            />
          </label>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <SettingsButton onClick={handleChangePassword} disabled={saving}>
            <Lock className="w-4 h-4" />
            {saving ? t('Vérification…', 'Verifying…') : t('Modifier le mot de passe', 'Change password')}
          </SettingsButton>
          {message && (
            <span className={`text-xs font-bold ${message.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
              {message.text}
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-400 mt-3">
          {t(
            'Minimum 8 caractères. Le mot de passe n’est jamais affiché ni stocké en clair.',
            'At least 8 characters. The password is never shown or stored in plain text.'
          )}
        </p>
      </SettingsSection>

      {/* ── SESSIONS ACTIVES ── */}
      <SettingsSection
        icon={MonitorSmartphone}
        title={t('Sessions actives', 'Active sessions')}
        description={t(
          'Appareils actuellement connectés à votre compte COMAXE.',
          'Devices currently connected to your COMAXE account.'
        )}
      >
        <div className="max-w-2xl">
          <InfoRow label={t('Cet appareil', 'This device')} value={email || '—'} />
          <InfoRow
            label={t('Dernière connexion', 'Last sign-in')}
            value={
              lastSignIn
                ? lastSignIn.toLocaleString(undefined, {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'
            }
          />
          <InfoRow
            label={t('Statut du compte', 'Account status')}
            value={
              user?.email_confirmed_at ? (
                <span className="text-emerald-600">{t('E-mail confirmé', 'Email confirmed')}</span>
              ) : (
                <span className="text-amber-600">{t('E-mail en attente', 'Email pending')}</span>
              )
            }
          />
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-100">
          <div className="flex items-start gap-2.5">
            <Laptop className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500 max-w-md">
              {t(
                'Déconnecte COMAXE sur tous les autres appareils. Cette session reste active.',
                'Signs COMAXE out on every other device. This session stays active.'
              )}
            </p>
          </div>
          <SettingsButton variant="secondary" onClick={handleSignOutOthers} disabled={signingOutOthers}>
            <LogOut className="w-4 h-4" />
            {signingOutOthers
              ? t('Déconnexion…', 'Signing out…')
              : othersDone
                ? t('Autres appareils déconnectés', 'Other devices signed out')
                : t('Déconnecter les autres appareils', 'Sign out other devices')}
          </SettingsButton>
        </div>
      </SettingsSection>

      {/* ── BONNES PRATIQUES ── */}
      <SettingsSection
        icon={ShieldCheck}
        title={t('Bonnes pratiques', 'Good practices')}
        description={t(
          'Recommandations pour garder un compte COMAXE sécurisé.',
          'Recommendations to keep your COMAXE account secure.'
        )}
      >
        <ul className="space-y-2 text-xs text-slate-600">
          {[
            t('Utilisez un mot de passe d’au moins 8 caractères, unique à COMAXE.', 'Use a password of at least 8 characters, unique to COMAXE.'),
            t('Ne partagez jamais vos identifiants de connexion.', 'Never share your sign-in credentials.'),
            t('Déconnectez les appareils que vous ne reconnaissez pas.', 'Sign out any device you do not recognise.'),
            t('Changez votre mot de passe si vous pensez qu’il a été compromis.', 'Change your password if you think it has been compromised.'),
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
