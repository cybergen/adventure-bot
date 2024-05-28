# Adventure Bot

A fun, sarcastic discord bot to help you run LLM-moderated adventures of varying difficulty and duration!

## Setup
`npm install` is your friend, to be used in both backend/frontend.

Additionally, GCP CLI setup is required once:
````
gcloud auth login
gcloud config set project project-endswell

gcloud auth application-default login
gcloud auth application-default set-quota-project project-endswell
````

## Running
Ensure .env files have sensitive keys/configurations.

Run `npm run dev` in two separate consoles, one in backend, one in frontend.

In a third terminal, run `cloudflared tunnel --url http://localhost:5173`. Update the [URL mappings](https://discord.com/developers/applications/1243418395379105842/embedded/url-mappings) for the activity with the generated tunnel URL.

## The Tech

Uses a persistant history method to enable coherency and on-task LLM behavior over time. Could be extended out across multiple sessions as well.