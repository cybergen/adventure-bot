import * as util from 'util';
import { OpenAI } from 'openai';

//models and token sizes to use for different phases
const courseDescriptionModel = "gpt-3.5-turbo";
const courseDescriptionTokens = 512;
const stageChatModel = "gpt-4-turbo-preview";
const stageChatTokens = 512;
const resultSummarizerModel = "gpt-4-turbo-preview";
const resultSummarizerTokens = 832;
const stageHistoryModel = "gpt-3.5-turbo";
const stageHistoryTokens = 512;

export class OpenAIService {

  private readonly _openai = new OpenAI();
  
  public async getLLMCourseDescription(prompt, players) {
    const fullPrompt = prompt + ". The players are " + players.join(', ');
    return await this.fetchOpenAIResponseSingleShot(courseDescriptionSystemPrompt, fullPrompt, courseDescriptionModel, courseDescriptionTokens);
  }

  //Starts a chat completion sequence
  public async getLLMStageDescription(courseContext: object[], courseDescription, courseHistory, playerHistory): Promise<string> {
    const rtnContext = [];
    rtnContext.push({"role":"system","content":stageSystemPrompt});
    
    let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\nCourse History:\n"
      + JSON.stringify(courseHistory) + "\n\nPlayer History:\n" + JSON.stringify(playerHistory);
    return await this.appendToStageChatAndReturnLLMResponse(courseHistory, {"role":"user","content":fullPrompt});
  }

  public async getStageHistory(courseHistory, playerHistory) {
    let fullPrompt = "Now return an updated version of course history and player history in the following format:\n\n"
      + "Course History:\n" + JSON.stringify(courseHistory) + "\n\nPlayer History:\n" + JSON.stringify(playerHistory);
    return await this.appendToStageChatAndReturnLLMResponse(courseHistory, {"role":"user","content":fullPrompt});
  }

  public async getAdventureResults(courseDescription, courseHistory, playerHistory) {
    let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\nCourse History:\n"
      + JSON.stringify(courseHistory) + "\n\nPlayer History:\n";
    for (const history of playerHistory) {
      fullPrompt += JSON.stringify(history) + "\n\n";
    }
    return await this.fetchOpenAIResponseSingleShot(resultSummarizerSystemPrompt, fullPrompt, resultSummarizerModel, resultSummarizerTokens)
  }

  //Continues a chat completion sequence
  public async appendToStageChatAndReturnLLMResponse(stageContext: object[], userMessageObject: object): Promise<string> {
    //First append latest action
    stageContext.push(userMessageObject)

    //Then get openAI response to overall chat
    const response = await this.fetchOpenAIChatResponse(stageContext, stageChatModel, stageChatTokens);

    //Append openAI response to overall chat message set
    stageContext.push({"role":"assistant","content":response});

    //Return the response now
    return response;
  }

  private async fetchOpenAIResponseSingleShot(systemPrompt, prompt, model, tokens) {
    console.log(`\n\n===================SINGLE SHOT NEW MESSAGE INPUT\n\n${prompt}\n`);
    try {
      const completion = await this._openai.chat.completions.create({
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

  private async fetchOpenAIChatResponse(messageHistory, model, tokens) {
    console.log(`\n\n===================CHAT NEW MESSAGE INPUT\n\n${JSON.stringify(messageHistory)}\n`);
    try {
      const completion = await this._openai.chat.completions.create({
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