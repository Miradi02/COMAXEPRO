import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { BillingProvider } from '@/context/BillingContext';
import { InitialDataProvider } from '@/context/InitialDataContext';
import { I18nProvider } from '@/context/I18nContext';
import { PreferencesProvider } from '@/context/PreferencesContext';
import { THEME_INIT_SCRIPT } from '@/lib/prefs';
import { resolveLocale } from '@/lib/i18n';
import type { StoreBusinessProfile } from '@/types';

export async function generateMetadata(): Promise<Metadata> {
  const locale = resolveLocale(headers().get('accept-language'));
  return {
    // Titre unique COMAXE — aucun nom de framework ni de template
    title: {
      default: 'COMAXE',
      template: '%s — COMAXE',
    },
    description:
      locale === 'en'
        ? 'Manage your sales, stock and customers, and track your business performance live with COMAXE.'
        : 'Gérez vos ventes, stock, clients et suivez vos performances commerciales en direct avec COMAXE.',
    // Favicon = logo S (identité COMAXE dans l'onglet du navigateur)
    icons: {
      icon: [
        { url: '/icon.png', type: 'image/png' },
        { url: '/logoS1.png', type: 'image/png' },
      ],
      apple: '/logoS1.png',
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session lue côté serveur (cookies) pour afficher l'utilisateur
  // dès le premier rendu — pas de clignotement du nom dans le menu.
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: () => {}, // les écritures de session sont gérées par le middleware
        remove: () => {},
      },
    }
  );
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Profil boutique lu côté serveur (RLS : ligne du propriétaire uniquement)
  let initialStoreProfile: StoreBusinessProfile | null = null;
  if (session?.user) {
    const { data: storeRow } = await supabase
      .from('store_profiles')
      .select('store_name, phone, email, address, category, currency, country')
      .eq('user_id', session.user.id)
      .maybeSingle();
    if (storeRow) {
      initialStoreProfile = {
        storeName: storeRow.store_name,
        phone: storeRow.phone || '',
        email: storeRow.email || '',
        address: storeRow.address || '',
        category: storeRow.category || 'Général',
        currency: storeRow.currency || 'USD',
        country: storeRow.country || '',
      };
    }
  }

  // Langue du navigateur (Accept-Language) : fr → français, sinon anglais
  const locale = resolveLocale(headers().get('accept-language'));

  return (
    <html lang={locale} className="scroll-smooth">
      <head>
        {/* Applique le thème / la police / la taille choisis AVANT le
            premier rendu : aucun clignotement au chargement. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F8F9FD] text-slate-900 antialiased font-sans">
        <I18nProvider locale={locale}>
          <AuthProvider initialUser={session?.user ?? null}>
            {/* Abonnement dispo partout (landing, /tarifs, /login, (app)) :
                les boutons des offres et la page Abonnement interrogent le
                même moteur, monté UNE seule fois. */}
            <BillingProvider>
              <PreferencesProvider>
                <InitialDataProvider value={{ initialStoreProfile }}>
                  {children}
                </InitialDataProvider>
              </PreferencesProvider>
            </BillingProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
