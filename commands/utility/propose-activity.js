const { EmbedBuilder, Collection, TextInputBuilder, ModalBuilder, TextInputStyle, Options, ChatInputCommandInteraction, userMention } = require('discord.js');
const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionCollector, ComponentType, User, MessageFlags, InteractionCallback, Emoji, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { add, format } = require('date-fns')
const express = require('express')

const ONE_MIN_IN_MS = 60_000
const app = express()

app.get('/api', (req, res) => {
    res.send("Placeholder for now")
})

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
                You have ${responseDuration/ONE_MIN_IN_MS} minute(s) to respond.`,
            components: [row]
        })

        const userResponses = new Collection();
        
        const responseCollection = response.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            time: responseDuration
        })

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
                content: `Response recorded... You chose dates:\n ${userDates.join('\n')} on ${format(timeResponded, 'Pp')}`,
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
                    flags: MessageFlags.Ephemeral
                })

                return
            }


            const maxOptions = dateOptions.filter((data) => data.count === dateOptions[0].count)

            if (maxOptions.length == 1) {
                app.listen(3000, () => {
                    console.log("Callback URL clicked")
                })

                //TODO: Setup Google Calendar event build
                const calendarBtn = new ButtonBuilder()
                    .setLabel('Google Calendar')
                    .setStyle(ButtonStyle.Link)
                    .setURL('http://localhost:3000/api')
                const btnRow = new ActionRowBuilder()
                    .addComponents(calendarBtn)
                await interaction.editReply({
                    content: `${activity} has been planned for ${maxOptions[0][0]}.\n 
                    Click below to add event to Google Calendar`,
                    components: [btnRow]
                })
            }
            else {
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
                    content: 'Choose the date to finalize planning',
                    components: [finalSelectRow]
                })
                
                //TODO: Continue response collection for final date selection
                const finalDateCollection = finalDateResponse.createMessageComponentCollector()

                finalDateCollection.on('collect', (selection) => {
                    console.log('collected')
                })
            }
        })

        


        
        
        
    }
}