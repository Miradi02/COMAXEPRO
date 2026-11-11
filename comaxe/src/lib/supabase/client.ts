'use client';

import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Client navigateur Supabase (SSR-compatible).
// CRUCIAL : utilise createBrowserClient de @supabase/ssr pour stocker la session
// dans les COOKIES (et non localStorage), afin que le middleware puisse la lire
// et protéger les routes côté serveur.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
