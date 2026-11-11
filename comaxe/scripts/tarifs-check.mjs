// Contrôle rapide du HTML de la section Tarifs (6 offres, 2 catégories)
const APP = 'http://localhost:3000';
const get = async (p) => (await fetch(APP + p)).text();

const count = (h, s) => h.split(s).length - 1;
let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  ok ? pass++ : fail++;
  console.log(`  ${ok ? 'OK  ' : 'ECHEC'} ${label}${detail ? ' — ' + detail : ''}`);
};

const t = await get('/tarifs');
const l = await get('/');

for (const [name, h] of [['TARIFS', t], ['LANDING', l]]) {
  console.log(`--- ${name} ---`);
  const names = ['Essential', 'Pro', 'Max', 'Ultime', 'Business Max', 'Business Ultime']
    .filter((n) => h.includes(`>${n}<`)).length;
  check('6 noms d\'offres', names === 6, `trouvés=${names}/6`);

  check('prix mensuels $5 $14 $24 $59 $99',
    ['>$5<', '>$14<', '>$24<', '>$59<', '>$99<'].every((p) => h.includes(p)));
  check('Essential $0', h.includes('>$0<'));

  check('"Voir les fonctionnalités" x6', count(h, 'Voir les fonctionnalit') === 6,
    `n=${count(h, 'Voir les fonctionnalit')}`);
  check('"Bientôt disponible" x3', count(h, 'Bient') >= 3, `n=${count(h, 'Bient')}`);
  check('badge "Le plus populaire" x1', count(h, 'Le plus populaire') === 1,
    `n=${count(h, 'Le plus populaire')}`);
  check('catégories (commerce + entreprise)',
    /Gestion d[’']un commerce/.test(h) && /Gestion d[’']entreprise/.test(h));
  check('règles Business', /R[èe]gles du syst[èe]me Business/.test(h));
  check('"S\'abonner" x2', count(h, 'S’abonner') === 2, `n=${count(h, 'S’abonner')}`);
  const hrefs = {
    dashboard: count(h, 'href="/dashboard"'),
    // Préfixe : couvre /login simple ET /login?next=… (reprise de flux)
    login: count(h, 'href="/login'),
    loginNext: count(h, 'href="/login?next='),
  };
  if (name === 'TARIFS') {
    check('"Commencer gratuitement" x1 (bouton Essential)', count(h, 'Commencer gratuitement') === 1,
      `n=${count(h, 'Commencer gratuitement')}`);
    check('boutons plans -> /login?next= (reprise de flux) x3', hrefs.loginNext === 3,
      `n=${hrefs.loginNext}`);
    check('connexion en-tête + plans -> /login x4', hrefs.login >= 4, `n=${hrefs.login}`);
    check('croix dashboard présente', h.includes('tableau de bord'));
  } else {
    check('"Commencer gratuitement" x3 (Hero + CTA + Essential)', count(h, 'Commencer gratuitement') === 3,
      `n=${count(h, 'Commencer gratuitement')}`);
    check('boutons plans -> /login (connexions incluses)', hrefs.login >= 5, `n=${hrefs.login}`);
  }
}

// Textes harmonisés (après intégration tâche 3)
console.log('--- TEXTES ---');
check('plus aucun ancien prix « 15 $ » / « $15 »', !t.includes('15 $') && !t.includes('$15') && !l.includes('15 $') && !l.includes('$15'));
check('FAQ/Note : « six offres »', l.includes('six offres'));
check('Titre : « chaque activité »', t.includes('chaque activité') && l.includes('chaque activité'));
check('FAQ : prix Max (14 $/mois)', l.includes('14 $/mois'));
check('FAQ : offres Business citées (59 $/mois)', l.includes('59 $/mois'));
check('plus aucun ancien prix mensuel ($10 $20 $50 $100)',
  !['>$10<', '>$20<', '>$50<', '>$100<'].some((p) => t.includes(p) || l.includes(p)));
check('pas de « trois offres »', !l.includes('trois offres'));

console.log(`\nRESULTAT : ${pass} reussi(s) / ${fail} echoue(s)`);
process.exitCode = fail ? 1 : 0;
