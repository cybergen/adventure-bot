const { Client, GatewayIntentBits, ReactionCollector, Message } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });

const initialJoinWindow = 6000;
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
    } else if (currentState === "input-stage" && courseDescription.players.includes(message.author.username)) {
      handleAdventureProgress(message.author.username, message.content);
    } else if (currentState !== "idle" && courseDescription.players.includes(message.author.username)) {
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
  const testCourseDescription = {
    name: 'Under the Mountains of Madness',
    theme: 'Grim fantasy dungeon delve to save a sick elf',
    stages: 5,
    players: players
  }

  // Simulated delay
  return new Promise(resolve => setTimeout(() => resolve(testCourseDescription), 1000));
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