require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Omega Bot is alive!'));
app.listen(3000, () => console.log('🌐 Web server running'));

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder } = require('discord.js');
const { REST } = require('@discordjs/rest');
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// --- Bot Setup ---
const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

// --- SQLite Setup ---
const db = new sqlite3.Database('./data/database.sqlite', err => {
    if (err) console.error(err.message);
    else console.log('✅ Connected to SQLite database');
});
db.run(`CREATE TABLE IF NOT EXISTS stats (
    user_id TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    hooked BOOLEAN DEFAULT 0
)`);

// --- Cooldowns ---
const supportCooldown = new Map(); // userId -> timestamp

// --- Slash Commands ---
const commands = [
    new SlashCommandBuilder().setName('info').setDescription('Display current server information'),
    new SlashCommandBuilder().setName('userinfo').setDescription('Get detailed info about a user').addUserOption(o => o.setName('user').setDescription('Optional user')),
    new SlashCommandBuilder().setName('stats').setDescription('Display user stats').addUserOption(o => o.setName('user').setDescription('Optional user')),
    new SlashCommandBuilder().setName('avatar').setDescription('Show a user avatar').addUserOption(o => o.setName('user').setDescription('Optional user')),
    new SlashCommandBuilder().setName('domains').setDescription('List available domains'),
    new SlashCommandBuilder().setName('daily').setDescription('Show the daily leaderboard'),
    new SlashCommandBuilder().setName('check').setDescription('Check if site and domain are online'),
    new SlashCommandBuilder().setName('check-s').setDescription('Check site only'),
    new SlashCommandBuilder().setName('check-d').setDescription('Check domain only'),
    new SlashCommandBuilder().setName('hooked').setDescription('Show if a user is dual-hooked').addUserOption(o => o.setName('user').setDescription('Optional user')),
    new SlashCommandBuilder().setName('site').setDescription('Give an instant dashboard link'),
    new SlashCommandBuilder().setName('support').setDescription('Open support panel (15 min cooldown)'),
    new SlashCommandBuilder().setName('purge').setDescription('Delete a number of messages').addIntegerOption(o => o.setName('amount').setDescription('Number of messages').setRequired(true))
].map(c => c.toJSON());

// --- Register Commands ---
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

// --- Command Handler ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    const user = interaction.user;
    const command = interaction.commandName;

    try {
        switch (command) {
            case 'info':
                {
                    const guild = interaction.guild;
                    const embed = new EmbedBuilder()
                        .setTitle('Server Info')
                        .addFields(
                            { name: 'Name', value: guild.name },
                            { name: 'ID', value: guild.id },
                            { name: 'Members', value: `${guild.memberCount}` },
                            { name: 'Owner', value: `${guild.ownerId}` }
                        ).setColor('Blue');
                    await interaction.reply({ embeds: [embed] });
                }
                break;

            case 'userinfo':
                {
                    const member = interaction.options.getUser('user') || user;
                    const embed = new EmbedBuilder()
                        .setTitle('User Info')
                        .addFields(
                            { name: 'Username', value: member.username },
                            { name: 'ID', value: member.id }
                        ).setColor('Green');
                    await interaction.reply({ embeds: [embed] });
                }
                break;

            case 'avatar':
                {
                    const member = interaction.options.getUser('user') || user;
                    await interaction.reply(member.displayAvatarURL({ dynamic: true, size: 1024 }));
                }
                break;

            case 'support':
                {
                    const now = Date.now();
                    if (supportCooldown.has(user.id) && now - supportCooldown.get(user.id) < 15 * 60 * 1000) {
                        return interaction.reply(`⏱ You are on cooldown! Wait a bit.`);
                    }
                    supportCooldown.set(user.id, now);
                    await interaction.reply(SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}> ${user} needs support!` : `${user} needs support!`);
                }
                break;

            case 'purge':
                {
                    if (!interaction.member.permissions.has('Administrator')) {
                        return interaction.reply('❌ You need Administrator permissions!');
                    }
                    const amount = interaction.options.getInteger('amount');
                    const channel = interaction.channel;
                    const messages = await channel.messages.fetch({ limit: amount });
                    await channel.bulkDelete(messages);
                    await interaction.reply(`✅ Deleted ${messages.size} messages.`);
                }
                break;

            // TODO: Implement remaining commands: stats, daily, domains, check, check-s, check-d, hooked, site
            default:
                await interaction.reply('Command not implemented yet.');
        }
    } catch (err) {
        console.error(err);
        await interaction.reply('❌ An error occurred.');
    }
});

// --- Ready ---
client.once('ready', () => console.log(`✅ Logged in as ${client.user.tag}`));
client.login(TOKEN);
