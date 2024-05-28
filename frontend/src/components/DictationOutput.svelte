<script lang="ts">
import { adventure } from '../stores/AdventureStore';
import { Blockquote, Paper, Text } from '@svelteuidev/core';
</script>

{#if $adventure.state.phase === 'Player_Turn' && $adventure.state.dmState === 'Idle'}
  <Paper>
    {$adventure.state.participants.find(p => p.discordId === $adventure.state.activeParticipant).name}, take your turn when ready.
  </Paper>
{/if}

{#if $adventure.display.message}
  <Paper>
    <Blockquote>
      {$adventure.display.message}
      <svelte:fragment slot="cite">- {$adventure.display.speaker}</svelte:fragment>
    </Blockquote>
  </Paper>
{/if}