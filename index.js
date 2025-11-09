require('dotenv').config();
const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('Omega Bot is alive!'));
app.listen(process.env.PORT || 3000, () => console.log('🌐 Web server running'));

const { Client, GatewayIntentBits, SlashCommandBuilder, Routes, EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
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

// Command definitions
const commandDefs = [
  new SlashCommandBuilder().setName('info').setDescription('Display current server information'),
  new SlashCommandBuilder().setName('userinfo').setDescription('Get detailed info about a user').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('stats').setDescription('Display your stats or another user\'s').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('avatar').setDescription('Show a user\'s avatar').addUserOption(o => o.setName('user').setDescription('Optional user')),
  new SlashCommandBuilder().setName('domains').setDescription('Gets the list of available domains'),
  new SlashCommandBuilder().setName('daily').setDescription('Show the daily leaderboard'),
  new SlashCommandBuilder().setName('check').setDescription('Check if site and dashboard is up.'),
  new SlashCommandBuilder().setName('check-s').setDescription('Check the site only'),
  new SlashCommandBuilder().setName('check-d').setDescription('Check the domain only'),
  new SlashCommandBuilder().setName('site').setDescription('Give an instant dashboard link'),
  new SlashCommandBuilder().setName('support').setDescription('Open support panel (pings support role). 15 minute cooldown.'),
  new SlashCommandBuilder().setName('purge').setDescription('Purge channel messages: number or "all"').addStringOption(o => o.setName('amount').setDescription('Number of messages or "all"').setRequired(true)),
  new SlashCommandBuilder().setName('help').setDescription('List all commands and what they do')
].map(c => c.toJSON());

// Register commands
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

// Helper for HTTP checks
async function httpCheck(url) {
  try {
    const res = await axios.get(url, { timeout: 8000, maxRedirects: 5, validateStatus: null });
    return { ok: true, status: res.status, statusText: res.statusText };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// Handle interactions
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
      return interaction.reply('robiox.com.py');
    }

    if (name === 'daily') {
      const embed = new EmbedBuilder()
        .setTitle('Daily Leaderboard')
        .setDescription('1. <@000000000000000000> — 100 pts\n2. <@000000000000000001> — 80 pts\n3. <@000000000000000002> — 50 pts')
        .setColor(0xFFD700);
      return interaction.reply({ embeds: [embed] });
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

    // ===== Paginated Help =====
    if (name === 'help') {
      const commandsList = [
        { name: '/info', desc: 'Display current server information.' },
        { name: '/userinfo [user]', desc: 'Get detailed information about a user.' },
        { name: '/stats [user]', desc: 'Display your or another user’s stats.' },
        { name: '/avatar [user]', desc: 'Show a user’s avatar.' },
        { name: '/domains', desc: 'Gets the list of available domains.' },
        { name: '/daily', desc: 'Show the daily leaderboard (placeholder).' },
        { name: '/check', desc: 'Checks if the dashboard and site is up.' },
        { name: '/check-s', desc: 'Checks the dashboard.' },
        { name: '/check-d', desc: 'Checks the list of available domains.' },
        { name: '/site', desc: `Sends dashboard link..` },
        { name: '/support', desc: 'Opens support panel, pings role, 15 min cooldown.' },
        { name: '/purge <amount|all>', desc: 'Deletes messages (admin-only).' }
      ];

      const pageSize = 5;
      let page = 0;
      const totalPages = Math.ceil(commandsList.length / pageSize);

      const generateEmbed = (pageIndex) => {
        const start = pageIndex * pageSize;
        const end = start + pageSize;
        const currentCommands = commandsList.slice(start, end);
        return new EmbedBuilder()
          .setTitle('Omega Bot — Commands')
          .setColor(0x00FFAA)
          .setFooter({ text: `Page ${pageIndex + 1} of ${totalPages}` })
          .addFields(currentCommands.map(c => ({ name: c.name, value: c.desc })));
      };

      const row = new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder().setCustomId('prev').setLabel('⬅ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
          new ButtonBuilder().setCustomId('next').setLabel('Next ➡').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
        );

      const reply = await interaction.reply({ embeds: [generateEmbed(page)], components: [row], fetchReply: true });

      const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

      collector.on('collect', async i => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({ content: "You can't control this help menu.", ephemeral: true });
        }
        if (i.customId === 'next') page++;
        if (i.customId === 'prev') page--;
        await i.update({ embeds: [generateEmbed(page)], components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder().setCustomId('prev').setLabel('⬅ Previous').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
              new ButtonBuilder().setCustomId('next').setLabel('Next ➡').setStyle(ButtonStyle.Primary).setDisabled(page === totalPages - 1)
            )
        ]});
      });

      collector.on('end', async () => {
        if (!reply.deleted) {
          const disabledRow = new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder().setCustomId('prev').setLabel('⬅ Previous').setStyle(ButtonStyle.Primary).setDisabled(true),
              new ButtonBuilder().setCustomId('next').setLabel('Next ➡').setStyle(ButtonStyle.Primary).setDisabled(true)
            );
          await reply.edit({ components: [disabledRow] });
        }
      });
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
