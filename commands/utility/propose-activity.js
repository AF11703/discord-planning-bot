const { EmbedBuilder, Collection, TextInputBuilder, ModalBuilder, TextInputStyle } = require('discord.js');
const { SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, InteractionCollector, ComponentType, User, MessageFlags, InteractionCallback, Emoji, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const { authorize } = require('../../google/auth');
const { google } = require('googleapis');


/**
 * Checks the availability of a user's calendar.
 * 
 * @param {google.auth.OAuth2} calendar - The authenticated calendar object.
 * @param {import('discord.js').Collection<string, object>} attendees - The Collection of attendees to check availability for.
 * @param {string} date - The date to check availability for.
 * @returns {Promise<string>}
 */
async function grabCalendarData(calendar, attendees, date) {
    const [month, day, year] = date.split('-').map(Number);
    const startTime = new Date(year, month - 1, day);
    const endTime = new Date(year, month - 1, day + 1);
    
    try {
        const response = await calendar.freebusy.query({
            requestBody: {
                timeMin: startTime.toISOString(),
                timeMax: endTime.toISOString(),
                timeZone: 'America/New_York',
                items: attendees.map(attendee => 
                    ({ 
                        id: attendee.email 
                    })
                )
            }
        });

        return response.calendars;
    } catch (error) {
        console.error(`Error checking availability: ${error}`);
        return null;
    }
}

/**
 * Checks if a date string is valid.
 * 
 * @param {string} dateStr - The date string to check.
 * @returns {boolean} - Returns true if the date is valid, false otherwise.
 * */

function isValidDate(dateStr) {
    const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])-\d{4}$/;
    if (!dateRegex.test(dateStr)) {
        return false;
    }
    
    const [month, day, year] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 && date.getDate() === day && date.getFullYear() === year;
};

/**
 * 
 * @param {string} activity - The activity to plan.
 * @param {string} description - The description of the activity.
 * @param {import('discord.js').Collection<string, object>} attendees - The attendees of the activity.
 * @param {Date} date - The date of the activity.
 * 
 * */
function createEventObject(activity, description, attendees, date, activity_duration) {
    const endDate = new Date(date);
    endDate.setHours(endDate.getHours() + activity_duration); 
    return {
        summary: activity,
        description: description,
        start: {
            dateTime: date,
            timeZone: 'America/New_York'
        },
        end: {
            dateTime: endDate,
            timeZone: 'America/New_York'
        },
        attendees: attendees.map(attendee => ({email: attendee.tag})),
        reminders: {
            useDefault: false,
            overrides: [
                {method: 'email', minutes: 24 * 60},
                {method: 'popup', minutes: 10}
            ]
        }
    };
};
module.exports = {
    cooldown: 5,
    data: new SlashCommandBuilder()
        .setName('plan')
        .setDescription('Plans the event that a user specifies.')
        .addStringOption(option =>
            option.setName('activity')
                .setDescription('The event you wish to plan.')
                .setRequired(true)
        )
        .addStringOption(option =>
            option.setName('description')
                .setDescription('Give a description or any extra details regarding the plan here.')
        )
        .addNumberOption(option =>
            option.setName('response_duration')
                .setMinValue(0.1) //0.1 is 6 minutes, 5 would be better but who cares
                .setDescription('Sets amount of time to respond. Time is in hours and default is 6 minutes.')
        )
        .addStringOption(option =>
            option.setName('date')
                .setDescription('Date of the event in MM-DD-YYYY format. If not specified, event will be planned within the week.')
                .setMaxLength(10) //10 is the length of the date format
                
        )
        .addIntegerOption(option =>
            option.setName('activity_duration')
                .setDescription('Duration of the event in hours. Default is 1 hour.')
                .setMaxValue(24)
                .setMinValue(1)
        ),
    


    /**
     * 
     * @param {import('discord.js').ChatInputCommandInteraction} interaction 
     * @var {import('googleapis').calendar} calendar
     */
    async execute(interaction) {    
        try { 
            //In order to avoid 3 second timeout on Discord
            await interaction.deferReply();

            console.log("Authorizing with Google...");  
            const auth = await authorize();
            const calendar = google.calendar({version: 'v3', auth});

            console.log("Getting activities...");
            const activity = interaction.options.getString('activity');
            
            console.log("Getting description...");
            const description = interaction.options.getString('description') || '*No description provided*';
            
            console.log("Getting response duration...");
            const response_duration = interaction.options.getNumber('response_duration') || 0.1;

            console.log("Getting activity duration...");
            const activity_duration = interaction.options.getInteger('activity_duration') || 1;
            
            console.log("Getting date...");
            const userDate = interaction.options.getString('date') || null;
            const date = userDate && isValidDate(userDate) 
                ? userDate 
                : new Date().toLocaleDateString('en-US', {
                    timeZone: 'America/New_York',
                    month: '2-digit',
                    day: '2-digit',
                    year: 'numeric'
                }).slice(0,10);

            console.log("Creating yes button...");
            const yes = new ButtonBuilder()
                .setCustomId('pick_yes')
                .setLabel('Yes')
                .setStyle(ButtonStyle.Success);
            
            
            console.log("Creating no button...");
            const no = new ButtonBuilder()
                .setCustomId('pick_no')
                .setLabel('No')
                .setStyle(ButtonStyle.Danger);

            
            console.log("Attaching buttons to component row...");
            const row = new ActionRowBuilder()
                .addComponents(yes, no);
            
           
            console.log("Trying to send proposition to server...");
            
            await interaction.editReply({
                content: 
                `${interaction.user.tag} is proposing activity: ${activity}\n
                Description: ${description}\n
                Date: ${date}\n 
                Duration: ${activity_duration} hour(s)\n
                Please respond with a button below.\n
                You will no longer be able to respond at ${new Date((Date.now() + (response_duration * 3_600_000))).getTime().toLocaleString('en-US')}`,
                components: [row]
            });
        
            console.log("Creating message collector...");
            const fetchedMessage = await interaction.fetchReply();
            const collector = fetchedMessage.createMessageComponentCollector({componentType: ComponentType.Button, time: response_duration * 3_600_000});

            console.log("Creating responses collection...")
            const responses = new Collection();
            
            collector.on('collect', async i => {
                console.log("Someone interacted with a button...");
                //Event gets called when someone makes a decision
                const selection = i.customId;
                const user = i.user;
                
                if (selection === "pick_yes") {
                    const modal = new ModalBuilder()
                        .setCustomId('emailModal')
                        .setTitle('Email Collection')
                        
                    const emailInput = new TextInputBuilder()
                        .setCustomId('emailInput')
                        .setLabel('Email Address')
                        .setPlaceholder('Enter your email for Google Calendar')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(50);
                    
                    
                    modal.addComponents(new ActionRowBuilder().addComponents(emailInput));
                    

                    await i.showModal(modal);

                    try {
                        const submitted = await i.awaitModalSubmit({
                            time: 60_000,
                            componentType: ComponentType.TextInput,
                            filter: i => i.customId === 'emailModal'
                        });

                        const email = submitted.fields.getTextInputValue('emailInput');

                        responses.set(user.id, {
                            tag: user.tag,
                            email: email,
                            selection: selection
                        });

                        await submitted.reply({
                            content: `Email recorded: ${email}`,
                            flags: MessageFlags.Ephemeral
                        });
                    } catch (error) {
                        console.error(`Error collecting email: ${error}`);
                    }
                } else {
                    responses.set(user.id, {
                        tag: user.tag,
                        selection: selection
                    });
                }


                console.log(`${user.tag} picked ${selection}`);
                
                await i.deferUpdate();
            });

            /**
             * @param {import('discord.js').Collection} responses 
             * 
             */
            collector.on('end', async (responses) => {
                console.log("Entered the end collector function...");
                console.log("Filtering responses for attendees...");
                const attendees = responses.filter(response => response.selection === "pick_yes");
                const nonAttendees = responses.filter(response => response.selection === "pick_no"); 
                
                console.log("Creating Google Calendar event...");
                try {
                    //Filter availabilities here
                    const calendarData = await grabCalendarData(calendar, attendees, date);

                    const createdEvent = calendar.events.insert({
                        calendarId: 'primary',
                        resource: createEventObject(activity, description, attendees, date)
                    });
                    
                    console.log(`Event created: ${createdEvent.data.htmlLink}`);
                } catch (error) {
                    console.error(`There was an error creating the event: ${error}`);
                }

                console.log("Getting list of attendees...");
                const attendeesStr = attendees.map(attendee => attendee.tag).join("\n") || "No attendees";
                const nonAttendeesStr = nonAttendees.map(nonAttendee => nonAttendee.tag).join("\n") || "No non-attendees";
                console.log("Creating embed menu...");
                const menu = new EmbedBuilder()
                    .setAuthor({name: interaction.user.tag})
                    .setDescription(description)
                    .setTitle(`Plan: ${activity}`)
                    .addFields(
                        { name: `Attendees`, value: attendeesStr, inline: true},
                        { name: `Non-Attendees`, value: nonAttendeesStr, inline: true}
                    );
                console.log('Following up interaction with embed...');
                interaction.followUp({
                    embeds: [menu]
                });
                    
            });
        } 
        catch (error) {
            console.error(`Authentication error: ${error}`);
            await interaction.editReply({content: `There was an error while trying to authenticate with Google.`, flags: MessageFlags.Ephemeral});
        }

    },
};