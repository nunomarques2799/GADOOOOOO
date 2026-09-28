// Arranca a app web em MODO DEMO (dados do seed, sem login) na porta 8085.
// As chaves ficam DEFINIDAS mas vazias: o dotenv do Expo só preenche as que
// não existem, e apagá-las fazia o .env voltar a pô-las.
const { spawn } = require('child_process');
const path = require('path');

const raiz = 'C:/Users/nuno_/Desktop/Websites/Gado/gestao-gado';
const filho = spawn(
  process.execPath,
  [path.join(raiz, 'node_modules/expo/bin/cli'), 'start', '--web', '--port', '8085'],
  {
    cwd: raiz,
    stdio: 'inherit',
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_KEY: '', BROWSER: 'none' },
  },
);
filho.on('exit', (c) => process.exit(c ?? 0));
