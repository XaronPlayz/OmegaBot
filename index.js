const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Ayumi Bot is alive!'));
app.listen(3000, () => console.log('🌐 Web server running'));
const { Client, GatewayIntentBits, SlashCommandBuilder, Routes } = require('discord.js');
const { REST } = require('@discordjs/rest');
const fs = require('fs');

// Bot setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Environment variables
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

// Known users storage (in-memory for simplicity)
let knownUsers = new Set();
if (fs.existsSync('knownUsers.json')) {
  const data = fs.readFileSync('knownUsers.json', 'utf8');
  knownUsers = new Set(JSON.parse(data));
}

// Define slash commands
const commands = [
  new SlashCommandBuilder()
    .setName('hug')
    .setDescription('Hug someone!')
    .addUserOption(option => option.setName('target').setDescription('User to hug').setRequired(true)),

  new SlashCommandBuilder()
    .setName('kiss')
    .setDescription('Kiss someone!')
    .addUserOption(option => option.setName('target').setDescription('User to kiss').setRequired(true))
].map(cmd => cmd.toJSON());

// Register global commands
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    console.log('⚡ Registering global commands...');
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log('✅ Global commands registered.');
  } catch (err) {
    console.error(err);
  }
})();

// Responses
const hugResponses = ['Awww {user1} is hugging {user2} 🤗', '{user1} gives a warm hug to {user2}!'];
const kissResponses = ['{user1} kisses {user2} 💋', '{user1} blows a kiss to {user2} ❤️'];

// Helper to save known users
function saveKnownUsers() {
  fs.writeFileSync('knownUsers.json', JSON.stringify([...knownUsers]));
}

// Handle commands
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  const user = interaction.user;
  const target = interaction.options.getUser('target');

  // Add both users to known users
  knownUsers.add(user.id);
  if (target) knownUsers.add(target.id);
  saveKnownUsers();

  // Check if command in DM
  if (interaction.channel.type === 1) { // DM
    if (!target) {
      await interaction.reply(`You tried to ${interaction.commandName} yourself! 🤗`);
      return;
    }
    if (knownUsers.has(target.id)) {
      try {
        await target.send(`${user.username} sent you a ${interaction.commandName}! ❤️`);
        await interaction.reply(`✅ ${interaction.commandName} sent to ${target.username} via DM!`);
      } catch (err) {
        await interaction.reply(`❌ Could not DM ${target.username}.`);
      }
    } else {
      await interaction.reply(`❌ ${target.username} is unknown to the bot.`);
    }
    return;
  }

  // Server response
  if (!target) return interaction.reply('❌ You need to mention someone!');
  let responseArray = interaction.commandName === 'hug' ? hugResponses : kissResponses;
  const response = responseArray[Math.floor(Math.random() * responseArray.length)]
    .replace('{user1}', `<@${user.id}>`)
    .replace('{user2}', `<@${target.id}>`);

  await interaction.reply(response);

  // Optional DM to target if known
  if (knownUsers.has(target.id)) {
    try {
      await target.send(`${user.username} sent you a ${interaction.commandName}! ❤️`);
    } catch (err) {
      console.log('Could not DM target user (privacy settings).');
    }
  }
});

// Ready log
client.once('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));
client.login(TOKEN);
