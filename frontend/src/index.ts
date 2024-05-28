import './style.css';
import App from './App.svelte';
import { ClientSocketManager } from './ClientSocketManager';
import { Stores } from './stores/Stores';

(async () => {
  const socketManager = new ClientSocketManager();
  await socketManager.ready;
  
  const globalStore = new Stores(socketManager);

  document.body.innerHTML = '';
  const app = new App({
    target: document.body
  });
})();




// };
// configure();