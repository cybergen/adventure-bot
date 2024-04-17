const { Client, GatewayIntentBits, ReactionCollector, Message } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });
const { OpenAI } = require('openai');
const util = require('util');

const openai = new OpenAI();

const initialJoinWindow = 20000;
const stageResponseWindow = 6000;

let currentState = "idle";
let courseChannel = null;
let currentStage = 0;

//Initial plan for course
let courseDescription = {};
//Overall history of stages in the course
let courseHistory = [];
//History of what has befallen each player over time
let playerHistory = [];
//Chat-like full text of current stage for coherency (resets for each stage)
let currentStageContext = "";

function resetCourse() {
    currentState = "idle";
    currentStage = 0;
    currentStageContext = "";
    courseDescription = {};
    courseHistory = [];
    playerHistory = [];
}

client.once('ready', () => {
    console.log('Ready!');
});

client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (currentState === "idle" && message.content.startsWith('!adventure')) {
      handleNewAdventure(message);
    } else if (currentState === "input-stage" && courseDescription?.players?.includes(message.author.username)) {
      handleAdventureProgress(message.author.username, message.content);
    } else if (currentState !== "idle" && courseDescription?.players?.includes(message.author.username)) {
      courseChannel.send("You can only take part in the adventure during challenge stages");
    }
});

async function handleNewAdventure(message) {
  const params = message.content.slice('!adventure'.length).trim();
  if (!params) return message.reply("Please provide a prompt for the adventure including a theme and a duration.");

  currentState = "collecting";
  const initialMessage = await message.channel.send(`Adventure "${params}" is starting! React to this message to join the adventure.`);
  const collector = initialMessage.createReactionCollector({ time: initialJoinWindow });

  collector.on('collect', (reaction, user) => {
      console.log(`${user.tag} reacted with ${reaction.emoji.name}`);
  });

  collector.on('end', collected => {
      const players = collected.map(reaction => reaction.users.cache.filter(u => !u.bot).map(user => user.username)).flat();      
      console.log(`Collected ${collected.size} items with players ${players}`);   
      currentState = "active";
      currentStage = 0;
      courseChannel = message.channel;
      startCourse(params, players);
  });
}

async function startCourse(prompt, players) {
  courseDescription = await getLLMCourseDescription(prompt, players);
  courseChannel.send(`The adventure "${courseDescription.name}" begins with the following brave souls: ${courseDescription.players.join(', ')}`);
  courseChannel.send(`DEBUG: Full course info ${JSON.stringify(courseDescription)}`);
  while (currentStage < courseDescription.stages) {    
    await startStage();
    currentState = "post-stage";
    await endStage();
    currentStage++;
  }
  await endAdventure();
}

async function startStage() {
  currentStageContext = await getLLMStageDescription(courseDescription, courseHistory, playerHistory);
  courseChannel.send(currentStageContext);
  currentState = "input-stage";
  await delay(stageResponseWindow);
}

//Only gets called if we're in state 'stage-input'
async function handleAdventureProgress(player, message) {
  currentStageContext += '\n' + JSON.stringify({
    player: player,
    reply: message
  });
  courseChannel.send(await processPlayerInputWithLLM(currentStageContext));
}

async function endStage() {
  courseChannel.send(await getLLMStageResults());
  const history = await getLLMHistoryUpdate();
  courseChannel.send(history);
}


async function endAdventure(channel) {
  courseChannel.send(await getAdventureResults(courseDescription, courseHistory, playerHistory));
  resetCourse();
}

// Login to Discord with your app's token
client.login('MTIyNjcyNjYxNDg4NTMzNTE2Mg.GtEOHd.XRZgKJGceKjP-T_5zaF-gDI41q-2sgzTewxvQE');

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*

LLM Functions

*/

// Simulated function to get LLM stage description
async function getLLMCourseDescription(prompt, players) {
  const fullPrompt = courseDescriptionPrompt + prompt + ". The players are " + players.join(', ');
  // Simulated delay
  return await fetchOpenAIResponse(fullPrompt, "gpt-3.5-turbo", 512);
}

// Get the initial description for the new stage
async function getLLMStageDescription(courseDescription, courseHistory, playerHistory) {
  // Simulated delay
  return new Promise(resolve => setTimeout(() => resolve(`New stage ${currentStage}! What will you do?`), 1000));
}

// Simulated LLM processing function
async function processPlayerInputWithLLM(overallContext) {
  // Simulated processing delay and response
  return new Promise(resolve => setTimeout(() => resolve(`Current sum of stage context: ${overallContext}`), 1000));
}

// Simulated function to fetch stage results
async function getLLMStageResults() {
  return new Promise(resolve => setTimeout(() => resolve(`The players have surmounted the current stage`), 1000));
}

// Simulated function to update history
async function getLLMHistoryUpdate() {
  return new Promise(resolve => setTimeout(() => resolve(`Return updated course history and individual player histories here`), 1000));
}

async function getAdventureResults(courseDescription, courseHistory, playerHistory) {
  return new Promise(resolve => setTimeout(() => resolve(`The end! Imagine a nice final summary with awards and accolades for all`), 500));
}

async function fetchOpenAIResponse(prompt, model, tokens) {
  try {    
    const completion = await openai.chat.completions.create({
      messages: [{"role": "system", "content": courseDescriptionPrompt},
        {"role": "user", "content": prompt}],
      model: model,
      max_tokens: tokens
    });
    console.log(`Response: ${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
    console.log(`Type of content: ${typeof(completion.choices[0].message.content)}`);
    //console.log(`Rest of info ${JSON.stringify(completion.choices)}`);
    return eval('(' + completion.choices[0].message.content + ')');
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return null;
  }
}

/*

Prompt strings

*/

const courseDescriptionPrompt = `
System Prompt:
You are an AI that produces a data structure describing a text-based obstacle course, challenge gauntlet, or other fun experience consisting of multiple stages, for a set of players. Your input will be a list of player id's, a duration, and a theme prompt. Your outputted data structure should look like so:

{
  name: 'Race to Disgrace',
  theme: 'Psychedelic space obstacle course to win a new space-car',
  stages: 5,
  players: ['vimes', 'ghost_tree']
}

{
  name: 'Battle of the Brains',
  theme: 'Computer science knowledge gauntlet to prove technical supremacy',
  stages: 10,
  players: ['telomerase', 'Candelabra2']
}

Assume that each stage takes around 1 minute or less, and set a stage count based on that. Be sure to come up with a witty name!
`;