import * as os from 'os';
import * as Koa from 'koa';
import * as Router from 'koa-router';
import * as BodyParser from 'koa-bodyparser';
import { Services } from './services/Services';
import ApiManager from './handlers/ApiManager';
import { createServer as createServerHttp, Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { SystemMessageHandler } from './handlers/SystemMessageHandler';
import { DiscordMessageHandler } from './handlers/DiscordMessageHandler';
import { AdventureMessageHandler } from './handlers/AdventureMessageHandler';
import { Config } from './Config';

(async () => {
  console.log(`Project Endswell -- ${new Date()}`);
  
  // HTTP(s) Server
  console.log(`Configuring server...`);
  const app = new Koa();
  app.use(BodyParser());
  app.use(async (ctx, next) => {
    console.log(ctx.path);
    
    ctx.set('Access-Control-Allow-Origin', '*');
    ctx.set('Access-Control-Allow-Headers', 'Access-Control-Allow-Origin, Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers');
    ctx.set('Access-Control-Allow-Methods', 'GET,HEAD,OPTIONS,POST,PUT');
    ctx.set('X-Server-Location', 'Midguard');
    await next();
  });

  // Socket Server
  const server: HttpServer = createServerHttp(app.callback());
  const socketServer = new Server(server, {
    serveClient: false,
    cors: { origin: '*' }
  });
  
  // Project Endswell
  console.log('Creating services...');
  await Services.initialize(socketServer);

  const apiManager = new ApiManager(os.hostname());
  apiManager.initialize([
    new SystemMessageHandler(apiManager),
    new DiscordMessageHandler(apiManager),
    new AdventureMessageHandler(apiManager)
  ]);

  socketServer.on('connection', (socket) => {
    apiManager.addSocket(socket);
  });
  
  // Health Metrics
  const router = new Router();
  router.all('/health', async (ctx, next) => ctx.status = 200);
  app.use(router.routes());
  app.use(router.allowedMethods());

  server.listen(3000).on('listening', () => {
    console.log('Server ready.');
  });

  const onShutdown = () => {
    server.close();
    Services.Discord.shutdown();
  };

  process.on('exit', onShutdown);
  process.on('SIGINT', onShutdown);
})();


// process.on('uncaughtException', onShutdown);
// process.on('unhandledRejection', onShutdown);