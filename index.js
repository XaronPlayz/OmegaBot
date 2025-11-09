require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Omega Bot is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Web server running'));

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { REST } = require('@discordjs/rest');
const axios = require('axios');

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID || null;
const DASHBOARD_LINK = 'https://www.logged.tg/auth/omegabeamers';

if (!TOKEN || !CLIENT_ID) {
  console.error('Missing TOKEN or CLIENT_ID env var.');
  process.exit(1);
}

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const supportCooldown = new Map();

const commandDefs = [
  new SlashCommandBuilder().setName('info').setDescription('Display current server information'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Get detailed info about a user').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('stats').setDescription('Display your stats or another user\'s').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('domains').setDescription('Gets the list of available domains'),
  new SlashCommandBuilder().setName('daily').setDescription('Show the daily leaderboard'),
  new SlashCommandBuilder().setName('check').setDescription('Check whether robiox.com.py and the site are online'),
  new SlashCommandBuilder().setName('check-s').setDescription('Check the site only (logged.tg)'),
  new SlashCommandBuilder().setName('check-d').setDescription('Check the domain only (robiox.com.py)'),
  new SlashCommandBuilder().setName('site').setDescription('Give an instant dashboard link'),
  new SlashCommandBuilder().setName('support').setDescription('Open support panel (pings support role). 15 minute cooldown.'),
  new SlashCommandBuilder().setName('purge').setDescription('Purge channel messages: number or "all"').addStringOption(o => o.setName('amount').setDescription('Number of messages or "all"').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('List all commands and what they do')
].map(c => c.toJSON());

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

async function httpCheck(url) {
  try {
    const res = await axios.get(url, { timeout: 8000, maxRedirects: 5, validateStatus: null });
    return { ok: true, status: res.status, statusText: res.statusText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;
  const name = interaction.commandName;
  const user = interaction.user;

  try {
    if (name === 'domains') {
      return interaction.reply('robiox.com.py');
    }

    if (name === 'check') {
      await interaction.deferReply();
      const urls = ['https://robiox.com.py', 'https://www.logged.tg/auth/omegabeamers'];
      let results = '';
      for (const url of urls) {
        const result = await httpCheck(url);
        if (result.ok) results += `✅ ${url} — HTTP ${result.status} (${result.statusText})\n`;
        else results += `❌ ${url} — ${result.error}\n`;
      }
      return interaction.editReply(results);
    }

    if (name === 'check-s') {
      await interaction.deferReply();
      const url = 'https://www.logged.tg/auth/omegabeamers';
      const result = await httpCheck(url);
      if (result.ok) return interaction.editReply(`✅ ${url} — HTTP ${result.status} (${result.statusText})`);
      else return interaction.editReply(`❌ ${url} — ${result.error}`);
    }

    if (name === 'check-d') {
      await interaction.deferReply();
      const url = 'https://robiox.com.py';
      const result = await httpCheck(url);
      if (result.ok) return interaction.editReply(`✅ ${url} — HTTP ${result.status} (${result.statusText})`);
      else return interaction.editReply(`❌ ${url} — ${result.error}`);
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
        .addFields({ name: 'Tutorials', value: '1) Check pinned messages\n2) Read the #welcome channel\n3) Wait for staff to respond' })
        .setColor(0x00AAFF);

      if (SUPPORT_ROLE_ID) {
        await interaction.reply({ content: `<@&${SUPPORT_ROLE_ID}> — ${user} needs support!`, embeds: [embed] });
      } else {
        await interaction.reply({ content: `${user} needs support!`, embeds: [embed] });
      }
      return;
    }

    if (name === 'purge') {
      const perms = interaction.member?.permissions;
      if (!perms || !perms.has(PermissionsBitField.Flags.ManageMessages)) {
        return interaction.reply({ content: '❌ You need Manage Messages permission to use this.', ephemeral: true });
      }
      const amountStr = interaction.options.getString('amount');
      await interaction.deferReply({ ephemeral: true });
      const channel = interaction.channel;
      if (!channel.isTextBased()) return interaction.editReply('❌ Must be used in a text channel.');

      if (amountStr.toLowerCase() === 'all') {
        const fetched = await channel.messages.fetch({ limit: 100 });
        await channel.bulkDelete(fetched, true);
        return interaction.editReply(`✅ Deleted ${fetched.size} messages (up to 100).`);
      } else {
        const n = parseInt(amountStr, 10);
        if (isNaN(n) || n < 1 || n > 100) return interaction.editReply('Enter a number between 1–100 or "all".');
        const fetched = await channel.messages.fetch({ limit: n });
        await channel.bulkDelete(fetched, true);
        return interaction.editReply(`✅ Deleted ${fetched.size} messages.`);
      }
    }

    if (name === 'help') {
      const embed = new EmbedBuilder()
        .setTitle('Omega Bot — Commands')
        .addFields(
          { name: '/info', value: 'Display current server information.' },
          { name: '/userinfo [user]', value: 'Get detailed information about a user.' },
          { name: '/stats [user]', value: 'Display your or another user’s stats.' },
          { name: '/avatar [user]', value: 'Show a user’s avatar.' },
          { name: '/domains', value: 'Gets the list of available domains.' },
          { name: '/daily', value: 'Show the daily leaderboard (placeholder).' },
          { name: '/check', value: 'Checks robiox.com.py and logged.tg/auth/omegabeamers.' },
          { name: '/check-s', value: 'Checks the site only (logged.tg).' },
          { name: '/check-d', value: 'Checks the domain only (robiox.com.py).' },
          { name: '/site', value: `Gives the dashboard link (${DASHBOARD_LINK}).` },
          { name: '/support', value: 'Opens support panel, pings role, 15 min cooldown.' },
          { name: '/purge <amount|all>', value: 'Deletes messages (admin-only).' }
        )
        .setColor(0x00FFAA);
      return interaction.reply({ embeds: [embed] });
    }
  } catch (err) {
    console.error(err);
    try { await interaction.reply({ content: '❌ Error running command.', ephemeral: true }); } catch {}
  }
});

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});
client.login(TOKEN);
