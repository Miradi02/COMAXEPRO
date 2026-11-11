// Codemod COMAXE : formatUSD → formatAmount (devise du commerce via useCommerce)
// - supprime l'import de formatUSD
// - renome tous les appels formatUSD( → formatAmount(
// - ajoute formatAmount au premier destructuring useCommerce()
import { readFileSync, writeFileSync } from 'node:fs';

const files = [
  'src/app/(app)/ventes/page.tsx',
  'src/app/(app)/stock/page.tsx',
  'src/app/(app)/rapports/page.tsx',
  'src/app/(app)/objectifs/page.tsx',
  'src/app/(app)/dettes/page.tsx',
  'src/app/(app)/depenses/page.tsx',
  'src/app/(app)/clients/[id]/page.tsx',
  'src/app/(app)/clients/page.tsx',
  'src/app/(app)/benefice/page.tsx',
  'src/app/(app)/analytique/page.tsx',
  'src/components/dashboard/RecentCustomers.tsx',
  'src/components/dashboard/KPICards.tsx',
  'src/components/dashboard/SalesEvolutionChart.tsx',
  'src/components/dashboard/RecentSalesTable.tsx',
  'src/components/dashboard/SalesGoalCard.tsx',
  'src/components/dashboard/TopSellingProducts.tsx',
];

let failures = 0;

for (const f of files) {
  let src = readFileSync(f, 'utf8');
  const original = src;

  // 1. Retirer la ligne d'import de formatUSD
  src = src.replace(/^import \{ formatUSD \} from '@\/lib\/utils';\r?\n/m, '');

  // 2. Renommer tous les appels
  src = src.split('formatUSD(').join('formatAmount(');

  // 3. Ajouter formatAmount au premier destructuring useCommerce()
  let found = false;
  src = src.replace(/const \{([^}]*)\} = useCommerce\(\);/g, (m, inner) => {
    if (found) return m;
    found = true;
    if (inner.includes('\n')) {
      const lines = m.split('\n');
      const closing = lines[lines.length - 1];
      const indentMatch = closing.match(/^([ \t]*)/);
      const indent = indentMatch ? indentMatch[1] : '  ';
      lines.splice(lines.length - 1, 0, `${indent}  formatAmount,`);
      return lines.join('\n');
    }
    const trimmed = inner.trim().replace(/,\s*$/, '');
    return `const { ${trimmed}, formatAmount } = useCommerce();`;
  });

  if (!found) {
    console.log(`[MANQUE useCommerce] ${f}`);
    failures++;
    continue;
  }
  if (src === original) {
    console.log(`[INCHANGE] ${f}`);
    continue;
  }
  const stillHasImport = src.includes('formatUSD');
  writeFileSync(f, src, 'utf8');
  console.log(`[OK] ${f}${stillHasImport ? '  (ATTENTION: formatUSD encore present!)' : ''}`);
  if (stillHasImport) failures++;
}

console.log(failures === 0 ? 'CODEMOD TERMINE — 0 echec' : `CODEMOD — ${failures} echec(s)`);
process.exit(failures === 0 ? 0 : 1);
