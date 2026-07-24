/**
 * Procura tokens de PALETA lidos fora do render.
 * ------------------------------------------------------------------
 * As cores da paleta vivem num objeto que é reescrito no arranque
 * (`aplicarPaletaNasCores`). Quem as lê no corpo de um módulo — uma constante
 * no topo do ficheiro — copia o valor ANTES de a paleta escolhida estar
 * aplicada, e fica com a cor de origem para sempre. O sintoma é traiçoeiro:
 * a app inteira muda de cor menos um botão, e ninguém percebe porquê.
 *
 * Foi assim que o botão "Entrar" ficou verde numa app azul.
 *
 * Correr:  node scripts/cores-no-arranque.js
 * Saída:   lista de ficheiro:linha a corrigir (getter ou ler dentro do render).
 * Código de saída 1 se encontrar alguma — dá para pôr na CI.
 */

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

/** Os tokens que a paleta reescreve. Espelha `TokensPaleta` em paletas.ts. */
const DE_PALETA = new Set([
  'primary',
  'primaryDark',
  'primaryDarker',
  'primaryTint',
  'primaryTintStrong',
  'onPrimary',
  'headerFrom',
  'headerTo',
  'background',
  'surface',
  'surfaceAlt',
  'surfaceSunken',
  'text',
  'textSecondary',
  'textMuted',
  'border',
  'borderStrong',
  'overlay',
]);

/** Nós que criam um novo momento de execução — lá dentro já é seguro. */
function adiado(no) {
  return (
    ts.isFunctionDeclaration(no) ||
    ts.isFunctionExpression(no) ||
    ts.isArrowFunction(no) ||
    ts.isMethodDeclaration(no) ||
    ts.isGetAccessorDeclaration(no) ||
    ts.isSetAccessorDeclaration(no) ||
    ts.isClassDeclaration(no)
  );
}

function ficheiros(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) ficheiros(p, out);
    else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
  return out;
}

const achados = [];

for (const f of ficheiros('src')) {
  // O próprio tema é quem define as cores — ler `colors` lá é o normal.
  if (f.includes(`${path.sep}theme${path.sep}`)) continue;

  const texto = fs.readFileSync(f, 'utf8');
  const fonte = ts.createSourceFile(f, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const visitar = (no, dentroDeFuncao) => {
    const agora = dentroDeFuncao || adiado(no);

    if (
      !agora &&
      ts.isPropertyAccessExpression(no) &&
      ts.isIdentifier(no.expression) &&
      no.expression.text === 'colors' &&
      DE_PALETA.has(no.name.text)
    ) {
      const { line } = fonte.getLineAndCharacterOfPosition(no.getStart(fonte));
      achados.push({ f, linha: line + 1, token: no.name.text });
    }

    ts.forEachChild(no, (filho) => visitar(filho, agora));
  };

  ts.forEachChild(fonte, (no) => visitar(no, false));
}

if (achados.length === 0) {
  console.log('Nenhum token de paleta lido no arranque. ✓');
  process.exit(0);
}

console.log('Tokens de paleta lidos no arranque do módulo (ficam com a cor de origem):\n');
for (const a of achados) console.log(`  ${a.f}:${a.linha}  colors.${a.token}`);
console.log(
  '\nCorrigir: ler dentro do render, ou trocar o valor por um getter ' +
    '(`get cor() { return colors.primary; }`).',
);
process.exit(1);
