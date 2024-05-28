<script lang="ts">
  import { Text, Timeline } from '@svelteuidev/core';
  import { adventure } from '../stores/AdventureStore';
</script>

<div style="padding: 15px">
  <Timeline active={1} reverseActive lineWidth={2} bulletSize={20}>
    {#each $adventure.history as entry}
      <Timeline.Item title={entry.speaker}>
        <Text color="dimmed" size="sm">{entry.message}</Text>
      </Timeline.Item>
    {/each}
  </Timeline>
</div>