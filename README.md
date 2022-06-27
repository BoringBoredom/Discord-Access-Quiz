# [DOWNLOAD](https://github.com/BoringBoredom/Discord-Access-Quiz/archive/refs/heads/main.zip)
# How does it work?
  - The bot waits for reactions to the user-defined message and initiates a user-defined quiz through DM with people who reacted. If they pass, a user-defined role will be assigned / removed or both. If they fail, an optional cooldown will be applied.
# Prerequisites
  - [Node.js](https://nodejs.org/en/download/current/)
# Dependencies
  - Open the command line in the folder containing ***app.js*** and type ***npm install***. This will download the required [discord.js](https://github.com/discordjs/discord.js) files.
# config.json
  - ## bot_token (string)
    [discord bot token](https://discord.com/developers/docs/getting-started#creating-an-app)
  - ## start_message_url (string)
    [URL of the message that initiates the quiz](https://www.worldanvil.com/w/hacks-and-help-shyredfox/a/how-to-get-the-link-to-a-specific-post-in-discord-article)
  - ## time_limit (integer)
    minutes
  - ## max_wrong_answers (integer)
  - ## question_count (integer)
    number of questions to fetch at random from ***quiz.json***
  - ## failure_cooldown (integer)
    hours
  - ## cooldown_multiplier (integer)
    e.g. 2: each failed attempt doubles the cooldown
  - ## [role_ids](https://discordhelp.net/role-id)
    - ### add (string)
      ID of role to assign after completion
    - ### remove (string)
      ID of role to remove after completion
# quiz.json
  - infinite number of questions
  - 1 correct answer per question
  - 1 to 4 incorrect answers per question
  - positions are randomized
# Starting the bot
  - Open the command line in the folder containing ***app.js*** and type ***node app.js***