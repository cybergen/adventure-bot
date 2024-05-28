<script lang="ts">
import { adventure } from '../stores/AdventureStore';
import { Button, Center, Paper, Stack, Title } from '@svelteuidev/core';
</script>

<Center>
  <Paper>
  <Stack>
    <Title order={1}>Project Endswell</Title>
    <Title order={3}>Adventure awaits. Are you ready?</Title>
    <Button fullSize on:click={() => $adventure.joinAdventure()}>Join</Button>
    </Stack>
  </Paper>
</Center>
