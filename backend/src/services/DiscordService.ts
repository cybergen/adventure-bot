import { Client, GatewayIntentBits } from 'discord.js';
import {
  AudioReceiveStream, createAudioPlayer,
  createAudioResource,
  EndBehaviorType,
  joinVoiceChannel,
  StreamType,
  VoiceConnection
} from '@discordjs/voice';
import { opus } from 'prism-media';
import { Config } from '../Config';
import { KnownError } from '@common/errors/KnownError';
import { compoundKey } from '@common/utils/CompoundKey';
import speech from '@google-cloud/speech';
import textToSpeech from '@google-cloud/text-to-speech';
import { google } from '@google-cloud/text-to-speech/build/protos/protos';
import * as fs from 'fs';
import * as util from 'util';
import AudioEncoding = google.cloud.texttospeech.v1.AudioEncoding;
import SsmlVoiceGender = google.cloud.texttospeech.v1.SsmlVoiceGender;
import * as path from 'path';

const STTClient = new speech.SpeechClient();
const TTSClient = new textToSpeech.TextToSpeechClient();

export class DiscordService {
  
  private _client: Client;
  private readonly _voiceConnections: Record<string, VoiceConnection> = {}; // CompoundKey -> VC
  private readonly _listenStreams: Record<string, {
    receive: AudioReceiveStream,
    decoder: NodeJS.ReadWriteStream,
    recognizer: NodeJS.WritableStream
  }> = {}; // UserId -> Stream
  
  public async initialize() {
    this._client = new Client({ intents: [
        GatewayIntentBits.GuildVoiceStates
        // GatewayIntentBits.Guilds,
        // GatewayIntentBits.GuildMembers
      ]});
    
    this._client.on('ready', async () => {
      console.log('Discord app ready.');
    });
    
    await this._client.login(Config.Discord.token);
  }
  
  public async shutdown() {
    this._client.destroy();
  }
  
  public async joinVoice(guildId: string, channelId: string) {
    const guild = await this._client.guilds.fetch(guildId);
    const connection = this._voiceConnections[compoundKey(guildId, channelId)] = joinVoiceChannel({
      guildId,
      channelId,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false,
      debug: true
    });
    
    // connection.on('stateChange', (oldState, newState) => {
    //   console.log(`Voice ${oldState.status}->${newState.status}`);
    // });
    
    // TODO: Actually await join state change
  }
  
  public async startListening(target: { guildId: string, channelId: string, userId: string }, callback: (text: string) => void) {
    const voice = this._voiceConnections[compoundKey(target.guildId, target.channelId)];
    if (!voice) throw new KnownError(`Attempting to stream voice when no VoiceConnection exists.`);
    
    const audioStream = voice.receiver.subscribe(target.userId, { end: { behavior: EndBehaviorType.Manual }});
    const decoder = new opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });
    const recognizeStream = STTClient.streamingRecognize({
      // TODO: Don't explode on silences that are too long
      config: {
        encoding: 'LINEAR16',
        audioChannelCount: 2,
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        model: 'latest_long',
        profanityFilter: false,
        enableAutomaticPunctuation: true
      },
      interimResults: true,
    })
      .on('error', console.error)
      .on('data', (data: {results: any[]}) => {
        // TODO: Figure out how to get a final result in
        // console.log('DATA ///');
        // for (const result of data.results) {
        //   console.log(result.isFinal, result.alternatives);
        // }

        callback(data.results.map(r => r.alternatives[0].transcript).join(''))
      });

    this._listenStreams[target.userId] = {
      receive: audioStream,
      decoder: decoder,
      recognizer: recognizeStream
    };
    
    audioStream.pipe(decoder).pipe(recognizeStream);
  }
  
  public stopListening(userId: string) {
    const stream = this._listenStreams[userId];
    if (!stream) throw new KnownError(`Attempting to stop listening to a user that wasn't being listened on.`);
    
    stream.receive.destroy();
    stream.decoder.end();
    stream.recognizer.end();
  }
  
  public async readDictation(guildId: string, channelId: string, text: string): Promise<void> {
    const key = compoundKey(guildId, channelId);
    console.log(`[${key}] Generating voice`);

    const [ synthesize ] = await TTSClient.synthesizeSpeech({
      voice: {
        name: 'en-US-Journey-O',
        languageCode: 'en-US',
        ssmlGender: SsmlVoiceGender.FEMALE
      },
      audioConfig: {
        audioEncoding: AudioEncoding.LINEAR16,
        pitch: 0,
        volumeGainDb: 0,
        speakingRate: 3,
        sampleRateHertz: 48000
      },
      input: { text }
    });
    
    // TODO: Do this in memory
    const audioFile = path.join(__dirname, `${key}.pcm`);
    const writeFile = util.promisify(fs.writeFile);
    await writeFile(audioFile, synthesize.audioContent, 'binary');

    const voiceOutput = createAudioResource(fs.createReadStream(audioFile));
    
    console.log(`[${key}] Narrating...`);
    const audioPlayer = createAudioPlayer();
    audioPlayer.on('error', console.error);
    audioPlayer.play(voiceOutput);
    this._voiceConnections[key].subscribe(audioPlayer);
  }
}