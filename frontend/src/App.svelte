<script lang="ts">
  import { onMount } from 'svelte';
  import { Stores } from './stores/Stores';
  import { adventure } from './stores/AdventureStore';
  import { Button, Center, Loader, Stack, SvelteUIProvider, Title } from '@svelteuidev/core';
  import Join from './screens/Join.svelte';
  import Session from './screens/Session.svelte';
  
  let initialized = false;
  onMount(async () => {
    await Stores.Discord.login();
    await Stores.Discord.startActivity();
    initialized = true;
  });
  
</script>

<SvelteUIProvider withGlobalStyles themeObserver="dark">
  <div style="padding: 15px">
    {#if !initialized}
      <Loader variant='circle' />
    {:else}
      {#if !$adventure.state}
        <Join />
      {:else}
        <Session />
      {/if}
    {/if}
  </div>
</SvelteUIProvider>