'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  HeartHandshake,
  Loader2,
  Sparkles,
  Target,
} from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { useAuth } from '@/context/AuthContext';
import { formatUSD } from '@/lib/utils';

/* ─────────────────────────────────────────────────────────────
   PAGE ONBOARDING COMAXE — questionnaire d'accueil
   Parcours imposé : Inscription → /onboarding (6 étapes) → Tarifs.

   - Progression « Étape N sur 5 » (étape 6 = Résumé).
   - Réponses persistées : user_metadata via /api/onboarding
     (secours localStorage si hors connexion).
   - Les objectifs renseignés sont écrits dans la table `goals`
     EXISTANTE (page Objectifs) — jamais de valeur inventée.
   - Comptes SANS la clé `onboarding_completed` (créés avant
     l'onboarding) : redirigés vers /tarifs, jamais de questionnaire.
   Textes en français exacts de la spec (spec-q3.txt).
   ───────────────────────────────────────────────────────────── */

const STORAGE_KEY = 'comaxe_onboarding_state';

type Phase = 'intro' | 'questions' | 'summary';
type Answer = string | string[];
type Answers = Record<string, Answer>;

interface Objectives {
  sales: string;
  profit: string;
  pieces: string;
  annual: string;
  ceiling: string;
  expenses: string;
}

const EMPTY_OBJECTIVES: Objectives = {
  sales: '',
  profit: '',
  pieces: '',
  annual: '',
  ceiling: '',
  expenses: '',
};

interface QuestionDef {
  id: string;
  title: string;
  type: 'single' | 'multi';
  options: string[];
  /** Champ texte « Autre » à côté de l'option */
  other?: boolean;
  hint?: string;
  /** Message d'empathie COURT selon la réponse (clé exacte ou '*' = défaut) */
  empathy?: Record<string, string>;
}

interface StepDef {
  title: string;
  questions: QuestionDef[];
}

/* ── Étapes 1 à 4 : questions à choix (Étape 5 = objectifs) ── */
const STEPS: StepDef[] = [
  {
    title: 'Votre commerce',
    questions: [
      {
        id: 'q1',
        title: 'Quel type de commerce gérez-vous ?',
        type: 'single',
        other: true,
        options: [
          'Boutique',
          'Alimentation',
          'Mode / vêtements',
          'Électronique',
          'Produits cosmétiques',
          'Pharmacie / produits de santé',
          'Restaurant / alimentation préparée',
          'Autre',
        ],
        empathy: {
          '*': 'Très bien. Nous allons adapter votre expérience au fonctionnement de votre commerce.',
        },
      },
      {
        id: 'q2',
        title: 'Depuis combien de temps gérez-vous ce commerce ?',
        type: 'single',
        options: ['Moins de 6 mois', '6 mois à 1 an', '1 à 3 ans', '3 à 5 ans', 'Plus de 5 ans'],
        empathy: {
          'Moins de 6 mois':
            'Vous êtes encore au début de votre aventure. C’est justement le bon moment pour mettre en place de bonnes habitudes de suivi.',
          '1 à 3 ans':
            'Vous avez déjà de l’expérience. COMAXE peut vous aider à mieux exploiter les données de votre commerce.',
          '3 à 5 ans':
            'Vous avez déjà de l’expérience. COMAXE peut vous aider à mieux exploiter les données de votre commerce.',
          'Plus de 5 ans':
            'Vous avez déjà de l’expérience. COMAXE peut vous aider à mieux exploiter les données de votre commerce.',
        },
      },
      {
        id: 'q3',
        title: 'Gérez-vous votre commerce seul ou avec une équipe ?',
        type: 'single',
        options: [
          'Seul',
          'Avec 1 à 2 personnes',
          'Avec 3 à 5 personnes',
          'Avec plus de 5 personnes',
        ],
      },
      {
        id: 'q4',
        title: 'Environ combien de produits différents vendez-vous ?',
        type: 'single',
        options: ['Moins de 10', '10 à 50', '51 à 100', 'Plus de 100'],
      },
    ],
  },
  {
    title: 'Votre situation actuelle',
    questions: [
      {
        id: 'q5',
        title: 'Comment évoluent vos ventes actuellement ?',
        type: 'single',
        options: ['Elles augmentent', 'Elles restent stables', 'Elles diminuent', 'Je ne sais pas vraiment'],
        empathy: {
          'Elles augmentent':
            'C’est une bonne dynamique. L’objectif maintenant est de comprendre ce qui fonctionne et de continuer à progresser.',
          'Elles restent stables':
            'La stabilité est déjà une base intéressante. COMAXE pourra vous aider à identifier les leviers qui peuvent vous faire progresser.',
          'Elles diminuent':
            'Nous comprenons. Une baisse des ventes peut avoir plusieurs causes. Le suivi régulier vous aidera à mieux identifier ce qui change dans votre commerce.',
          'Je ne sais pas vraiment':
            'Ce n’est pas grave. Beaucoup de commerçants ont du mal à voir clairement leur évolution sans un suivi régulier. COMAXE est justement là pour vous aider à la visualiser.',
        },
      },
      {
        id: 'q6',
        title: 'Savez-vous combien votre commerce vous rapporte réellement ?',
        type: 'single',
        options: ['Oui, précisément', 'J’ai une estimation', 'Pas vraiment', 'Je ne sais pas'],
        empathy: {
          'Pas vraiment':
            'Vous n’êtes pas seul. Beaucoup de commerçants connaissent leurs ventes sans connaître précisément leur bénéfice. COMAXE vous aidera à mieux distinguer ventes, dépenses et bénéfice.',
          'Je ne sais pas':
            'Vous n’êtes pas seul. Beaucoup de commerçants connaissent leurs ventes sans connaître précisément leur bénéfice. COMAXE vous aidera à mieux distinguer ventes, dépenses et bénéfice.',
        },
      },
      {
        id: 'q7',
        title: 'Quand avez-vous besoin de savoir si votre commerce est rentable, comment faites-vous actuellement ?',
        type: 'single',
        options: [
          'Je fais mes calculs moi-même',
          'J’utilise un cahier',
          'J’utilise Excel / une autre application',
          'Je me base surtout sur mon argent disponible',
          'Je ne le calcule pas régulièrement',
        ],
        empathy: {
          'Je fais mes calculs moi-même':
            'Cela prend du temps. COMAXE calculera votre bénéfice automatiquement, à partir de vos ventes et dépenses.',
          'J’utilise un cahier':
            'Le cahier suit déjà vos chiffres. COMAXE les affichera toujours à jour, sans ressaisie.',
          'J’utilise Excel / une autre application':
            'Vous avez déjà une méthode. COMAXE la rendra plus rapide et toujours à jour.',
          'Je me base surtout sur mon argent disponible':
            'Beaucoup de commerçants procèdent ainsi. COMAXE vous aidera à distinguer ce qui vous appartient réellement.',
          'Je ne le calcule pas régulièrement':
            'Ce n’est pas grave. COMAXE fera ce suivi pour vous, sans effort de votre part.',
        },
      },
      {
        id: 'q8',
        title: 'Connaissez-vous vos produits les plus rentables ?',
        type: 'single',
        options: ['Oui', 'Quelques-uns', 'Non'],
        empathy: {
          Non: 'Pas de problème. COMAXE pourra vous aider à voir quels produits contribuent le plus à votre bénéfice.',
        },
      },
      {
        id: 'q9',
        title: 'Comment suivez-vous actuellement vos dépenses ?',
        type: 'single',
        options: [
          'Je les note régulièrement',
          'Je les note parfois',
          'Je garde les informations en tête',
          'Je ne les suis pas vraiment',
        ],
        empathy: {
          'Je garde les informations en tête':
            'C’est déjà un réflexe. COMAXE les affichera clairement pour ne rien oublier.',
          'Je ne les suis pas vraiment':
            'Nous comprenons. COMAXE centralisera vos dépenses pour y voir clair.',
        },
      },
    ],
  },
  {
    title: 'Vos difficultés',
    questions: [
      {
        id: 'q10',
        title: 'Quelle est votre plus grande difficulté aujourd’hui ?',
        type: 'multi',
        hint: 'Plusieurs choix possibles',
        other: true,
        options: [
          'Suivre mes ventes',
          'Gérer mon stock',
          'Connaître mon bénéfice réel',
          'Contrôler mes dépenses',
          'Suivre les dettes',
          'Fixer des objectifs',
          'Savoir quels produits marchent le mieux',
          'Suivre mes clients',
          'Comprendre l’évolution de mon commerce',
          'Autre',
        ],
        empathy: {
          'Suivre mes ventes':
            'Suivre ses ventes régulièrement, c’est déjà mieux piloter. COMAXE les affichera clairement pour vous.',
          'Gérer mon stock':
            'Le stock peut vite devenir difficile à suivre manuellement. COMAXE vous aidera à garder une meilleure visibilité sur vos produits.',
          'Connaître mon bénéfice réel':
            'C’est une information essentielle pour prendre de bonnes décisions. COMAXE vous aidera à mieux suivre votre bénéfice réel.',
          'Contrôler mes dépenses':
            'Garder la main sur ses dépenses, c’est protéger son bénéfice. COMAXE vous aidera à les suivre facilement.',
          'Suivre les dettes':
            'Les dettes peuvent peser. Suivre les dettes clairement, c’est déjà commencer à les maîtriser.',
          'Fixer des objectifs':
            'Avoir un objectif clair donne une direction au commerce. Nous allons justement vous aider à en définir.',
          'Savoir quels produits marchent le mieux':
            'Savoir quels produits marchent le mieux oriente vos décisions. COMAXE vous aidera à les identifier.',
          'Suivre mes clients':
            'Connaître vos clients fidélise votre commerce. COMAXE vous aidera à mieux les suivre.',
          'Comprendre l’évolution de mon commerce':
            'Comprendre l’évolution de son commerce, c’est exactement le rôle de COMAXE. Nous allons vous y aider.',
          '*': 'Très bien. Nous en tenons compte pour personnaliser votre expérience avec COMAXE.',
        },
      },
      {
        id: 'q11',
        title: 'Qu’aimeriez-vous principalement améliorer grâce à COMAXE ?',
        type: 'single',
        options: [
          'Augmenter mes ventes',
          'Augmenter mon bénéfice',
          'Réduire mes dépenses',
          'Mieux gérer mon stock',
          'Mieux suivre mes dettes',
          'Mieux comprendre mon commerce',
          'Atteindre mes objectifs',
          'Tout cela',
        ],
      },
    ],
  },
  {
    title: 'Votre vision',
    questions: [
      {
        id: 'q12',
        title: 'Si votre commerce évolue comme vous le souhaitez, où aimeriez-vous être dans les prochains mois ?',
        type: 'single',
        other: true,
        options: [
          'Faire plus de ventes',
          'Gagner plus de bénéfices',
          'Avoir plus de clients',
          'Avoir plusieurs points de vente',
          'Agrandir mon stock',
          'Mieux organiser mon commerce',
          'Développer mon équipe',
          'Autre',
        ],
      },
      {
        id: 'q13',
        title: 'Avez-vous actuellement un plan pour développer votre commerce ?',
        type: 'single',
        options: ['Oui, j’ai un plan clair', 'J’ai quelques idées', 'Pas encore', 'Je ne sais pas par où commencer'],
        empathy: {
          'Je ne sais pas par où commencer':
            'C’est justement pour cela que le suivi est important. Commençons par mesurer votre situation actuelle et définir quelques objectifs simples.',
        },
      },
    ],
  },
];

/** 5 étapes au total : 4 de questions + 1 Objectifs (le Résumé n° 6 est une phase). */
const TOTAL_STEPS = 5;

/* ── Utilitaires ── */

/** Vide → null · invalide → 'invalid' · sinon le nombre (jamais inventé). */
function parseAmount(raw: string): number | null | 'invalid' {
  const s = raw.trim().replace(/\s/g, '').replace(/,/g, '.');
  if (!s) return null;
  if (!/^\d+(\.\d+)?$/.test(s)) return 'invalid';
  const n = Number(s);
  return Number.isFinite(n) ? n : 'invalid';
}

/** Vrais jours du mois en cours (aucune valeur inventée). */
function daysInCurrentMonth(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function lowerFirst(v: string): string {
  return v.charAt(0).toLowerCase() + v.slice(1);
}

/* ── Petits composants ── */

function OptionCard({
  label,
  selected,
  multi,
  onClick,
}: {
  label: string;
  selected: boolean;
  multi: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`flex items-center justify-between gap-3 w-full text-left px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
        selected
          ? 'border-[#1E5BF8] bg-blue-50 text-[#1E5BF8] font-semibold shadow-xs'
          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <span className="min-w-0">{label}</span>
      {selected ? (
        <Check className="w-4 h-4 shrink-0" />
      ) : multi ? (
        <span className="w-4 h-4 shrink-0 rounded border border-slate-300" />
      ) : null}
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-bold">
            {prefix}
          </span>
        )}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className={`w-full ${prefix ? 'pl-8' : 'pl-4'} ${suffix ? 'pr-24' : 'pr-4'} py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]`}
        />
        {suffix && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">{hint}</p>}
    </div>
  );
}

/* ── Page ── */

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [hydrated, setHydrated] = useState(false);
  const [phase, setPhase] = useState<Phase>('intro');
  const [stepIndex, setStepIndex] = useState(0); // 0‑3 = questions · 4 = objectifs
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [objectives, setObjectives] = useState<Objectives>(EMPTY_OBJECTIVES);
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [finishing, setFinishing] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Restauration de l'état (serveur prioritaire, localStorage en secours) ── */
  const didInit = useRef(false);
  useEffect(() => {
    if (loading || didInit.current) return;
    if (!user) {
      router.replace('/login');
      return;
    }

    // Compte créé AVANT l'onboarding (aucune clé) → jamais de questionnaire.
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (!('onboarding_completed' in meta)) {
      router.replace('/tarifs');
      return;
    }

    didInit.current = true;
    // NB : PAS de garde « alive » liée au cleanup — `onAuthStateChange`
    // (INITIAL_SESSION) remplace l'objet `user` juste après le montage,
    // ce qui re-déclencherait l'effet : la restauration doit pouvoir
    // se terminer (didInit l'empêche de repartir de zéro).
    (async () => {
      let restored: Record<string, unknown> | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) restored = JSON.parse(raw);
      } catch {
        /* secours local indisponible */
      }

      try {
        const res = await fetch('/api/onboarding', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data.completed === true) {
            router.replace('/tarifs');
            return;
          }
          // L'état LOCAL est prioritaire (écrit à chaque changement, plus
          // frais que la sauvegarde serveur débouncée) ; l'état serveur ne
          // sert que de secours (cache vidé, autre appareil).
          if ((!restored || typeof restored !== 'object') && data.state && typeof data.state === 'object') {
            restored = data.state;
          }
        }
      } catch {
        /* hors ligne : on garde l'état local */
      }

      if (restored && typeof restored === 'object') {
        if (restored.answers && typeof restored.answers === 'object') {
          setAnswers(restored.answers as Answers);
        }
        if (restored.objectives && typeof restored.objectives === 'object') {
          setObjectives({ ...EMPTY_OBJECTIVES, ...(restored.objectives as Partial<Objectives>) });
        }
        if (typeof restored.step === 'number') {
          setStepIndex(Math.min(Math.max(restored.step, 0), TOTAL_STEPS - 1));
        }
        if (typeof restored.qIndex === 'number') setQIndex(Math.max(restored.qIndex, 0));
        if (restored.phase === 'questions' || restored.phase === 'summary') {
          setPhase(restored.phase as Phase);
        }
      }
      setHydrated(true);
    })();
  }, [loading, user, router]);

  /* ── Persistance progressive (à chaque changement, une fois hydraté) ── */
  useEffect(() => {
    if (!hydrated) return;
    const state = { answers, step: stepIndex, phase, qIndex, objectives };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* stockage local indisponible */
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      }).catch(() => {
        /* secours local déjà en place */
      });
    }, 600);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [hydrated, answers, stepIndex, phase, qIndex, objectives]);

  /* ── Données courantes ── */
  const isObjectivesStep = phase === 'questions' && stepIndex === TOTAL_STEPS - 1;
  const currentStep = phase === 'questions' && stepIndex < STEPS.length ? STEPS[stepIndex] : null;
  const currentQuestion = currentStep ? currentStep.questions[Math.min(qIndex, currentStep.questions.length - 1)] : null;

  const days = daysInCurrentMonth();

  /* ── Sélection d'une réponse ── */
  const pick = (q: QuestionDef, option: string) => {
    setError('');
    setAnswers((prev) => {
      if (q.type === 'single') return { ...prev, [q.id]: option };
      const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
      const next = cur.includes(option) ? cur.filter((v) => v !== option) : [...cur, option];
      return { ...prev, [q.id]: next };
    });
  };

  const isPicked = (q: QuestionDef, option: string): boolean => {
    const a = answers[q.id];
    return Array.isArray(a) ? a.includes(option) : a === option;
  };

  const otherValue = (q: QuestionDef): string => {
    const v = answers[`${q.id}_other`];
    return typeof v === 'string' ? v : '';
  };

  const empathyFor = (q: QuestionDef): string | null => {
    if (!q.empathy) return null;
    const a = answers[q.id];
    if (a === undefined) return null;
    if (Array.isArray(a)) {
      for (const v of a) if (q.empathy[v]) return q.empathy[v];
      return q.empathy['*'] ?? null;
    }
    return q.empathy[a] ?? q.empathy['*'] ?? null;
  };

  /* ── Validation avant « Continuer » ── */
  const validateCurrentQuestion = (): boolean => {
    if (currentQuestion) {
      const q = currentQuestion;
      const a = answers[q.id];
      if (q.type === 'single' && typeof a !== 'string') {
        setError('Choisissez une réponse pour continuer.');
        return false;
      }
      if (q.type === 'multi' && (!Array.isArray(a) || a.length === 0)) {
        setError('Sélectionnez au moins une réponse pour continuer.');
        return false;
      }
      const pickedAutre =
        (q.type === 'single' && a === 'Autre') || (q.type === 'multi' && Array.isArray(a) && a.includes('Autre'));
      if (q.other && pickedAutre && !otherValue(q).trim()) {
        setError('Précisez votre réponse dans le champ « Autre ».');
        return false;
      }
      return true;
    }

    if (isObjectivesStep) {
      // Champs numériques : validation stricte (valeurs absentes = jamais écrites).
      const checks: Array<[string, string]> = [
        ['sales', 'L’objectif de ventes'],
        ['profit', 'L’objectif de bénéfice'],
        ['pieces', 'L’objectif de produits'],
        ['annual', 'L’objectif annuel'],
      ];
      if (objectives.ceiling === 'oui') checks.push(['expenses', 'Le plafond de dépenses']);
      for (const [key, label] of checks) {
        const parsed = parseAmount(objectives[key as keyof Objectives]);
        if (parsed === 'invalid') {
          setError(`${label} est invalide : saisissez un nombre positif.`);
          return false;
        }
      }
      if (objectives.ceiling === 'oui' && !objectives.expenses.trim()) {
        setError('Indiquez le plafond mensuel de dépenses ou choisissez « Non ».');
        return false;
      }
      return true;
    }

    return true;
  };

  /* ── Navigation ── */
  const goBack = () => {
    setError('');
    if (phase === 'summary') {
      setPhase('questions');
      setStepIndex(TOTAL_STEPS - 1);
      setQIndex(0);
      return;
    }
    if (phase === 'intro') return;
    if (isObjectivesStep) {
      if (qIndex > 0) setQIndex((v) => v - 1);
      else {
        setStepIndex(STEPS.length - 1);
        setQIndex(STEPS[STEPS.length - 1].questions.length - 1);
      }
      return;
    }
    if (qIndex > 0) setQIndex((v) => v - 1);
    else if (stepIndex > 0) {
      const prev = STEPS[stepIndex - 1];
      setStepIndex((v) => v - 1);
      setQIndex(prev.questions.length - 1);
    } else {
      setPhase('intro');
    }
  };

  const goNext = () => {
    if (!validateCurrentQuestion()) return;
    setError('');
    if (phase === 'intro') {
      setPhase('questions');
      return;
    }
    if (phase === 'summary') return;
    if (isObjectivesStep) {
      setPhase('summary');
      setStepIndex(TOTAL_STEPS - 1);
      return;
    }
    const step = STEPS[stepIndex];
    if (qIndex < step.questions.length - 1) setQIndex((v) => v + 1);
    else if (stepIndex < TOTAL_STEPS - 1) {
      setStepIndex((v) => v + 1);
      setQIndex(0);
    }
  };

  /* ── Finale : écrire les objectifs + poser le flag ── */
  const finish = async () => {
    if (finishing) return;
    // Annule la sauvegarde de progression en attente : évite une collision
    // avec la requête de finalisation (perte du flag `onboarding_completed`).
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setFinishing(true);
    setSaveError('');

    const goals: {
      sales?: number;
      profit?: number;
      pieces?: number;
      expenses?: number;
      annualSales?: number;
    } = {};
    const s = parseAmount(objectives.sales);
    if (typeof s === 'number') goals.sales = s;
    const p = parseAmount(objectives.profit);
    if (typeof p === 'number') goals.profit = p;
    const pc = parseAmount(objectives.pieces);
    if (typeof pc === 'number') goals.pieces = pc;
    const a = parseAmount(objectives.annual);
    if (typeof a === 'number') goals.annualSales = a;
    if (objectives.ceiling === 'oui') {
      const e = parseAmount(objectives.expenses);
      if (typeof e === 'number') goals.expenses = e;
    }

    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          complete: true,
          goals,
          state: { answers, step: TOTAL_STEPS - 1, phase: 'summary', qIndex: 0, objectives },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Enregistrement impossible.');
      }
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
      router.replace('/tarifs');
    } catch (e) {
      setSaveError(
        e instanceof Error && e.message
          ? `Enregistrement impossible (${e.message}). Vérifiez votre connexion puis réessayez.`
          : 'Enregistrement impossible. Vérifiez votre connexion puis réessayez.'
      );
      setFinishing(false);
    }
  };

  /* ── Résumé : texte dynamique basé sur les réelles réponses ── */
  const summaryText = React.useMemo(() => {
    const improve = typeof answers.q11 === 'string' ? answers.q11 : '';
    const rawVision = typeof answers.q12 === 'string' ? answers.q12 : '';
    const vision = rawVision === 'Autre' ? otherValue({ id: 'q12' } as QuestionDef) || '' : rawVision;
    const improvePart =
      improve === 'Tout cela' ? 'mieux piloter votre commerce dans son ensemble' : lowerFirst(improve);
    if (improve && vision) return `Vous souhaitez avant tout ${improvePart}. À plus long terme, votre vision est de ${lowerFirst(vision)}.`;
    if (improve) return `Vous souhaitez avant tout ${improvePart}.`;
    if (vision) return `Votre vision pour les prochains mois : ${lowerFirst(vision)}.`;
    return 'Merci de vos réponses : elles nous permettront de mieux vous accompagner avec COMAXE.';
  }, [answers, objectives]);

  const summaryRows = React.useMemo(() => {
    const rows: Array<{ label: string; value: string }> = [];
    const s = parseAmount(objectives.sales);
    if (typeof s === 'number') rows.push({ label: 'Ventes mensuelles', value: formatUSD(s) });
    const p = parseAmount(objectives.profit);
    if (typeof p === 'number') rows.push({ label: 'Bénéfice net mensuel', value: formatUSD(p) });
    const pc = parseAmount(objectives.pieces);
    if (typeof pc === 'number') rows.push({ label: 'Produits vendus', value: `${pc} / mois` });
    const a = parseAmount(objectives.annual);
    if (typeof a === 'number') rows.push({ label: 'Objectif annuel', value: formatUSD(a) });
    if (objectives.ceiling === 'oui') {
      const e = parseAmount(objectives.expenses);
      if (typeof e === 'number') rows.push({ label: 'Plafond de dépenses', value: `${formatUSD(e)} / mois` });
    }
    return rows;
  }, [objectives]);

  /* ── Rendu ── */
  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#F8F9FD] flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <BrandLogo size={40} />
          <span className="text-sm text-slate-500">Chargement…</span>
        </div>
      </div>
    );
  }

  const stepLabel =
    phase === 'summary' ? 'Résumé' : `Étape ${Math.min(stepIndex + 1, TOTAL_STEPS)} sur ${TOTAL_STEPS}`;
  const progressPct =
    phase === 'summary'
      ? 100
      : phase === 'intro'
        ? 0
        : Math.min(
            100,
            Math.round(
              (stepIndex / TOTAL_STEPS) * 100 +
                (100 / TOTAL_STEPS) *
                  (stepIndex < STEPS.length && currentStep
                    ? (qIndex + 1) / currentStep.questions.length
                    : 1)
            )
          );

  const backButton = (
    <button
      type="button"
      onClick={goBack}
      className="flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-slate-900 px-4 py-3 rounded-xl hover:bg-slate-100 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour
    </button>
  );

  const nextButton = (label: string) => (
    <button
      type="button"
      onClick={phase === 'summary' ? finish : goNext}
      disabled={finishing}
      className="flex items-center gap-2 bg-[#1E5BF8] hover:bg-[#1548CF] text-white text-sm font-semibold px-6 py-3 rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition-all disabled:opacity-60 ml-auto"
    >
      {finishing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
      {label}
      {!finishing && phase !== 'summary' ? <ArrowRight className="w-4 h-4" /> : null}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8F9FD] flex flex-col items-center px-4 py-6 sm:py-10">
      {/* En-tête : logo + progression */}
      <header className="w-full max-w-2xl flex items-center justify-between mb-5">
        <BrandLogo size={32} />
        <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-blue-50 text-[#1E5BF8]">
          {stepLabel}
        </span>
      </header>

      {phase !== 'intro' && (
        <div className="w-full max-w-2xl h-1.5 rounded-full bg-slate-200 overflow-hidden mb-6">
          <div
            className="h-full rounded-full bg-[#1E5BF8] transition-all duration-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      <main className="w-full max-w-2xl">
        {/* ── Écran d'accueil du questionnaire ── */}
        {phase === 'intro' && (
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-6 sm:p-9">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#1E5BF8] w-fit mb-5">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Parlons de votre commerce
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Avant de commencer, nous aimerions mieux comprendre votre activité et ce que vous souhaitez
              accomplir. Vos réponses nous aideront à mieux vous accompagner avec COMAXE.
            </p>
            <div className="mt-5 rounded-xl bg-blue-50 p-4 flex gap-3 text-sm text-slate-700">
              <HeartHandshake className="w-4 h-4 shrink-0 mt-0.5 text-[#1E5BF8]" />
              <span>
                Il n’y a pas de mauvaise réponse. Répondez simplement selon votre situation actuelle.
              </span>
            </div>
            <div className="mt-7 flex justify-end">
              {nextButton('Commencer')}
            </div>
          </section>
        )}

        {/* ── Étapes 1 à 4 : une question à la fois ── */}
        {phase === 'questions' && currentQuestion && currentStep && (
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-8">
            <p className="text-[13px] font-bold text-[#1E5BF8]">
              Étape {stepIndex + 1} · {currentStep.title}
              <span className="text-slate-400 font-semibold">
                {' '}
                · Question {Math.min(qIndex + 1, currentStep.questions.length)} sur {currentStep.questions.length}
              </span>
            </p>
            <h2 className="mt-2 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
              {currentQuestion.title}
            </h2>
            {currentQuestion.hint && (
              <p className="mt-1 text-xs text-slate-500">{currentQuestion.hint}</p>
            )}

            <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {currentQuestion.options.map((opt) => (
                <OptionCard
                  key={opt}
                  label={opt}
                  selected={isPicked(currentQuestion, opt)}
                  multi={currentQuestion.type === 'multi'}
                  onClick={() => pick(currentQuestion, opt)}
                />
              ))}
            </div>

            {currentQuestion.other &&
              ((currentQuestion.type === 'single' && answers[currentQuestion.id] === 'Autre') ||
                (currentQuestion.type === 'multi' &&
                  Array.isArray(answers[currentQuestion.id]) &&
                  (answers[currentQuestion.id] as string[]).includes('Autre'))) && (
                <div className="mt-3">
                  <input
                    value={otherValue(currentQuestion)}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [`${currentQuestion.id}_other`]: e.target.value }))
                    }
                    placeholder="Précisez votre réponse…"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1E5BF8]/20 focus:border-[#1E5BF8]"
                  />
                </div>
              )}

            {empathyFor(currentQuestion) && (
              <div className="mt-4 rounded-xl bg-blue-50 p-3.5 flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
                <HeartHandshake className="w-4 h-4 shrink-0 mt-0.5 text-[#1E5BF8]" />
                <span>{empathyFor(currentQuestion)}</span>
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              {backButton}
              {nextButton('Continuer')}
            </div>
          </section>
        )}

        {/* ── Étape 5 : objectifs ── */}
        {phase === 'questions' && isObjectivesStep && (
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-8">
            <div className="flex items-start gap-3">
              <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8] shrink-0">
                <Target className="w-5 h-5" />
              </span>
              <div>
                <p className="text-[13px] font-bold text-[#1E5BF8]">Étape 5 · Vos objectifs</p>
                <h2 className="mt-1 text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                  Maintenant, parlons de vos objectifs 🎯
                </h2>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">
                  Définissons ensemble quelques objectifs réalistes pour votre commerce. Vous pourrez toujours
                  les modifier plus tard.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-5">
              <NumberField
                label="Quel chiffre d’affaires aimeriez-vous atteindre chaque mois ?"
                prefix="$"
                suffix="/ mois"
                value={objectives.sales}
                onChange={(v) => setObjectives((o) => ({ ...o, sales: v }))}
                hint={
                  typeof parseAmount(objectives.sales) === 'number'
                    ? (() => {
                        const n = parseAmount(objectives.sales) as number;
                        const perDay = Math.round(n / days);
                        return (
                          <>
                            Votre objectif est de {formatUSD(n)} de ventes par mois.
                            {perDay >= 1 && (
                              <>
                                {' '}
                                · ≈ {formatUSD(perDay)} par jour (sur {days} jours ce mois-ci)
                              </>
                            )}
                          </>
                        );
                      })()
                    : undefined
                }
              />

              <div>
                <NumberField
                  label="Quel bénéfice net aimeriez-vous réaliser chaque mois ?"
                  prefix="$"
                  suffix="/ mois"
                  value={objectives.profit}
                  onChange={(v) => setObjectives((o) => ({ ...o, profit: v }))}
                  hint={
                    typeof parseAmount(objectives.profit) === 'number'
                      ? `Votre objectif est de ${formatUSD(parseAmount(objectives.profit) as number)} de bénéfice net par mois.`
                      : 'Le bénéfice net correspond à ce qu’il vous reste après les dépenses prises en compte par COMAXE.'
                  }
                />
              </div>

              <NumberField
                label="Combien de produits aimeriez-vous vendre par mois ?"
                suffix="produits"
                value={objectives.pieces}
                onChange={(v) => setObjectives((o) => ({ ...o, pieces: v }))}
                hint={
                  typeof parseAmount(objectives.pieces) === 'number'
                    ? (() => {
                        const n = parseAmount(objectives.pieces) as number;
                        const perDay = Math.round(n / days);
                        return (
                          <>
                            Votre objectif est de {n} produits par mois.
                            {perDay >= 1 && <> · ≈ {perDay} produits par jour (sur {days} jours)</>}
                          </>
                        );
                      })()
                    : undefined
                }
              />

              <NumberField
                label="Quel chiffre d’affaires aimeriez-vous atteindre sur l’année ?"
                prefix="$"
                suffix="/ an"
                value={objectives.annual}
                onChange={(v) => setObjectives((o) => ({ ...o, annual: v }))}
                hint={
                  typeof parseAmount(objectives.annual) === 'number'
                    ? `Votre objectif annuel est de ${formatUSD(parseAmount(objectives.annual) as number)}.`
                    : undefined
                }
              />

              <div>
                <p className="text-sm font-semibold text-slate-700 mb-1.5">
                  Souhaitez-vous définir un plafond mensuel pour vos dépenses récurrentes ?
                </p>
                <div className="flex gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setObjectives((o) => ({ ...o, ceiling: 'oui' }));
                    }}
                    className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      objectives.ceiling === 'oui'
                        ? 'border-[#1E5BF8] bg-blue-50 text-[#1E5BF8]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Oui
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setError('');
                      setObjectives((o) => ({ ...o, ceiling: 'non' }));
                    }}
                    className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                      objectives.ceiling === 'non'
                        ? 'border-[#1E5BF8] bg-blue-50 text-[#1E5BF8]'
                        : 'border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    Non
                  </button>
                </div>
                {objectives.ceiling === 'oui' && (
                  <div className="mt-4">
                    <NumberField
                      label="Plafond de dépenses mensuelles"
                      prefix="$"
                      suffix="/ mois"
                      value={objectives.expenses}
                      onChange={(v) => setObjectives((o) => ({ ...o, expenses: v }))}
                      hint={
                        typeof parseAmount(objectives.expenses) === 'number'
                          ? `Plafond de ${formatUSD(parseAmount(objectives.expenses) as number)} par mois : il s’agit d’un maximum à ne pas dépasser, pas d’un objectif à atteindre.`
                          : 'Traité comme un plafond : il ne s’agit pas de le dépasser.'
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-blue-50 p-3.5 flex gap-2.5 text-[13px] leading-relaxed text-slate-700">
              <HeartHandshake className="w-4 h-4 shrink-0 mt-0.5 text-[#1E5BF8]" />
              <span>
                Tous ces objectifs sont facultatifs. Ce que vous renseignez ici sera écrit dans votre page
                Objectifs et pourra être modifié à tout moment.
              </span>
            </div>

            {error && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              {backButton}
              {nextButton('Continuer')}
            </div>
          </section>
        )}

        {/* ── Étape 6 : résumé ── */}
        {phase === 'summary' && (
          <section className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs p-5 sm:p-8">
            <div className="p-2.5 rounded-xl bg-blue-50 text-[#1E5BF8] w-fit mb-5">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Nous avons compris votre situation.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">{summaryText}</p>

            <div className="mt-6 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5">
              <div className="flex items-center gap-2.5 mb-4">
                <span className="p-1.5 rounded-lg bg-blue-50 text-[#1E5BF8]">
                  <Target className="w-4 h-4" />
                </span>
                <h2 className="text-base font-bold text-slate-900">Vos objectifs 🎯</h2>
              </div>
              {summaryRows.length > 0 ? (
                <ul className="divide-y divide-slate-100">
                  {summaryRows.map((row) => (
                    <li key={row.label} className="flex items-center justify-between gap-4 py-2.5">
                      <span className="text-sm text-slate-600">{row.label}</span>
                      <span className="text-sm font-bold text-slate-900">{row.value}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed">
                  Aucun objectif renseigné pour le moment — ce n’est pas grave, vous pourrez en définir à tout
                  moment depuis votre espace Objectifs.
                </p>
              )}
            </div>

            <div className="mt-5 rounded-xl bg-blue-50 p-4 flex gap-3 text-sm text-slate-700 leading-relaxed">
              <HeartHandshake className="w-4 h-4 shrink-0 mt-0.5 text-[#1E5BF8]" />
              <span>
                Vous n’avez pas besoin d’avoir tout compris aujourd’hui. COMAXE est là pour vous aider à mieux
                comprendre votre commerce, suivre vos résultats et progresser étape par étape. Vos objectifs
                pourront être modifiés ou complétés à tout moment depuis votre espace Objectifs.
              </span>
            </div>

            {saveError && (
              <div className="mt-4 flex items-center gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {saveError}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between gap-3">
              {backButton}
              {nextButton('Continuer vers les tarifs')}
            </div>
          </section>
        )}
      </main>

      <p className="mt-6 text-xs text-slate-400 text-center max-w-md">
        Vos réponses servent à personnaliser votre espace COMAXE. Vos objectifs resteront modifiables à tout
        moment.
      </p>
    </div>
  );
}
