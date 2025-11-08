require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const PREFIX = process.env.PREFIX || "!";
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

// Setup SQLite DB
const db = new sqlite3.Database('./data/database.sqlite', err => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// Ready
client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Message handler
client.on('messageCreate', async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        // ==================== INFO COMMANDS ====================
        if (command === 'info') {
            const guild = message.guild;
            const embed = new EmbedBuilder()
                .setTitle("Server Info")
                .addFields(
                    { name: "Name", value: guild.name },
                    { name: "ID", value: guild.id },
                    { name: "Members", value: `${guild.memberCount}` },
                    { name: "Owner", value: `${guild.ownerId}` }
                ).setColor('Blue');
            message.channel.send({ embeds: [embed] });
        }

        else if (command === 'userinfo') {
            let user = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user || message.author;
            const embed = new EmbedBuilder()
                .setTitle(`${user.username}'s Info`)
                .addFields(
                    { name: "Username", value: user.username },
                    { name: "ID", value: user.id },
                    { name: "Created At", value: user.createdAt.toDateString() }
                ).setColor('Green')
                .setThumbnail(user.displayAvatarURL({ dynamic: true }));
            message.channel.send({ embeds: [embed] });
        }

        else if (command === 'avatar') {
            let user = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user || message.author;
            message.channel.send({ content: `${user.username}'s avatar: ${user.displayAvatarURL({ dynamic: true, size: 1024 })}` });
        }

        // ==================== STATS / DAILY / HOOKED ====================
        else if (command === 'stats') {
            let user = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user || message.author;
            db.get(`SELECT points, messages FROM stats WHERE user_id = ?`, [user.id], (err, row) => {
                if (err) return message.reply("DB error");
                if (!row) return message.reply("No stats found for this user.");
                message.reply(`${user.username}'s Stats: Points: ${row.points}, Messages: ${row.messages}`);
            });
        }

        else if (command === 'daily') {
            db.all(`SELECT user_id, points FROM stats ORDER BY points DESC LIMIT 10`, [], (err, rows) => {
                if (err) return message.reply("DB error");
                if (!rows.length) return message.reply("No leaderboard data.");
                const leaderboard = rows.map((r, i) => `${i + 1}. <@${r.user_id}> - ${r.points} pts`).join("\n");
                message.channel.send(`**Daily Leaderboard:**\n${leaderboard}`);
            });
        }

        else if (command === 'hooked') {
            let user = message.mentions.users.first() || message.guild.members.cache.get(args[0])?.user || message.author;
            db.get(`SELECT hooked FROM stats WHERE user_id = ?`, [user.id], (err, row) => {
                if (err) return message.reply("DB error");
                const status = row && row.hooked ? "Yes" : "No";
                message.reply(`${user.username} dual-hooked? ${status}`);
            });
        }

        // ==================== UTILITY COMMANDS ====================
        else if (command === 'domains') {
            // Example static list
            const domains = ['example.com', 'test.org', 'mydomain.net'];
            message.channel.send(`Available Domains:\n${domains.join('\n')}`);
        }

        else if (command === 'check') {
            // Check both site and domain
            const site = args[0] || 'https://example.com';
            try {
                const res = await axios.get(site);
                message.reply(`${site} is online (status ${res.status})`);
            } catch {
                message.reply(`${site} is offline or unreachable`);
            }
        }

        else if (command === 'check-s') {
            const site = args[0] || 'https://example.com';
            try {
                const res = await axios.get(site);
                message.reply(`Site status: Online (${res.status})`);
            } catch {
                message.reply("Site is offline");
            }
        }

        else if (command === 'check-d') {
            const domain = args[0] || 'example.com';
            try {
                await axios.get(`https://${domain}`);
                message.reply(`Domain status: Online`);
            } catch {
                message.reply(`Domain status: Offline`);
            }
        }

        else if (command === 'site') {
            message.channel.send("Dashboard Link: https://yourdashboard.com");
        }

        else if (command === 'support') {
            if (!SUPPORT_ROLE_ID) return message.reply("Support role not set.");
            const cooldown = 15 * 60 * 1000;
            const last = client.cooldowns?.get(`support_${message.author.id}`) || 0;
            if (Date.now() - last < cooldown) return message.reply("You must wait 15 minutes before using this again.");
            message.channel.send({ content: `<@&${SUPPORT_ROLE_ID}> ${message.author} needs support!` });
            if (!client.cooldowns) client.cooldowns = new Map();
            client.cooldowns.set(`support_${message.author.id}`, Date.now());
        }

        // ==================== MODERATION ====================
        else if (command === 'purge') {
            if (!message.member.permissions.has("ManageMessages")) return message.reply("You can't do that.");
            if (!args[0]) return message.reply("Specify number of messages or 'all'");
            let amount = args[0].toLowerCase() === 'all' ? 100 : parseInt(args[0]);
            if (isNaN(amount) || amount < 1) return message.reply("Invalid number.");
            const messages = await message.channel.messages.fetch({ limit: amount });
            message.channel.bulkDelete(messages, true);
            message.reply(`Deleted ${messages.size} messages`).then(m => setTimeout(() => m.delete(), 5000));
        }

    } catch (err) {
        console.error(err);
        message.reply("An error occurred while executing the command.");
    }
});

client.login(process.env.TOKEN);
