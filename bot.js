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
        message.channel.send(content);
    },

    kanameavailable(message, content) {
        if (!content) {
            message.channel.send("Must pass in a KA username.");
        } else {
            if (/[^\w.]/.test(content)) {
                message.channel.send("Your \"username\" contains an invalid character.");
                return;
            }
            var url = "https://www.khanacademy.org/api/internal/user/username_available?username=" + content;
            request(url, function(error, response, body) {
                if (response) {
                    if (!error && response.statusCode === 200) {
                        data = JSON.parse(body);
                        if (data) {
                            message.channel.send("This username is available! :confetti_ball:");
                        } else {
                            message.channel.send("That username isn't available. :frowning:");
                        }
                    } else {
                        if (response) {
                            message.channel.send("\uD83D\uDCE3 I got an error while parsing this command. Please try again. Status Code **" + response.statusCode + "**");
                        }
                    }
                }

            });
        }
    },
    pm(message, content) {
        message.author.send(content).catch(e => message.channel.send(content));
    },
    help(message) {
        message.channel.send('Current Commands:\n```' + prefix + Object.keys(this).join(`, ${prefix}`) + '```');
    },

    lmgtfy(message, content) {
        message.channel.send('Let me google that for you: <http://lmgtfy.com/?q=' + encodeURIComponent(content) + '>');
    },

    meta(message) {
        message.channel.send("This is a bot developed by Matthias, based off of Blaze's Tucker" +
            " framework, but modified heavily. It's open source here: https://github.com/MatthiasSaihttam/SaihttamBot.");
    },

    ping(message) {
        message.channel.send('pong');
    },

    math(message, content) {
        message.channel.send(new Function("return " + (content.replace(/[^0-9+\/\-()*]/g, "")))());
    },

    reactions (message, content) {
        var args = content.split(" ");
        var leadRole = message.guild.roles.find("name", "Project Lead");
        if (!message.guild || !message.guild.available ||
                ["265512865413201920", "280910237807149056"].indexOf(message.guild.id) === -1 ||
                !leadRole || !message.member.roles.has(leadRole.id)) {
            message.channel.send("This command is meant to be used by Project Leads on the OurJSEditor server.");
            return;
        }
        if (!["addOne","addNum","remove"].includes(args[0])) {
            message.channel.send(`Correct usage is:\`\`\`\n`+
                `${prefix}reactions addNum [Message ID] [Num]\n` +
                `${prefix}reactions addOne [Message ID] :[emoji]:\n` +
                `${prefix}reactions remove [Message ID]\n\`\`\``);
            return;
        }
        message.channel.fetchMessage(args[1]).then(reactionMessage => {
            if (reactionMessage) {
                switch (args[0]) {
                    case "addOne":
                        reactionMessage.react(args[2]).catch(() => message.channel.send("It looks like you provided an invalid emoji"));
                        break;
                    case "addNum":
                        var numReactions = parseInt(args[2], 10);
                        if (Number.isNaN(numReactions)) {
                            message.channel.send("Please provide a valid number.");
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
                        message.channel.send("Correct options are `remove`, `addOne`, and `addNum`");
                        break;
                }
            }else {
                //This just jumps us down to the catch. I don't think it will actually ever fire
                throw "Invalid args";
            }
        }).catch(e => {
            message.channel.send("It looks like you provided an invalid message.");
        });
    },

    eval(message) {
        if (message.author.id != "226887818364846082") {
            message.channel.send("You don't have permission to use this.");
            return;
        }
        try {
           var code = message.content.replace(/^\.\/eval\s*(?:-[a-zA-Z]+)?\s*(?:(?:```\w*[\r\n])|`)?([\s\S]*?)`{0,3}$/, "$1");
           var output = eval(code);

           //If -s flag is added, message is silent and doesn't send a reply automatically.
           var toOutput = !(message.content.match(/^\.\/eval\s*-[r]?s/));

           if (toOutput) {
              if (output instanceof Promise) {
                 output.then(a => message.channel.send("```" + a + "```")).catch(e => {
                    message.channel.send("Failed with error\n```" + e + "```\nFull data printed to console.");
                    console.log(e);
                 });
              }else {
                 message.channel.send("```" + output + "```");
              }
           }
        }catch(e) {
           message.channel.send("```" + e + "```");
           console.log(code);
        }
    },
}

Client.on('message', (message) => {
    try {
        var content = message.content;
        if (content === "e$Fishfake" || content.toLowerCase() === "e$fakefishfake") {
            message.channel.send(
                ":fishing_pole_and_fish:  |  **" + message.author.username + ", you caught:**:paperclip:! Paid :yen: 0 for casting."
            ).catch(console.error);
        }
        if (content === "c!ping") {
            message.channel.send("pong");
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
        message.channel.send('Error: ```javascript\n' + e + '```')
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
