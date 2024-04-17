const { Client, GatewayIntentBits, ReactionCollector, Message } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions] });
const { OpenAI } = require('openai');
const util = require('util');

const openai = new OpenAI();

const initialJoinWindow = 30000;
const stageResponseWindow = 60000;

//possible states
const IDLE_STATE = "idle";
const ACTIVE_STATE = "active";
const POST_STAGE_STATE = "post-stage";
const INPUT_STAGE_STATE = "input-stage";

//overall state tracking
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
let currentStageContext = [];

//models and token sizes to use for different phases
const courseDescriptionModel = "gpt-3.5-turbo";
const courseDescriptionTokens = 512;
const stageChatModel = "gpt-4";
const stageChatTokens = 512;
const resultSummarizerModel = "gpt-4-turbo-preview";
const resultSummarizerTokens = 832;

function resetCourse() {
    currentState = IDLE_STATE;
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

    if (currentState === IDLE_STATE && message.content.startsWith('!adventure')) {
      handleNewAdventure(message);
    } else if (currentState === INPUT_STAGE_STATE && courseDescription?.players?.includes(message.author.username)) {
      handleAdventureProgress(message.author.username, message.content);
    } else if (currentState !== IDLE_STATE && courseDescription?.players?.includes(message.author.username)) {
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
      currentState = ACTIVE_STATE;
      currentStage = 0;
      courseChannel = message.channel;
      runCourse(params, players);
  });
}

async function runCourse(prompt, players) {
  courseDescription = eval('(' + await getLLMCourseDescription(prompt, players) + ')');
  courseChannel.send(`The adventure "${courseDescription.name}" begins with the following brave souls: ${courseDescription.players.join(', ')}`);
  console.log(`DEBUG: Full course info ${JSON.stringify(courseDescription)}`);
  while (currentStage < courseDescription.stages) {
    await startStage();
    currentState = INPUT_STAGE_STATE;
    await delay(stageResponseWindow);
    currentState = POST_STAGE_STATE;
    await endStage();
    currentStage++;
  }
  await endAdventure();
}

async function startStage() {
  currentStageContext = await getLLMStageDescription(courseDescription, courseHistory, playerHistory);
  courseChannel.send(currentStageContext);
}

//Only gets called if we're in state 'stage-input'
async function handleAdventureProgress(player, message) {
  const input = JSON.stringify({
    player: player,
    reply: message
  });  
  const response = await appendToStageChatAndReturnLLMResponse({"role":"user","content":input});
  courseChannel.send(response);
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
client.login(process.env.DISCORD_API_KEY);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/*

LLM Functions

*/

async function getLLMCourseDescription(prompt, players) {
  const fullPrompt = prompt + ". The players are " + players.join(', ');
  return await fetchOpenAIResponseSingleShot(courseDescriptionSystemPrompt, fullPrompt, courseDescriptionModel, courseDescriptionTokens);
}

//Starts a chat completion sequence
async function getLLMStageDescription(courseDescription, courseHistory, playerHistory) {
  let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\nCourse History:\n" 
    + JSON.stringify(courseHistory) + "\n\nPlayer History:\n";
  for (const history of playerHistory) {
    fullPrompt += JSON.stringify(history) + "\n\n";
  }
  currentStageContext.push({"role":"system","content":stageSystemPrompt});
  return await appendToStageChatAndReturnLLMResponse({"role":"user","content":fullPrompt});
}

//Continues a chat completion sequence
async function appendToStageChatAndReturnLLMResponse(userMessageObject) {
  //First append latest action
  currentStageContext.push(userMessageObject);  

  //Then get openAI response to overall chat
  const response = await fetchOpenAIChatResponse(currentStageContext, stageChatModel, stageChatTokens);

  //Append openAI response to overall chat message set
  currentStageContext.push({"role":"assistant","content":response});

  //Return the response now
  return response;
}

async function getAdventureResults(courseDescription, courseHistory, playerHistory) {
  let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\nCourse History:\n" 
    + JSON.stringify(courseHistory) + "\n\nPlayer History:\n";
  for (const history of playerHistory) {
    fullPrompt += JSON.stringify(history) + "\n\n";
  }
  return await fetchOpenAIResponseSingleShot(resultSummarizerSystemPrompt, fullPrompt, resultSummarizerModel, resultSummarizerTokens)
}

async function fetchOpenAIResponseSingleShot(systemPrompt, prompt, model, tokens) {
  try {    
    const completion = await openai.chat.completions.create({
      messages: [{"role": "system", "content": systemPrompt},
        {"role": "user", "content": prompt}],
      model: model,
      max_tokens: tokens
    });
    console.log(`Response: ${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
    console.log(`Type of content: ${typeof(completion.choices[0].message.content)}`);
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return null;
  }
}

async function fetchOpenAIChatResponse(messageHistory, model, tokens) {
  try {    
    const completion = await openai.chat.completions.create({
      messages: messageHistory,
      model: model,
      max_tokens: tokens
    });
    console.log(`Response: ${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
    console.log(`Type of content: ${typeof(completion.choices[0].message.content)}`);
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return null;
  }
}

/*

Prompt strings

*/

const courseDescriptionSystemPrompt = `
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

const stageSystemPrompt = `
You are a fun and sarcastic conversational bot that invents and presents a text-based challenge to a set of players (represented by user id's) and determines an outcome based on how they respond. The challenge is just one of many stages in a larger course. You take as input an overarching theme as well as a set of context info for the current state of the overall course and the players. For instance, some of the players may have already died on a previous stage, handle that (and any attempts to further interact) according to whatever is most entertaining/thematically consistent.

Your initial input will look like so:

Plan:
{
  name: 'Under the Mountains of Madness',
  theme: 'Grim fantasy dungeon delve to save a sick elf',
  stages: 10,
  players: ['vimes', 'ghost_tree']
}

Course History:
[
  'Dungeon entrance encountered in a forest glade',
  'Attacked by a series of spiders',
  'Swinging blade trap across a narrow walkway',
  'Skeletons and a molerat necromancer attack',
  'Soul-eating machine that can dispense a crystal',
]

Player History: 

{
  player_id: 'vimes',
  history: ['Tried and failed to lift a tree on stage 1', 'Executed a perfect backflip to save a friend on stage 3', 'Got a sword and a molerat corpse in stage 4', 'Broke sword in stage 6']
}

{
  player_id: 'ghost_tree',
  history: ['Ran all out in stage 2, becoming exhausted', 'Died to a naked molerat on stage 4']
}

First, you will describe the current challenge stage. Then, the players will respond with their actions, which you can treat as final or prompt for follow-up. When you receive a system message to describe outcome, you will post a text description of what happens to the players. When you receive a subsequent system call to update history, you will update the Course History and Player History objects to include the new results. Please output those history objects (and ONLY those history objects) in the same schema as above.
`;

const resultSummarizerSystemPrompt = `
You are a fun and sarcastic conversational bot that declares the results of an overall challenge course undertaken by a set of players based on a set of input data about the theme, the stages of the course, and some player event/action logs. Depending on the challenge, there may be winners and losers, or they may only involve survival/failure. If appropriate to the theme, it may also make sense to call out consolation prizes or other distinctions among the players.
`;