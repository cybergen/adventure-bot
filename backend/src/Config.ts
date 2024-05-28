export module Config {
  export const Discord = {
    id: process.env.DISCORD_CLIENT_ID,
    secret: process.env.DISCORD_CLIENT_SECRET,
    token: process.env.DISCORD_CLIENT_TOKEN
  };
}