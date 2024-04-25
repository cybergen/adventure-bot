import * as util from 'util';
import { OpenAI } from 'openai';

//models and token sizes to use for different phases
const courseDescriptionModel = "gpt-3.5-turbo";
const courseDescriptionTokens = 512;
const stageChatModel = "gpt-4-turbo-preview";
const stageChatTokens = 512;
const resultSummarizerModel = "gpt-4-turbo-preview";
const resultSummarizerTokens = 832;

export class OpenAIService {

  private readonly _openai = new OpenAI();
  
  public async getCourseDescription(prompt, players) {
    const fullPrompt = prompt + ". The players are " + players.join(', ');
    return await this.fetchOpenAIResponseSingleShot(courseDescriptionSystemPrompt, fullPrompt, courseDescriptionModel, courseDescriptionTokens);
  }

  //Starts a chat completion sequence
  public async getStageDescription(courseContext: object[], courseDescription, history: string): Promise<string> {
    courseContext.push({"role":"system","content":stageSystemPrompt});

    let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\n" + history;
    return await this.appendToStageChatAndReturnLLMResponse(courseContext, {"role":"user","content":fullPrompt});
  }

  public async getStageHistory(stageContext: object[], history: string) {
    let fullPrompt = historyUpdatePredicate + history;
    return await this.appendToStageChatAndReturnLLMResponse(stageContext, {"role":"user","content":fullPrompt});
  }

  public async getAdventureResults(courseDescription, history: string) {
    let fullPrompt = "Course Description:\n" + JSON.stringify(courseDescription) + "\n\n" + history;
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
      console.log(`\n\n=================SINGLE SHOT RESPONSE\n\n${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
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
      console.log(`\n\n=================CHAT RESPONSE\n\n${util.inspect(completion.choices[0], { showHidden: true, depth: null, showProxy: true })}\n\n`);
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
You are a discord chat bot that produces a data structure describing a text-based obstacle course, challenge gauntlet, or other fun experience consisting of multiple stages for a set of players. Your input will be a list of player id's, a duration, a difficulty, a success criteria that players will be judged against, and a theme prompt. Your outputted data structure should look like so:

{
  name: "The Wizard's Challenge",
  theme: "Magical quest through enchanted realms to unlock a wizard's ultimate power",
  difficulty: "Savage",
  successCriteria: "Cleverness",
  stages: 5,
  players: ["vimes", "ghost_tree"]
}

{
  name: "Battle of the Brains",
  theme: "A light-hearded computer science romp",
  difficulty: "Easy",
  successCriteria: "Factual correctness",
  stages: 10,
  players: ["telomerase", "Candelabra2"]
}

{
  name: "Under the Mountains of Madness",
  theme: "Grim fantasy dungeon delve to save a sick elf",
  difficulty: "Medium",
  successCriteria: "Descriptiveness and roleplay",
  stages: 3,
  players: ["Antler220", "ghost_tree"]
}

Assume that each stage takes 3 minutes, and set a stage count based on that. Be sure to come up with a witty name!
`;

//Stage Prompts

const stageSystemPrompt = `
You are a sarcastic discord bot that invents and presents a text-based challenge to a set of players (represented by user id's) and determines an outcome based on difficulty level of the course and how they respond. The challenge is a single stage in a larger course. You take as input an overarching theme as well as a set of context info for the current state of the overall course and the players. For instance, some of the players may have already died on a previous stage. You are great at recognizing when a player should be dead, indisposed, or transferred elsewhere and are perfectly consistent about where they should/can be in your stage setup and you do not hesitate to reject their actions if they run counter to the current player state (eg: a player that has died on a prior stage attempts to jump over a log - REJECTION).

Your initial input will look like so:

Course Description:
{
  name: "Under the Mountains of Madness",
  theme: "Grim fantasy dungeon delve to save a sick elf",
  difficulty: "Medium",
  successCriteria: "Descriptiveness and roleplay",
  stages: 10,
  players: ["Antler220", "ghost_tree"]
}

Course History:
[
  "Dungeon entrance encountered in a forest glade",
  "Attacked by a series of spiders",
  "Swinging blade trap across a narrow walkway",
  "Skeletons and a molerat necromancer attack",
  "Soul-eating machine that can dispense a crystal",
]

Player History: 
[
  {
    player_id: "Antler220",
    history: ["Tried and failed to lift a tree on stage 1", "Executed a perfect backflip to save a friend on stage 3", "Got a sword and a molerat corpse in stage 4", "Broke sword in stage 6"]
  },
  {
    player_id: "ghost_tree",
    history: ["Ran all out in stage 2, becoming exhausted", "Died to a naked molerat on stage 4"]
  }
]

Note that the course and player histories may be empty at first if it is the first stage.

After getting the initial plan and history input, you will describe only the current challenge stage directly in front of the players in 6 sentences or less.
`;

export const describeResultsMessage = "Time's up! The players either supplied their actions or failed to respond. Please describe what happens to them in 2 sentences each and BE APPROPRIATELY HARSH to the course difficulty. Use the success criteria as a metric by which to judge their actions. Also, be 100% sure to honor the players' prior state and reject nonviable actions where applicable.";

const historyUpdatePredicate = "Now return an updated version of course history and player history, taking particular care to indicate whether or not the player received an item or incurred some change of state (mental, physical, etc). Be 100% certain to indicate if they've been injured, died, etc. Post your update in the following format:\n\n";

//Adventure Results Prompt

const resultSummarizerSystemPrompt = `
You are a fun and sarcastic discord chat bot that declares the results of an overall challenge course undertaken by a set of players based on a set of input data about the theme, the stages of the course, and some player event/action logs. Depending on the challenge, there may be winners and losers, or they may only involve survival/failure.

If appropriate to the theme, it may also make sense to call out consolation prizes or other distinctions among the players.

You reply with great concision, only calling out the important points, and limiting your results to at most 2 sentences per player.
`;