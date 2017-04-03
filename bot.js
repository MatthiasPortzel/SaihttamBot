/**
    Saihttam, Matthias's Discord bot. Loosly based on Blaze's Tucker code.
*/

/* MODULES */

// Global dependencies
const Discord = require('discord.js')
const request = require('request')
const Client = new Discord.Client()

var prefix = "./";

var addReacts = function(message, codePoint, numReacts) {
    if (codePoint - 127462 >= numReacts) {
        return;
    } else {
        message.react(String.fromCodePoint(codePoint)).then(() => {
            addReacts(message, codePoint + 1, numReacts);
        });
    }
}

var commands = {
    say(message, content) {
        message.channel.sendMessage(content);
    },

    kanameavailable(message, content) {
        if (!content) {
            message.channel.sendMessage("Must pass in a KA username.");
        } else {
            if (/[^\w.]/.test(content)) {
                message.channel.sendMessage("Your \"username\" contains an invalid character.");
                return;
            }
            var url = "https://www.khanacademy.org/api/internal/user/username_available?username=" + content;
            request(url, function(error, response, body) {
                if (response) {
                    if (!error && response.statusCode === 200) {
                        data = JSON.parse(body);
                        if (data) {
                            message.channel.sendMessage("This username is available! :confetti_ball:");
                        } else {
                            message.channel.sendMessage("That username isn't available. :frowning:");
                        }
                    } else {
                        if (response) {
                            message.channel.sendMessage("\uD83D\uDCE3 I got an error while parsing this command. Please try again. Status Code **" + response.statusCode + "**");
                        }
                    }
                }

            });
        }
    },
    pm(message, content) {
        message.author.sendMessage(content).catch(e => message.channel.sendMessage(content));
    },
    help(message) {
        message.channel.sendMessage('Current Commands:\n```' + prefix + Object.keys(this).join(`, ${prefix}`) + '```');
    },

    lmgtfy(message, content) {
        message.channel.sendMessage('Let me google that for you: <http://lmgtfy.com/?q=' + encodeURIComponent(content) + '>');
    },

    fishfake(message) {
        message.channel.sendMessage('e$fishFake');
    },

    meta(message) {
        message.channel.sendMessage("This is a bot developed by Matthias, based off of Blaze's Tucker" +
            " framework, but modified heavily. It's open source here: https://github.com/MatthiasSaihttam/SaihttamBot.");
    },

    ping(message) {
        message.channel.sendMessage('pong');
    },

    math(message, content) {
        message.channel.sendMessage(new Function("return " + (content.replace(/[^0-9+\/\-()*]/g, "")))());
    },

    reactions (message, content) {
        var args = content.split(" ");
        var leadRole = message.guild.roles.find("name", "Project Lead");
        if (!message.guild || !message.guild.available ||
                ["265512865413201920", "280910237807149056"].indexOf(message.guild.id) === -1 ||
                !leadRole || !message.member.roles.has(leadRole.id)) {
            message.channel.sendMessage("This command is meant to be used by Project Leads on the OurJSEditor server.");
            return;
        }
        if (!["addOne","addNum","remove"].includes(args[0])) {
            message.channel.sendMessage(`Correct usage is:\`\`\`\n`+
                `${prefix}reactions addNum [Message ID] [Num]\n` +
                `${prefix}reactions addOne [Message ID] :[emoji]:\n` +
                `${prefix}reactions remove [Message ID]\n\`\`\``);
            return;
        }
        message.channel.fetchMessage(args[1]).then(reactionMessage => {
            if (reactionMessage) {
                switch (args[0]) {
                    case "addOne":
                        reactionMessage.react(args[2]).catch(() => message.channel.sendMessage("It looks like you provided an invalid emoji"));
                        break;
                    case "addNum":
                        var numReactions = parseInt(args[2], 10);
                        if (Number.isNaN(numReactions)) {
                            message.channel.sendMessage("Please provide a valid number.");
                        }else {
                            addReacts(reactionMessage, 127462, numReactions);
                        }
                        break;
                    case "remove":
                        for (let [emoji, reaction] of reactionMessage.reactions) {
                            if (reaction.me) {
                                reaction.remove(Client.user.id);
                            }
                        }
                        break;
                    default:
                        message.channel.sendMessage("Correct options are `remove`, `addOne`, and `addNum`");
                        break;
                }
            }else {
                //This just jumps us down to the catch. I don't think it will actually ever fire
                throw "Invalid args";
            }
        }).catch(e => {
            message.channel.sendMessage("It looks like you provided an invalid message.");
        });
    },
}

Client.on('message', (message) => {
    try {
        var content = message.content;
        if (content === "e$Fishfake" || content.toLowerCase() === "e$fakefishfake") {
            message.channel.sendMessage(
                ":fishing_pole_and_fish:  |  **" + message.author.username + ", you caught:**:paperclip:! Paid :yen: 0 for casting."
            ).catch(console.error);
        }
        if (content === "c!ping") {
            message.channel.sendMessage("pong");
        }

        if (content.startsWith(prefix)) {
            //Lowercase, starting past the prefix, grab until the first space or to the end of the string
            var commandName = content.toLowerCase().substring(prefix.length, (content.indexOf(" ") +1 || content.length +1) -1)

            if (typeof commands[commandName] === 'function') {
                //Call the command, remove the prefix, command name, and space
                commands[commandName](message, content.slice((prefix + commandName).length + 1))
            }
        }
    } catch (e) {
        message.channel.sendMessage('Error: ```javascript\n' + e + '```')
    }
})

Client.on('ready', () => {
    // Client.user.setGame(prefix + 'help')
    // Client.user.setAvatar('./images/image.png')
})

Client.on('messageDelete', (message) => {
    console.log(`${message.author.username} said ${message.content} in #${message.channel.name}, before deleting it.`);
})

function exitHandler(options, err) {
    Client.destroy();
    console.log("");
    process.exit();
}

process.on('SIGINT', exitHandler);
process.on('exit', exitHandler);
process.on('uncaughtException', exitHandler);

Client.login(require('./token.json')).catch(console.error)
