require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const sqlite3 = require('sqlite3').verbose();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = process.env.PREFIX || "!";
const SUPPORT_ROLE_ID = process.env.SUPPORT_ROLE_ID;

// SQLite setup
const db = new sqlite3.Database('./data/database.sqlite', (err) => {
    if (err) console.error(err.message);
    else console.log('Connected to SQLite database.');
});

// Auto-create table
db.run(`CREATE TABLE IF NOT EXISTS stats (
    user_id TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    messages INTEGER DEFAULT 0,
    hooked BOOLEAN DEFAULT 0
)`);

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
});

// Message listener
client.on('messageCreate', async message => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        if (command === 'ping') {
            return message.channel.send('Pong!');
        }

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
            return message.channel.send({ embeds: [embed] });
        }

        if (command === 'support') {
            message.channel.send(SUPPORT_ROLE_ID ? `<@&${SUPPORT_ROLE_ID}> ${message.author} needs support!` : `${message.author} needs support!`);
        }

    } catch (err) {
        console.error(err);
        message.reply("An error occurred while executing the command.");
    }
});

client.login(process.env.TOKEN);
