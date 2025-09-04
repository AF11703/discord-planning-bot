const { 
    EmbedBuilder,
    Collection, 
    ChatInputCommandInteraction, 
    userMention,
    SlashCommandBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ActionRowBuilder, 
    InteractionCollector, 
    ComponentType, 
    User, 
    MessageFlags, 
    InteractionCallback, 
    Emoji, 
    StringSelectMenuBuilder, 
    StringSelectMenuOptionBuilder
} = require('discord.js');

const { add, format } = require('date-fns')
//const express = require('express')
const {google} = require('googleapis')
const { getOAuth2Client, getAuthUrl } = require('../../utility/auth')
const { loadUserCredentials, saveUserCredentials } = require('../../utility/db-tasks')


const ONE_MIN_IN_MS = 60_000
//const app = express()


// app.get('/api/v1/auth/redirect', async (req,res) => {
//     try {
//         const {code, state} = req.query
//         console.log(`Code: ${code}`)
//         console.log(`Discord ID: ${state}`)
//         const oAuth2Client = getOAuth2Client()
//         const {tokens} = await oAuth2Client.getToken(code)
//         const {refresh_token} = tokens
//         await saveUserCredentials(state, refresh_token)
//         res.send('Authentication successful, you may now return to Discord')
//     } catch(err) {
//         console.error(err)
//         res.send('An error occurred, please try again later')
//     }
// })

module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('plan')
        .setDescription('Have the bot help you select dates for a planned activity')
        .addStringOption(option =>
            option.setName('plan-name')
                .setDescription('Name of activity to plan')
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option.setName('response-duration')
                .setDescription('OPTIONAL | Time for users to respond to plan in minutes')
                .setRequired(false)
        )
    ,

    /**
     * 
     * @param { ChatInputCommandInteraction } interaction 
     */
    async execute(interaction) {
        await interaction.deferReply()
        //app.listen(3000, console.log('Server listening on port 3000'))

        const dates = []
        for (let addDays = 0; addDays <= 7; addDays++) {
            const date = add(new Date(), {
                days: addDays
            })

            const dateStr = format(date, 'EE, MMM/dd/yyyy')
            dates.push(dateStr)
        }

        console.log(dates)

        const select = new StringSelectMenuBuilder()
            .setCustomId('date-select')
            .setPlaceholder('Select dates that work best')
            .setMaxValues(7)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[0])
                    .setValue(dates[0]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[1])
                    .setValue(dates[1]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[2])
                    .setValue(dates[2]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[3])
                    .setValue(dates[3]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[4])
                    .setValue(dates[4]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[5])
                    .setValue(dates[5]),

                new StringSelectMenuOptionBuilder()
                    .setLabel(dates[6])
                    .setValue(dates[6]),
            )


        const row = new ActionRowBuilder()
            .addComponents(select)

        //Looks ugly, but just transforms user input into ms or uses one minute in ms
        //i.e. if user puts two mins => 120_000 ms.. if user puts 0 or less, automatically default to one minute
        const responseDuration =
            interaction.options.getInteger('response-duration') > 0 ? interaction.options.getInteger('response-duration') * ONE_MIN_IN_MS : ONE_MIN_IN_MS
        const activity = interaction.options.getString('plan-name')

        const response = await interaction.editReply({
            content: `${interaction.user.tag} wants to plan: ${activity}\n
                You have ${responseDuration / ONE_MIN_IN_MS} minute(s) to respond.`,
            components: [row]
        })

        const userResponses = new Collection();

        const responseCollection = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: responseDuration
        })

        const getFinalOption = new Promise((resolve) => {
            responseCollection.on('collect', async (selection) => {
                const userId = selection.user.id
                const userTag = selection.user.tag
                const userDates = selection.values
                const timeResponded = new Date()

                userResponses.set(userId, {
                    tag: userTag,
                    dates: userDates,
                    response_time: timeResponded
                })
                await selection.reply({
                    content: `Response recorded... You chose date(s):\n ${userDates.join('\n')} on ${format(timeResponded, 'Pp')}`,
                    flags: MessageFlags.Ephemeral,
                    components: []
                })
            })


            responseCollection.on('end', async () => {
                const datesCollection = new Collection()

                dates.forEach((date) => {
                    datesCollection.set(date, {
                        count: 0,
                        users: []
                    })
                })

                for (const [userId, userData] of userResponses) {
                    userData.dates.forEach((date) => {
                        const data = datesCollection.get(date)
                        if (data) {
                            data.count++
                            data.users.push(userId)
                        }
                    })
                }


                const dateOptions = [...datesCollection.filter((data) => data.count > 0)
                    .sort((dataA, dataB) => dataB.count - dataA.count)]


                if (!dateOptions) {
                    await interaction.editReply({
                        content: 'No response recorded to the /plan command. Please try again.',
                        flags: MessageFlags.Ephemeral,
                        components: []
                    })

                    resolve(null)
                    return
                }


                const maxOptions = dateOptions.filter((data) => data.count === dateOptions[0].count)

                if (maxOptions.length > 1) {
                    const finalizeDateSelect = new StringSelectMenuBuilder()
                        .setCustomId('maxDate-select')
                        .setPlaceholder('Finalize date selection')
                        .setMinValues(1)
                        .setMaxValues(1)
                        .addOptions(
                            maxOptions.map((obj) => new StringSelectMenuOptionBuilder()
                                .setLabel(obj[0])
                                .setValue(obj[0])
                            )
                        )

                    const finalSelectRow = new ActionRowBuilder()
                        .addComponents(finalizeDateSelect)
                    const finalDateResponse = await interaction.editReply({
                        content: `${userMention(interaction.user.id)}, choose a date to finalize planning`,
                        components: [finalSelectRow],
                        flags: MessageFlags.Ephemeral
                    })

                    
                    const finalDateCollection = finalDateResponse.createMessageComponentCollector({
                        componentType: ComponentType.StringSelect,
                        time: responseDuration
                    })
                    const maxDateResponses = new Collection()

                    finalDateCollection.on('collect', async (selection) => {
                        const userId = selection.user.id
                        const userTag = selection.user.tag
                        const userDate = selection.values
                        const timeResponded = new Date()

                        maxDateResponses.set(userId, {
                            tag: userTag,
                            dates: userDate,
                            response_time: timeResponded
                        })

                        await selection.reply({
                            content: `Response recorded... You chose:\n ${userDate} on ${format(timeResponded, 'Pp')}`,
                            flags: MessageFlags.Ephemeral,
                            components: []
                        })
                    })


                    finalDateCollection.on('end', async () => {
                        const maxDatesCollection = new Collection()

                        dates.forEach((date) => {
                            maxDatesCollection.set(date, {
                                count: 0,
                                users: []
                            })
                        })

                        for (const [userId, userData] of maxDateResponses) {
                            userData.dates.forEach((date) => {
                                const data = maxDatesCollection.get(date)
                                if (data) {
                                    data.count++
                                    data.users.push(userId)
                                }
                            })
                        }

                        const finalDate = (maxDatesCollection.filter((data) => data.count > 0)
                            .sort((dataA, dataB) => dataB.count - dataA.count)).firstKey()
                        resolve(finalDate)
                    })

                }
                else {
                    resolve(maxOptions[0][0])
                }
            })
        })

        const finalOption = await getFinalOption

        //TODO: Make nicer to look at (Use Embeds perhaps).
        if(finalOption) {
            const gCalBtn = new ButtonBuilder()
                .setCustomId('google-cal')
                .setStyle(ButtonStyle.Primary)
                .setLabel('Add to Google Calendar')

            const row = new ActionRowBuilder()
                .setComponents(gCalBtn)

            const buttonFollowUp = await interaction.followUp({
                content: `${activity} has been planned for ${finalOption}.`,
                components: [row]
            })

            const buttonResponse = buttonFollowUp.createMessageComponentCollector({
                componentType: ComponentType.Button   
            })

            buttonResponse.on('collect', async (buttonInteraction) => {
                const userId = buttonInteraction.user.id
                const userAuth = await loadUserCredentials(userId)

                if (!userAuth) {
                    const authUrl = getAuthUrl(userId)
                    await buttonInteraction.reply({
                        content: `You need to authenticate with Google Calendar first. [Authenticate here](${authUrl})`,
                        flags: MessageFlags.Ephemeral
                    })
                    return
                }

                const calendar = google.calendar({version: 'v3', auth: userAuth})
                //TODO: Make event nicer and more detailed.
                const event = { 
                    summary: activity,
                    location: ' ',
                    description: ' ',
                    start: {
                        dateTime: new Date(finalOption).toISOString(),
                        timeZone: 'America/New_York'
                    },
                    end: {
                        dateTime: new Date(new Date(finalOption).getTime() + 60 * 60 * 1000).toISOString(),
                        timeZone: 'America/New_York'
                    }
                }
                try {
                    const response = await calendar.events.insert({
                        calendarId: 'primary',
                        resource: event
                    })

                    //console.log(response)
                    await buttonInteraction.reply({
                        content: `Event added to your Google Calendar. [View Event](${response.data.htmlLink})`,
                        flags: MessageFlags.Ephemeral
                    })
                } catch (err) {
                    console.error(err)
                    await buttonInteraction.reply({
                        content: 'There was an error adding event to Google Calendar',
                        flags: MessageFlags.Ephemeral
                    })
                }
            })
        }
        else {
            await interaction.followUp({
                content: 'Something went wrong, please try again...'
            })
        }
    }
}