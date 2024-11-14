# Adventure Bot

A Discord Activity for multiple players that lets a group run LLM-moderated adventures of varying difficulty and duration! The AI crafts an adventure based on your prompts that you and your friends experience together. Overcome obstacles, defeat enemies, and acquire items and abilities.

## Features

- 2-way speech communication with bot (not yet in main)
- Summarized history accumulation method to maintain adventure coherency across multiple trials

## The Tech

- OpenAI API for chat completions
- GCloud voice synthesis
- Typescript server
- Svelte FE (runs in an iframe within a Discord video chat session)

## Future Ideas

- Extend 
- Persist received items in an inventory for each user
- Track win/loss stats over time for users
- Daily quests - episodic challenges that we author and that come out day by day, presenting a longer narrative arc
- Server vs server
