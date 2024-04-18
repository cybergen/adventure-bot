const { Client, GatewayIntentBits, ReactionCollector, Message } = require('discord.js');
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMembers] });
const { OpenAI } = require('openai');
const util = require('util');

const openai = new OpenAI();

const initialJoinWindow = 30000;
const stageResponseWindow = 120000;
const postStageWindow = 15000;

//possible states
const IDLE_STATE = "idle";
const COLLECTING_STATE = "collecting";
const ACTIVE_STATE = "active";
const POST_STAGE_STATE = "post-stage";
const INPUT_STAGE_STATE = "input-stage";

//overall state tracking
let currentState = IDLE_STATE;
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
const stageChatModel = "gpt-4-turbo-preview";
const stageChatTokens = 512;
const resultSummarizerModel = "gpt-4-turbo-preview";
const resultSummarizerTokens = 832;
const stageHistoryModel = "gpt-3.5-turbo";
const stageHistoryTokens = 512;

//Some commands for the chat bot
const describeResultsMessage = "Time's up!";

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
    } else if (currentState === INPUT_STAGE_STATE && courseDescription?.players?.includes(message.member.displayName)) {
      handleAdventureProgress(message.member.displayName, message.content, message);
    } else if (currentState !== IDLE_STATE && courseDescription?.players?.includes(message.member.displayName)) {
      courseChannel.send("You can only take part in the adventure during challenge stages");
    }
});

async function handleNewAdventure(message) {
  const params = message.content.slice('!adventure'.length).trim();
  if (!params) return message.reply("Please provide a prompt for the adventure including a theme and a duration.");

  currentState = COLLECTING_STATE;
  const initialMessage = await message.channel.send(`*We've got a new adventure starting! "${params}" is starting! React to this message to join the adventure.`);
  const collector = initialMessage.createReactionCollector({ time: initialJoinWindow });

  const displayNames = await new Promise((resolve, reject) => {
    let names = [];

    collector.on('collect', (reaction, user) => {
      console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
    });

    collector.on('end', collected => {
      console.log(`Collected ${collected.size} reactions`);
      // Map over the reactions to get user collections
      Promise.all(collected.map(reaction => 
        reaction.users.fetch().then(users => 
          Promise.all(users.map(user => {
            if (!user.bot) {
              return message.guild.members.fetch(user.id)
                .then(member => member.displayName);
            }
          }))
        )
      )).then(results => {
        // Flatten the results and filter out undefined (from bot checks)
        names = results.flat().filter(name => name !== undefined);
        resolve(names);
      }).catch(reject);
    });
  });

  currentState = ACTIVE_STATE;
  currentStage = 0;
  courseChannel = message.channel;

  if (displayNames.length > 0) {
    runCourse(params, displayNames);
  } else {
    courseChannel.send(`Nobody signed up! Cancelling this adventure, cowards.`);
  }
}

async function runCourse(prompt, players) {
  for (const player of players) {
    playerHistory.push({"player_id":player,"history":[]});
  }

  courseDescription = eval('(' + await getLLMCourseDescription(prompt, players) + ')');
  courseChannel.send(`*The adventure "${courseDescription.name}" begins with the following brave souls: ${courseDescription.players.join(', ')}*`);
  while (currentStage < courseDescription.stages) {
    courseChannel.send(`__**Starting new stage!**__`);
    await startStage();
    currentState = INPUT_STAGE_STATE;
    await delay(stageResponseWindow);
    courseChannel.send(`__**Time's up! Getting stage results!**__`);
    currentState = POST_STAGE_STATE;
    await endStage();
    await delay(postStageWindow);
    currentStage++;
  }
  await endAdventure();
}

async function startStage() {
  console.log(`\n\n==========Sarting stage ${currentStage}`);
  //First clear the overall stage chat sequence
  currentStageContext = [];
  //Then trigger the start of new stage chat completion
  courseChannel.send(await getLLMStageDescription(courseDescription, courseHistory, playerHistory));
}

//Only gets called if we're in state 'stage-input'
async function handleAdventureProgress(player, message, replyable) {
  const input = JSON.stringify({
    player: player,
    reply: message
  });  
  const response = await appendToStageChatAndReturnLLMResponse({"role":"user","content":input});
  replyable.reply({
    content: response,
    allowedMentions: { repliedUser: true }
  }).catch(console.error);
}

async function endStage() {
  courseChannel.send(await appendToStageChatAndReturnLLMResponse({"role":"user","content":describeResultsMessage}));
  const history = await getStageHistory();
  console.log(`Received following history response: ${history}`);

  //Parse history updates from history string
  const sections = history.split(/\n(?=Course History:|Player History:)/);
  courseHistory = parseSection(sections[0].split('Course History:')[1].trim());
  const playerHistoryRaw = sections[1].split('Player History:')[1].trim();

  // Since Player History contains multiple objects, split them and parse each one.
  const playerHistoryObjects = playerHistoryRaw.split(/(?=^{)/);
  playerHistory = playerHistoryObjects.map(obj => parseSection(obj.trim()));
  console.log("Course Description:", courseDescription);
  console.log("Course History:", courseHistory);
  console.log("Player History:", playerHistory);
}

async function endAdventure(channel) {
  courseChannel.send(await getAdventureResults(courseDescription, courseHistory, playerHistory));
  resetCourse();
}

// Login to Discord with your app's token
client.login(process.env.DISCORD_API_KEY);

/*

Helper Functions

*/

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to parse safely using new Function
function parseSection(data) {
  return new Function(`return ${data};`)();
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

async function getStageHistory() {
  const response = await fetchOpenAIChatResponse(currentStageContext, stageHistoryModel, stageHistoryTokens);
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
  console.log(`\n\n===================SINGLE SHOT NEW MESSAGE INPUT\n\n${prompt}\n`);
  try {    
    const completion = await openai.chat.completions.create({
      messages: [{"role": "system", "content": systemPrompt},
        {"role": "user", "content": prompt}],
      model: model,
      max_tokens: tokens
    });
    console.log(`\n\n=================SINGLE SHOT RESPONSE: ${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error querying OpenAI:", error);
    return null;
  }
}

async function fetchOpenAIChatResponse(messageHistory, model, tokens) {
  console.log(`\n\n===================CHAT NEW MESSAGE INPUT\n\n${JSON.stringify(messageHistory)}\n`);
  try {
    const completion = await openai.chat.completions.create({
      messages: messageHistory,
      model: model,
      max_tokens: tokens
    });
    console.log(`\n\n=================CHAT RESPONSE: ${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
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
You are a discord chat bot that produces a data structure describing a text-based obstacle course, challenge gauntlet, or other fun experience consisting of multiple stages, for a set of players. Your input will be a list of player id's, a duration, and a theme prompt. Your outputted data structure should look like so:

{
  name: 'Race to Disgrace',
  theme: 'Psychedelic space obstacle course to win a new space-car',
  stages: 5,
  players: ['vimes', 'ghost_tree']
}

{
  name: 'Battle of the Brains',
  theme: 'Computer science knowledge gauntlet',
  stages: 10,
  players: ['telomerase', 'Candelabra2']
}

Assume that each stage takes around 1 minute or less, and set a stage count based on that. Be sure to come up with a witty name! Escape all necessary characters for easy parsing.
`;

const stageSystemPrompt = `
You are a pithy, sarcastic, and concise discord bot that invents and presents a text-based challenge to a set of players (represented by user id's) and determines an outcome based on how they respond. The challenge is just one of many stages in a larger course. You take as input an overarching theme as well as a set of context info for the current state of the overall course and the players. For instance, some of the players may have already died on a previous stage, handle that (and any attempts to further interact) according to whatever is most entertaining/thematically consistent.

Your initial input will look like so:

Course Description:
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
[
  {
    player_id: 'vimes',
    history: ['Tried and failed to lift a tree on stage 1', 'Executed a perfect backflip to save a friend on stage 3', 'Got a sword and a molerat corpse in stage 4', 'Broke sword in stage 6']
  },
  {
    player_id: 'ghost_tree',
    history: ['Ran all out in stage 2, becoming exhausted', 'Died to a naked molerat on stage 4']
  }
]

Note that the course and player histories may be empty at first if it is the first stage.

After getting the initial plan and history input, you will describe the new challenge stage. Then, the players will respond with their actions, to which you will reply in the your role as a fun and sarcastic discord bot. You will not say the final outcome, however, until you are notified that time is up for that stage. Then you will tell the players the results of their actions.
`;

const historyUpdatePrompt = `
You are a highly capable AI that will receive a block of data with history for a challenge course and several players and a log of activity for the previous stage, then produce an updated version of the course and player history data. Your input will look like so:

Course Description:
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
[
  {
    player_id: 'vimes',
    history: ['Tried and failed to lift a tree on stage 1', 'Executed a perfect backflip to save a friend on stage 3', 'Got a sword and a molerat corpse in stage 4', 'Broke sword in stage 6']
  },
  {
    player_id: 'ghost_tree',
    history: ['Ran all out in stage 2, becoming exhausted', 'Died to a naked molerat on stage 4']
  }
]

Your reply will only include the Course History and Player History segments, formatted in the same schema as above, with up to one addition for each of the players and the overall course, based on the outcome of their last stage. You are extra good at properly escaping characters in the variables to ensure they can be easily parsed.
`;

const resultSummarizerSystemPrompt = `
You are a fun and sarcastic discord chat bot that declares the results of an overall challenge course undertaken by a set of players based on a set of input data about the theme, the stages of the course, and some player event/action logs. Depending on the challenge, there may be winners and losers, or they may only involve survival/failure.

If appropriate to the theme, it may also make sense to call out consolation prizes or other distinctions among the players.

You are extra great at keeping your replies concise, only calling out the important points.
`;