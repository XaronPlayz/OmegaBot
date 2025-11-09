require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Omega Bot is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Web server running'));

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { REST } = require('@discordjs/rest');
const axios = require('axios');

// Env
const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID; // optional: set to register commands instantly in a guild
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null;
const DASHBOARD_LINK = 'https://www.logged.tg/auth/omegabeamers';

// Basic validation
if (!TOKEN) {
  console.error('ERROR: TOKEN env var missing.');
  process.exit(1);
}
if (!CLIENT_ID) {
  console.error('ERROR: CLIENT_ID env var missing.');
  process.exit(1);
}

// Client
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Cooldowns
const supportCooldown = new Map(); // userId -> timestamp (ms)

// Command definitions
const commandDefs = [
  new SlashCommandBuilder().setName('info').setDescription('Display current server information'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Get detailed info about a user').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('stats').setDescription('Display your stats or another user\'s').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('domains').setDescription('Return a domain helper (robiox.com.py)'),
  new SlashCommandBuilder().setName('daily').setDescription('Show the daily leaderboard (placeholder)'),
  new SlashCommandBuilder().setName('check').setDescription('Check whether a site and domain are online').addStringOption(o => o.setName('url').setDescription('URL to check, e.g. https://example.com').setRequired(true)),
  new SlashCommandBuilder().setName('check-s').setDescription('Check the site only (HTTP)').addStringOption(o => o.setName('url').setDescription('URL to check, e.g. https://example.com').setRequired(true)),
  new SlashCommandBuilder().setName('check-d').setDescription('Check the domain only (HTTPS)').addStringOption(o => o.setName('domain').setDescription('Domain to check, e.g. example.com').setRequired(true)),
  new SlashCommandBuilder().setName('hooked').setDescription('Show whether a user is dual-hooked (ignored for now)').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('site').setDescription('Give an instant dashboard link'),
  new SlashCommandBuilder().setName('support').setDescription('Open support panel (pings support role). 15 minute cooldown.'),
  new SlashCommandBuilder().setName('purge').setDescription('Purge channel messages: number or "all"').addStringOption(o => o.setName('amount').setDescription('Number of messages or "all"').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('List all commands and what they do')
].map(c => c.toJSON());

// Register commands (guild if GUILD_ID present, else global)
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
  try {
    if (GUILD_ID) {
      console.log('⚡ Registering guild commands...');
      await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commandDefs });
      console.log('✅ Guild commands registered.');
    } else {
      console.log('⚡ Registering global commands...');
      await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commandDefs });
      console.log('✅ Global commands registered.');
    }
  } catch (err) {
    console.error('❌ Command registration error:', err);
  }
})();

// Helper: safe HTTP check
async function httpCheck(url) {
  try {
    const res = await axios.get(url, { timeout: 8000, maxRedirects: 5, validateStatus: null });
    return { ok: true, status: res.status, statusText: res.statusText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Interaction handler
client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const name = interaction.commandName;
  const user = interaction.user;

  try {
    if (name === 'info') {
      const g = interaction.guild;
      if (!g) return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle('Server Info')
        .addFields(
          { name: 'Name', value: g.name || 'Unknown', inline: true },
          { name: 'ID', value: g.id, inline: true },
          { name: 'Members', value: `${g.memberCount}`, inline: true },
          { name: 'Owner ID', value: `${g.ownerId || 'Unknown'}`, inline: true },
          { name: 'Created', value: `${new Date(g.createdTimestamp).toUTCString()}`, inline: true }
        ).setColor(0x1F8B4C);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'userinfo') {
      const target = interaction.options.getUser('user') || user;
      const member = interaction.guild?.members.cache.get(target.id);
      const embed = new EmbedBuilder()
        .setTitle(`${target.username}#${target.discriminator}`)
        .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
          { name: 'User ID', value: target.id, inline: true },
          { name: 'Account Created', value: `${target.createdAt.toUTCString()}`, inline: true },
          { name: 'Joined Server', value: member ? `${member.joinedAt?.toUTCString() || 'Unknown'}` : 'Not in server', inline: true },
          { name: 'Roles', value: member ? (member.roles.cache.filter(r => r.id !== interaction.guild.id).map(r => r.name).slice(0, 10).join(', ') || 'None') : 'N/A' }
        ).setColor(0x0099ff);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'stats') {
      const target = interaction.options.getUser('user') || user;
      // Placeholder stats
      const embed = new EmbedBuilder()
        .setTitle(`${target.username}'s Stats`)
        .addFields(
          { name: 'Points', value: '0', inline: true },
          { name: 'Messages', value: '0', inline: true },
          { name: 'Rank', value: 'Unranked', inline: true }
        ).setColor(0x8A2BE2);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'avatar') {
      const target = interaction.options.getUser('user') || user;
      return interaction.reply({ content: target.displayAvatarURL({ dynamic: true, size: 1024 }) });
    }

    if (name === 'domains') {
      // As requested, /domains sends robiox.com.py
      return interaction.reply('robiox.com.py');
    }

    if (name === 'daily') {
      // Placeholder daily leaderboard
      const embed = new EmbedBuilder()
        .setTitle('Daily Leaderboard')
        .setDescription('1. <@000000000000000000> — 100 pts\n2. <@000000000000000001> — 80 pts\n3. <@000000000000000002> — 50 pts')
        .setColor(0xFFD700);
      return interaction.reply({ embeds: [embed] });
    }

    if (name === 'check' || name === 'check-s' || name === 'check-d') {
      if (name === 'check' || name === 'check-s') {
        const url = interaction.options.getString('url');
        if (!url) return interaction.reply({ content: 'Please provide a URL to check (e.g. https://example.com).', ephemeral: true });
        const normalized = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
        await interaction.deferReply();
        const result = await httpCheck(normalized);
        if (!result.ok) return interaction.editReply(`❌ ${normalized} is unreachable: ${result.error}`);
        return interaction.editReply(`✅ ${normalized} — HTTP ${result.status} (${result.statusText})`);
      } else {
        // check-d: domain only (we will try https://domain)
        const domain = interaction.options.getString('domain');
        if (!domain) return interaction.reply({ content: 'Please provide a domain to check (e.g. example.com).', ephemeral: true });
        const normalized = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
        await interaction.deferReply();
        const result = await httpCheck(normalized);
        if (!result.ok) return interaction.editReply(`❌ ${normalized} is unreachable: ${result.error}`);
        return interaction.editReply(`✅ ${normalized} — HTTP ${result.status} (${result.statusText})`);
      }
    }

    if (name === 'site') {
      return interaction.reply(`Dashboard: ${DASHBOARD_LINK}`);
    }

    if (name === 'support') {
      const now = Date.now();
      const last = supportCooldown.get(user.id) || 0;
      const waitMs = 15 * 60 * 1000;
      if (now - last < waitMs) {
        const remaining = Math.ceil((waitMs - (now - last)) / 1000);
        return interaction.reply({ content: `⏱ You are on cooldown. Try again in ${remaining}s.`, ephemeral: true });
      }
      supportCooldown.set(user.id, now);

      const embed = new EmbedBuilder()
        .setTitle('Support Requested')
        .setDescription(`${user} requested support.`)
        .addFields(
          { name: 'Tutorials', value: '1) Check pinned messages\n2) Read the #welcome channel\n3) If still stuck, wait for staff to respond' }
        )
        .setColor(0x00AAFF);

      if (SUPPORT_ROLE_ID) {
        // send a ping in the channel and the embed
        await interaction.reply({ content: `<@&${SUPPORT_ROLE_ID}> — ${user} needs support!`, embeds: [embed] });
      } else {
        await interaction.reply({ content: `${user} needs support!`, embeds: [embed] });
      }
      return;
    }

    if (name === 'purge') {
      // Admin-only: check ManageMessages
      const memberPerms = interaction.member?.permissions;
      if (!memberPerms || !memberPerms.has(PermissionsBitField.Flags.ManageMessages) && !memberPerms.has(PermissionsBitField.Flags.Administrator)) {
        return interaction.reply({ content: '❌ You need Manage Messages or Administrator to use this.', ephemeral: true });
      }
      const amountStr = interaction.options.getString('amount');
      if (!amountStr) return interaction.reply({ content: 'Provide an amount (number) or "all".', ephemeral: true });

      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel;
      if (!channel || !channel.isTextBased()) return interaction.editReply('❌ This command must be used in a text channel.');

      if (amountStr.toLowerCase() === 'all') {
        // bulk delete up to 100 recent messages (can't delete messages older than 14 days via bulkDelete)
        try {
          const fetched = await channel.messages.fetch({ limit: 100 });
          await channel.bulkDelete(fetched, true);
          return interaction.editReply(`✅ Deleted ${fetched.size} messages (most recent 100).`);
        } catch (err) {
          console.error(err);
          return interaction.editReply('❌ Failed to purge messages.');
        }
      } else {
        const n = parseInt(amountStr, 10);
        if (isNaN(n) || n < 1 || n > 100) return interaction.editReply('Amount must be a number between 1 and 100, or "all".');
        try {
          const fetched = await channel.messages.fetch({ limit: n });
          await channel.bulkDelete(fetched, true);
          return interaction.editReply(`✅ Deleted ${fetched.size} messages.`);
        } catch (err) {
          console.error(err);
          return interaction.editReply('❌ Failed to purge messages.');
        }
      }
    }

    if (name === 'help') {
      const helpEmbed = new EmbedBuilder()
        .setTitle('Omega Bot — Commands')
        .setDescription('Slash commands available:')
        .addFields(
          { name: '/info', value: 'Display current server information.' },
          { name: '/userinfo [user]', value: 'Get detailed information about a user.' },
          { name: '/stats [user]', value: 'Display your stats or another user\'s (placeholder).' },
          { name: '/avatar [user]', value: 'Show a user\'s avatar.' },
          { name: '/domains', value: 'Returns `robiox.com.py` (per request).' },
          { name: '/daily', value: 'Show the daily leaderboard (placeholder).' },
          { name: '/check <url>', value: 'Check whether the site and domain are online.' },
          { name: '/check-s <url>', value: 'Check the site only (HTTP).' },
          { name: '/check-d <domain>', value: 'Check the domain only (HTTPS).' },
          { name: '/site', value: `Get the dashboard link (${DASHBOARD_LINK}).` },
          { name: '/support', value: 'Open support panel. Pings support role (if set). 15 minute cooldown.' },
          { name: '/purge <amount|all>', value: 'Purge messages (Manage Messages required).' }
        ).setColor(0x00FFAA);
      return interaction.reply({ embeds: [helpEmbed] });
    }

    // default
    return interaction.reply({ content: 'Command not implemented.', ephemeral: true });
  } catch (err) {
    console.error('Interaction error:', err);
    try { await interaction.reply({ content: '❌ An error occurred while processing the command.', ephemeral: true }); } catch {}
  }
});

// Ready
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(TOKEN);
