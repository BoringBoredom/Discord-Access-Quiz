const { Client, Intents, MessageEmbed, MessageActionRow, MessageButton } = require("discord.js");
const { writeFileSync } = require("node:fs");

const config = require("./config.json");
const quiz = require("./quiz.json");
const cooldowns = require("./cooldowns.json");

if (config.constructor !== Object) {
    console.log(`CONFIG ERROR: config.json must be an object`);
    process.exit();
}

if (cooldowns.constructor !== Object) {
    console.log(`COOLDOWNS ERROR: cooldowns.json must be an object`);
    process.exit();
}

if (typeof(config.bot_token) !== "string") {
    console.log(`CONFIG ERROR: "bot_token" must be a string`);
    process.exit();
}

const match = /https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)/.exec(config.start_message_url);
if (!match) {
    console.log(`CONFIG ERROR: "start_message_url" is not a valid URL`);
    process.exit();
}

const guild_id = match[1];
const channel_id = match[2];
const message_id = match[3];

if (!Number.isInteger(config.time_limit) || config.time_limit < 1) {
    console.log(`CONFIG ERROR: "time_limit" must be an integer greater than 0`);
    process.exit();
}

if (!Number.isInteger(config.max_wrong_answers) || config.max_wrong_answers < 0) {
    console.log(`CONFIG ERROR: "max_wrong_answers" must be an integer equal to or greater than 0`);
    process.exit();
}

if (!Number.isInteger(config.question_count) || config.question_count < 1) {
    console.log(`CONFIG ERROR: "question_count" must be an integer greater than 0`);
    process.exit();
}

if (!Number.isInteger(config.failure_cooldown) || config.failure_cooldown < 0) {
    console.log(`CONFIG ERROR: "failure_cooldown" must be an integer equal to or greater than 0`);
    process.exit();
}

if (!Number.isInteger(config.cooldown_multiplier) || config.cooldown_multiplier < 1) {
    console.log(`CONFIG ERROR: "cooldown_multiplier" must be an integer greater than 0`);
    process.exit();
}

if (!Array.isArray(quiz)) {
    console.log(`QUIZ ERROR: "quiz.json" must be an array`);
    process.exit();
}

for (const [index, entry] of quiz.entries()) {
    if (entry.constructor !== Object) {
        console.log(`QUIZ ERROR @ index ${index}: entry must be an object`);
        process.exit();
    }

    if (typeof(entry.question) !== "string") {
        console.log(`QUIZ ERROR @ index ${index}: "question" must be a string`);
        process.exit();
    }

    if (typeof(entry.correct) !== "string") {
        console.log(`QUIZ ERROR @ index ${index}: "correct" must be a string`);
        process.exit();
    }

    if (!Array.isArray(entry.wrong)) {
        console.log(`QUIZ ERROR @ index ${index}: "wrong" must be an array`);
        process.exit();
    }

    if (entry.wrong.length < 1 || entry.wrong.length > 4) {
        console.log(`QUIZ ERROR @ index ${index}: "wrong" must contain 1 to 4 strings`);
        process.exit();
    }

    for (const answer of entry.wrong) {
        if (typeof(answer) !== "string") {
            console.log(`QUIZ ERROR @ index ${index}: "wrong" must contain strings only`);
            process.exit();
        }
    }
}

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.DIRECT_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS
    ],
    partials: ["REACTION"]
});

client.once("ready", async () => {
    try {
        var guild = await client.guilds.fetch(guild_id);
    }
    catch {
        console.log(`GUILD ERROR: guild is not accessible`);
        process.exit();
    }
    if (!guild) {
        console.log(`GUILD ERROR: guild is not accessible`);
        process.exit();
    }

    try {
        var channel = await guild.channels.fetch(channel_id);
    }
    catch {
        console.log(`GUILD ERROR: channel is not accessible`);
        process.exit();
    }
    if (!channel) {
        console.log(`GUILD ERROR: channel is not accessible`);
        process.exit();
    }

    try {
        var message = await channel.messages.fetch(message_id);
    }
    catch {
        console.log(`GUILD ERROR: message is not accessible`);
        process.exit();
    }
    if (!message) {
        console.log(`GUILD ERROR: message is not accessible`);
        process.exit();
    }

    if (!guild.me.permissionsIn(channel).has([ "VIEW_CHANNEL" ])) {
        console.log(`PERMISSION ERROR: missing permission "VIEW_CHANNEL"`);
        process.exit();
    }

    if (!guild.me.permissionsIn(channel).has([ "READ_MESSAGE_HISTORY" ])) {
        console.log(`PERMISSION ERROR: missing permission "READ_MESSAGE_HISTORY"`);
        process.exit();
    }

    if (!guild.me.permissions.has([ "MANAGE_ROLES" ])) {
        console.log(`PERMISSION ERROR: missing permission "MANAGE_ROLES"`);
        process.exit();
    }

    if (!config.role_ids.add.trim() && !config.role_ids.remove.trim()) {
        console.log(`CONFIG ERROR: "role_ids.add" and "role_ids.remove" can't be empty at the same time`);
        process.exit();
    }

    if (config.role_ids.add.trim() !== "" && !(await guild.roles.fetch(config.role_ids.add))) {
        console.log(`ROLE ERROR: role to assign does not exist`);
        process.exit();
    }

    if (config.role_ids.remove.trim() !== "" && !(await guild.roles.fetch(config.role_ids.remove))) {
        console.log(`ROLE ERROR: role to remove does not exist`);
        process.exit();
    }

    console.log("ready");
});

client.on("messageReactionAdd", (messageReaction, user) => {
    initiateQuiz(messageReaction, user);
});

client.login(config.bot_token);

const isActive = {};

function getRandomInteger(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);

    return Math.floor(Math.random() * (max - min + 1) + min);
}

function getQuestionMessage(question, timeLimit) {
    let answers = [...question.wrong, question.correct];
    for (let i = answers.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [answers[i], answers[j]] = [answers[j], answers[i]];
    }

    const row = new MessageActionRow();
    let answerString = "";
    let counter = 1;

    for (const answer of answers) {
        answerString += `${counter}: ${answer}\n`;
        row.addComponents(
            new MessageButton()
                .setCustomId(answer)
                .setLabel(counter.toString())
                .setStyle("PRIMARY")
        );
        counter++;
    }

    const currentQuestion = new MessageEmbed()
        .setDescription(question.question + "\n\n" + answerString + "\n\n" + `Ends <t:${Math.round(timeLimit / 1000)}:R>`);

    return { embeds: [currentQuestion], components: [row] };
}

function getFailMessage(cooldown) {
    const embed = new MessageEmbed()
        .setTitle("Quiz failed")
        .setDescription(`Try again <t:${Math.round(cooldown / 1000)}:R>`);

    return { embeds: [embed], components: [] };
}

function getPassMessage(success) {
    if (!success) {
        var message = "However, an error occured while trying to grant you access";
    }
    else {
        var message = "Server access granted";
    }

    const embed = new MessageEmbed()
        .setTitle("Quiz passed")
        .setDescription(message);

    return { embeds: [embed], components: [] };
}

function getCooldownMessage(cooldown) {
    const embed = new MessageEmbed()
        .setTitle("Cooldown active")
        .setDescription(`Try again <t:${Math.round(cooldown / 1000)}:R>`);

    return { embeds: [embed] };
}

async function initiateQuiz(messageReaction, user) {
    if (messageReaction.partial) {
        try {
            messageReaction = await messageReaction.fetch();
        }
        catch (error) {
            return console.error(error);
        }
    }

    if (messageReaction.message.id !== message_id) {
        return;
    }

    if (isActive[user.id]) {
        return;
    }

    const guildMemberRoleManager = (await messageReaction.message.guild.members.fetch(user.id)).roles;

    let alreadyAdded = false;
    let alreadyRemoved = false;

    if (
        config.role_ids.add.trim() &&
        guildMemberRoleManager.cache.some(r => r.id === config.role_ids.add)
    ) {
        alreadyAdded = true;
    }

    if (
        config.role_ids.remove.trim() &&
        !guildMemberRoleManager.cache.some(r => r.id === config.role_ids.remove)
    ) {
        alreadyRemoved = true;
    }

    if (
        (alreadyAdded && alreadyRemoved) ||
        (alreadyAdded && !config.role_ids.remove.trim()) ||
        (alreadyRemoved && !config.role_ids.add.trim())
    ) {
        return;
    }

    const cooldown = cooldowns[user.id]?.timestamp;
    if (cooldown && cooldown > Date.now()) {
        try {
            await user.send(getCooldownMessage(cooldown));
        }
        catch {}
        return;
    }

    const questionIndices = [];
    const length = (config.question_count <= quiz.length) ? config.question_count : quiz.length;
    while (questionIndices.length < length) {
        const index = getRandomInteger(0, quiz.length - 1);
        if (!questionIndices.includes(index)) {
            questionIndices.push(index);
        }
    }

    let currentQuestion = quiz[questionIndices.shift()];
    const timeLimit = Date.now() + config.time_limit * 60000;

    try {
        var quizMessage = await user.send(getQuestionMessage(currentQuestion, timeLimit));
    }
    catch {
        return;
    }

    isActive[user.id] = true;
    let strikes = 0;

    const result = await new Promise((resolve, reject) => {
        const collector = quizMessage.createMessageComponentCollector({ time: config.time_limit * 60000 });

        collector.on("collect", async i => {
            await i.deferUpdate();

            if (i.customId !== currentQuestion.correct) {
                strikes++;
            }

            if (strikes > config.max_wrong_answers) {
                collector.stop();
            }
            else {
                if (questionIndices.length === 0) {
                    return resolve(true);
                }
                else {
                    currentQuestion = quiz[questionIndices.shift()];
                    await quizMessage.edit(getQuestionMessage(currentQuestion, timeLimit));
                }
            }
        });

        collector.on("end", () => {
            return resolve(false);
        });
    });

    delete isActive[user.id];

    if (!result) {
        if (!(user.id in cooldowns)) {
            cooldowns[user.id] = { attempts: 0 };
        }

        const newCooldown = Date.now() + 3600000 * config.failure_cooldown * config.cooldown_multiplier ** cooldowns[user.id].attempts;
        cooldowns[user.id].timestamp = newCooldown;
        cooldowns[user.id].attempts++;

        writeFileSync("cooldowns.json", JSON.stringify(cooldowns, null, 4));

        return quizMessage.edit(getFailMessage(newCooldown));
    }

    delete cooldowns[user.id];
    writeFileSync("cooldowns.json", JSON.stringify(cooldowns, null, 4));

    try {
        if (config.role_ids.add.trim() && !alreadyAdded) {
            await guildMemberRoleManager.add(await messageReaction.message.guild.roles.fetch(config.role_ids.add));
        }

        if (config.role_ids.remove.trim() && !alreadyRemoved) {
            await guildMemberRoleManager.remove(await messageReaction.message.guild.roles.fetch(config.role_ids.remove));
        }
    }
    catch (error) {
        console.error(error);

        return quizMessage.edit(getPassMessage(false));
    }

    return quizMessage.edit(getPassMessage(true));
}