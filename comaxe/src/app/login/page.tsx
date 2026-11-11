'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useI18n } from '@/context/I18nContext';
import { Store, Lock, Mail, User, ArrowRight, Loader2, MapPin, Smartphone, Building2, Globe, Coins } from 'lucide-react';
import { CURRENCIES, getCurrency } from '@/lib/currencies';
import { COUNTRIES } from '@/lib/countries';
import { SearchSelect } from '@/components/common/SearchSelect';
import { BrandLogo } from '@/components/BrandLogo';
import Link from 'next/link';

/**
 * Reprise de flux après connexion (?next=…) : chemin INTERNE uniquement
 * (anti open-redirect : doit commencer par « / » simple, ni « // » ni « /\ »).
 * Absent ou invalide → parcours par défaut (page Tarifs).
 */
function readSafeNextPath(): string {
  try {
    const next = new URLSearchParams(window.location.search).get('next');
    if (next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')) {
      return next;
    }
  } catch {
    /* URL illisible → défaut */
  }
  return '/tarifs';
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resending, setResending] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, resendConfirmation, user } = useAuth();
  const { t } = useI18n();
  const router = useRouter();

  // ── Informations du commerce (demandées à la création du compte) ──
  const [storeName, setStoreName] = useState('');
  const [storeCategory, setStoreCategory] = useState('');
  const [storePhone, setStorePhone] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [country, setCountry] = useState('');
  const [currency, setCurrency] = useState('');

  // Quand le pays change, proposer automatiquement sa devise principale
  useEffect(() => {
    const found = COUNTRIES.find((c) => c.code === country);
    if (found) setCurrency(found.currency);
  }, [country]);

  // Listes en ordre alphabétique (français, insensible aux accents)
  const countryOptions = useMemo(
    () =>
      [...COUNTRIES]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .map((c) => ({
          value: c.code,
          label: c.name,
          leading: c.flag,
          hint: c.continent,
          badge: c.currency,
          keywords: `${c.code} ${c.name} ${c.currency} ${c.continent}`,
        })),
    []
  );

  const currencyOptions = useMemo(
    () =>
      [...CURRENCIES]
        .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }))
        .map((c) => ({
          value: c.code,
          label: c.name,
          leading: (
            <span className="inline-flex items-center justify-center min-w-[2.25rem] h-6 px-1.5 rounded-md bg-slate-100 text-[11px] font-extrabold text-slate-600">
              {c.symbol}
            </span>
          ),
          hint: c.continent,
          badge: c.code,
          keywords: `${c.code} ${c.name} ${c.symbol} ${c.continent}`,
        })),
    []
  );

  // Si déjà connecté, rediriger vers la page Tarifs (choix de l'offre)
  useEffect(() => {
    if (user) {
      router.replace('/tarifs');
    }
  }, [user, router]);

  // Message « Compte créé » : disparition automatique après 5 secondes
  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(''), 5000);
    return () => clearTimeout(timer);
  }, [success]);

  // Erreurs renvoyées par le lien de confirmation email
  // (ex: redirect non autorisé, lien expiré) → affichées sur le formulaire.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const desc = params.get('error_description') || params.get('error_code') || params.get('error');
    if (desc) {
      setError(decodeURIComponent(String(desc).replace(/\+/g, ' ')));
      params.delete('error');
      params.delete('error_description');
      params.delete('error_code');
      const qs = params.toString();
      window.history.replaceState({}, '', qs ? `/login?${qs}` : '/login');
    }
  }, []);

  // Renvoi manuel de l'email de confirmation (si non reçu)
  const handleResendEmail = async () => {
    if (!email || resending) return;
    setResending(true);
    const { error } = await resendConfirmation(email.trim());
    if (error) {
      setError(error.message || t('Une erreur est survenue', 'An error occurred'));
    } else {
      setSuccess(t('Email de confirmation renvoyé ! Vérifiez votre boîte de réception (et vos spams).', 'Confirmation email sent again! Check your inbox (and spam).'));
    }
    setResending(false);
  };

  const inputStyle =
    'w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8] text-sm';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validation explicite : pays et devise sont des menus personnalisés (pas de required natif)
    if (isSignUp && !country) {
      setError(t('Veuillez choisir le pays d’implantation de votre commerce.', 'Please choose the country where your business operates.'));
      return;
    }
    if (isSignUp && !currency) {
      setError(t('Veuillez choisir la devise de votre commerce.', 'Please choose your business currency.'));
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password, firstName, lastName, {
          storeName: storeName.trim(),
          phone: storePhone.trim(),
          address: storeAddress.trim(),
          category: storeCategory.trim() || 'Général',
          currency,
          country,
        });
        if (error) throw error;
        // Parcours imposé : après la création réussie d'un compte → page Tarifs.
        // L'invitation à confirmer l'email est réaffichée en bandeau sur /tarifs
        // (paramètre ?created=1) pour ne pas perdre l'instruction.
        setSuccess(t('Compte créé ! Vérifiez votre email pour confirmer votre inscription, puis connectez-vous.', 'Account created! Check your email to confirm your registration, then sign in.'));
        router.replace('/tarifs?created=1');
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        // Reprise du flux (?next=… ex. /tarifs?plan=pro) ou parcours par
        // défaut : page Tarifs. replace (et non push) : évite de revenir
        // sur /login avec le bouton retour.
        router.replace(readSafeNextPath());
      }
    } catch (err: any) {
      const raw = String(err?.message || '');
      // Messages d'erreur en clair (jamais le texte brut de l'API)
      if (raw.includes('Invalid login credentials')) {
        setError(t('Email ou mot de passe erroné.', 'Invalid email or password.'));
      } else if (raw.includes('Email not confirmed')) {
        setError(t('Email non confirmé. Vérifiez votre boîte de réception (et vos spams).', 'Email not confirmed. Check your inbox (and spam).'));
      } else if (raw.toLowerCase().includes('rate limit') || raw.includes('security purposes')) {
        setError(t('Trop de tentatives répétées. Patientez une minute puis réessayez.', 'Too many attempts. Wait a minute and try again.'));
      } else if (raw.toLowerCase().includes('invalid format') || raw.toLowerCase().includes('invalid email')) {
        setError(t('Email ou mot de passe erroné.', 'Invalid email or password.'));
      } else {
        setError(raw || t('Une erreur est survenue', 'An error occurred'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center p-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo officiel COMAXE : logo C (thème clair) / logo S (thème sombre).
            Clic → retour à la landing page (accueil public COMAXE) */}
        <div className="text-center mb-8">
          <Link
            href="/"
            aria-label={t('Retour à la page d’accueil', 'Back to home page')}
            className="inline-flex flex-col items-center group"
          >
            <span className="inline-flex mb-4 transition-transform group-hover:scale-105">
              <BrandLogo size={72} />
            </span>
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">COMAXE</h1>
            <p className="text-slate-500 mt-2">{t('Gestion commerciale simplifiée', 'Simplified business management')}</p>
          </Link>
        </div>

        {/* Formulaire */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
          <h2 className="text-xl font-bold text-slate-900 mb-6">
            {isSignUp ? t('Créer un compte', 'Create an account') : t('Connexion', 'Sign in')}
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm space-y-1.5">
              <p>{success}</p>
              <button
                type="button"
                onClick={handleResendEmail}
                disabled={resending}
                className="underline font-semibold hover:text-emerald-700 disabled:opacity-60"
              >
                {resending
                  ? t('Renvoi en cours...', 'Sending...')
                  : t("Renvoyer l'email de confirmation", 'Resend the confirmation email')}
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <>
                {/* Identité du responsable */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Prénom', 'First name')}</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                        placeholder="Patrick"
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Nom', 'Last name')}</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                        placeholder="Ilunga"
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                {/* Séparateur : Informations du commerce */}
                <div className="pt-2 pb-1 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                    <Store size={14} />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{t('Informations du commerce', 'Business information')}</span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('Nom commercial de la boutique *', 'Store trade name *')}</label>
                  <div className="relative">
                    <Store size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      required
                      placeholder={t('Ma Boutique', 'My Store')}
                      className={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Téléphone du commerce *', 'Business phone *')}</label>
                    <div className="relative">
                      <Smartphone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="tel"
                        value={storePhone}
                        onChange={(e) => setStorePhone(e.target.value)}
                        required
                        placeholder="+243 000 000 000"
                        className={inputStyle}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{t('Catégorie d’activité', 'Business category')}</label>
                    <div className="relative">
                      <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={storeCategory}
                        onChange={(e) => setStoreCategory(e.target.value)}
                        placeholder={t('Électronique, Alimentation…', 'Electronics, Food…')}
                        className={inputStyle}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('Adresse du commerce', 'Business address')}</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={storeAddress}
                      onChange={(e) => setStoreAddress(e.target.value)}
                      placeholder="Av. de la Justice, Kinshasa"
                      className={inputStyle}
                    />
                  </div>
                </div>

                {/* Implantation : Pays & Devise — listes alphabétiques, recherche intégrée */}
                <div className="pt-2 pb-1 flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                    <Globe size={14} />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{t('Pays & devise', 'Country & currency')}</span>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    {t('Obligatoire', 'Required')}
                  </span>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('Pays *', 'Country *')}</label>
                  <SearchSelect
                    options={countryOptions}
                    value={country}
                    onChange={setCountry}
                    placeholder={t('Rechercher votre pays…', 'Search your country…')}
                    aria-label={t('Pays', 'Country')}
                    icon={<Globe size={16} />}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">{t('Devise *', 'Currency *')}</label>
                  <SearchSelect
                    options={currencyOptions}
                    value={currency}
                    onChange={setCurrency}
                    placeholder={t('Rechercher votre devise…', 'Search your currency…')}
                    aria-label={t('Devise', 'Currency')}
                    icon={<Coins size={16} />}
                  />
                </div>

                {currency && (
                  <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50/60 border border-blue-100">
                    <Coins size={14} className="text-[#1E5BF8] shrink-0 mt-0.5" />
                    <p className="text-xs text-slate-600 leading-relaxed">
                      <strong className="text-[#1E5BF8] font-bold">
                        {t('Aperçu : 1 000 {sym}', 'Preview: 1 000 {sym}', { sym: getCurrency(currency)?.symbol ?? '' })}
                      </strong>{' '}
                      {t("— tous les montants du site (ventes, stock, bénéfice) s'afficheront dans cette devise.", '— all site amounts (sales, inventory, profit) will be shown in this currency.')}
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder={t('vous@exemple.com', 'you@example.com')}
                  className={inputStyle}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{t('Mot de passe', 'Password')}</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className={inputStyle}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E5BF8] hover:bg-[#1548CF] text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>{t('Chargement...', 'Loading...')}</span>
                </>
              ) : (
                <>
                  <span>{isSignUp ? t('Créer mon compte', 'Create my account') : t('Se connecter', 'Sign in')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccess(''); }}
              className="text-sm text-[#1E5BF8] hover:underline font-medium"
            >
              {isSignUp ? t('Déjà un compte ? Se connecter', 'Already have an account? Sign in') : t("Pas de compte ? S'inscrire", 'No account? Sign up')}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          © 2026 COMAXE — {t('Tous droits réservés', 'All rights reserved')}
        </p>
      </div>
    </div>
  );
}
