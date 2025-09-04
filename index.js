require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { Client, Events, GatewayIntentBits, Collection, MessageFlags } = require('discord.js');
const express = require('express');
const connectDB = require('./db/connect.js');
const authRouter = require('./route/user-consent.js');

const app = express();

app.use('/api/v1/auth/redirect', authRouter);

(async () => {
    try {
        await connectDB(process.env.MONGO_URI)
        console.log('Database connection established!')
        
    }
    catch (error) {
        console.error(error)
        process.exit(1)
    }
})()


const token = process.env.DISCORD_TOKEN

//Client instance
const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessagePolls] 
})

client.commands = new Collection()

const foldersPath = path.join(__dirname, 'commands')
const commandFolders = fs.readdirSync(foldersPath)

for (const folder of commandFolders) {
    const commandsPath = path.join(foldersPath, folder)
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file)
        const command = require(filePath)

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command)
        }
        else {
            console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`)
        }
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return
    
    const command = interaction.client.commands.get(interaction.commandName)

    if (!command) {
        console.error(`No command matching ${interaction.commandName} was found.`)
        return
    }

    try {
        await command.execute(interaction)
    }  
    catch (error) {
        console.error(error)
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: `There was an error while executing this command!`, flags: MessageFlags.Ephemeral })
        }
        else {
            await interaction.reply({ content: `There was an error while executing this command!`, flags: MessageFlags.Ephemeral })
        }
    }
})

client.on(Events.ClientReady, readyClient => {
    console.log(`Logged in as ${readyClient.user.tag}.`)
})

try {
    client.login(token)
}
catch (error) {
    console.log(`Token: ${token}`)
    console.error(`Failed: ${error}`)
}

app.listen(3000, console.log('Server listening on port 3000'))