import { getCurrentUser } from "../account-api.js";
import { getAuthErrorMessage } from "../auth-api.js";

// Revalida os dados do perfil sem bloquear a navegação nem reiniciar a sessão.
export function startProfileSync(onFeedback) {
  const browser = window;
  const page = document;
  let stopped = false;
  let checking = false;

  const refresh = async () => {
    if (stopped || checking || page.hidden) return;
    checking = true;
    try {
      await getCurrentUser();
      if (!stopped) onFeedback("");
    } catch (error) {
      // O tratamento de 401 já encerra a sessão no cliente da API.
      if (!stopped && error.status !== 401) {
        onFeedback(`${getAuthErrorMessage(error, "Não foi possível atualizar seus dados.")} Os dados exibidos podem estar desatualizados.`);
      }
    } finally {
      checking = false;
    }
  };
  const onReturn = () => { void refresh(); };
  browser.addEventListener("focus", onReturn);
  page.addEventListener("visibilitychange", onReturn);
  // Uma montagem descartada pelo StrictMode não inicia uma consulta extra.
  queueMicrotask(onReturn);

  return {
    refresh,
    stop() {
      stopped = true;
      browser.removeEventListener("focus", onReturn);
      page.removeEventListener("visibilitychange", onReturn);
    },
  };
}
