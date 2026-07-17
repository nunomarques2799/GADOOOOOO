import Constants from 'expo-constants';

/**
 * Versão da app — lida do `app.json` (única fonte de verdade), para o rodapé
 * dos ecrãs não ficar dessincronizado do build. No desktop (Electron) o
 * instalador tem a sua própria versão `1.0.<run>`; esta é a da aplicação.
 */
export const VERSAO_APP = Constants.expoConfig?.version ?? '1.0.0';
