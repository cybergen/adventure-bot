<script lang="ts">
  
import { adventure } from '../stores/AdventureStore';
import { Timeline, Blockquote, Button, Center, Grid, Group, Loader, Paper, Space, Stack, Text, Title } from '@svelteuidev/core';
import { discord } from '../stores/DiscordStore';
import HistoryOutput from '../components/HistoryOutput.svelte';
import DictationOutput from '../components/DictationOutput.svelte';

let buttonActive = $adventure.state.phase === 'Readying' 
  || $adventure.state.phase === 'Prompt_Needed'
  || ($adventure.state.phase === 'Player_Turn' && $adventure.state.activeParticipant !== $discord.user.id);
let buttonText = 'Start Adventure';

let buttonBusy: boolean = false;
$: $adventure.state, buttonBusy = false;

const toggleSpeech = () => {
  if ($adventure.state.dmState !== 'Listening') {
    $adventure.startSpeaking();
    buttonText = 'Submit'
  } else {
    $adventure.stopSpeaking();
    buttonText = 'Start Recording'
  }
};

const onClick = () => {
  buttonBusy = true;
  
  switch ($adventure.state.phase) {
    case "Readying":
      $adventure.startAdventure();
      break;
    case "Prompt_Needed":
      toggleSpeech();
      break;
    case "DM_Active":
      break;
    case "Player_Turn":
      toggleSpeech();
      break;

  }
};

</script>

<div class="session-container">
  <Stack justify="flex-start">
    <Paper>
      <Title order={3}>Endswell</Title>
      <Space h="lg"></Space>
      <Stack align="center">
        {#if $adventure.state.dmState === 'Listening'}
          <Loader variant='bars' />
          <Text>Listening</Text>
        {:else if $adventure.state.dmState === 'Thinking'}
          <Loader variant='dots' />
          <Text>Thinking</Text>
        {:else}
          <Text style="font-style: italic">Ready</Text>
        {/if}
<!--        (DEBUG: {$adventure.state.phase})-->
      </Stack>
    </Paper>
    
    <Paper>
      <Title order={3}>Players</Title>
      <Space h="lg"></Space>
      {#each $adventure.state.participants as player}
        <Text size="md">{player.name}</Text>
      {/each}
    </Paper>
  </Stack>
  
  <HistoryOutput />
</div>

<div class="session-container">
  <div style="flex-grow: 1">
    <DictationOutput />
  </div>
</div>

<Center>
  <Button 
      loading={buttonBusy} 
      fullSize 
      disabled={!buttonActive || null}
      on:click={onClick}
  >{buttonText}</Button>
</Center>

<style>
  .session-container {
    display: flex;
    flex-direction: row;
    gap: 10px;
    
    margin-bottom: 10px;
  }
</style>