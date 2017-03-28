/**
    Saihttam, Matthias's Discord bot. Loosly based on Blaze's Tucker code.
*/

/* MODULES */

// Global dependencies
const Discord = require('discord.js')
const fs = require('fs')
const request = require('request')
const Client = new Discord.Client()

/* TALKSHOW */
var showing = false
var host = ''
var guests = []
var showtitle = ''
var elapsedseconds = 0

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
    say(message, args) {
        message.channel.sendMessage(args.join(" "));
    },

    KAnameAvailable(message, args) {
        if (!args[0]) {
            message.channel.sendMessage("Must pass in a KA username.");
        } else {
            if (/[^\w.]/.test(args[0])) {
                message.channel.sendMessage("Your \"username\" contains an invalid character.");
                return;
            }
            var url = "https://www.khanacademy.org/api/internal/user/username_available?username=" + args[0];
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
    pm(message, args) {
        message.author.sendMessage(args[0]).catch(e => message.channel.sendMessage(args[0]));
    },
    help(message) {
        message.channel.sendMessage('Current Commands:\n```' + prefix + Object.keys(this).join(`, ${prefix}`) + '```');
    },

    lmgtfy(message, args) {
        message.channel.sendMessage('Let me google that for you: <http://lmgtfy.com/?q=' + encodeURIComponent(args[0]) + '>');
    },

    fishfake(message) {
        message.channel.sendMessage('e$fishFake');
    },

    meta(message, args) {
        message.channel.sendMessage("This is a bot developed by Matthias, based off of Blaze's Tucker" +
            " framework, but modified heavily. It's open source here: https://github.com/MatthiasSaihttam/SaihttamBot.");
    },

    ping(message) {
        message.channel.sendMessage('pong');
    },

    math(message, args) {
        message.channel.sendMessage(new Function("return " + (args[0].replace(/[^0-9+\/\-()*]/g, "")))());
    },

    test2(message) {
        console.log(message.member.displayName);
    },

    addReactions(message, args) {
        if (!message.guild || !message.guild.available || ["265512865413201920", "280910237807149056"].indexOf(message.guild.id) === -1) {
            message.channel.sendMessage("Invalid server");
            return;
        }
        var leadRole = message.guild.roles.find("name", "Project Lead");
        if (leadRole && message.member.roles.has(leadRole.id)) {
            message.channel.fetchMessage(args[1]).then(reactionMessage => {
                if (!reactionMessage || !parseInt(args[0])) {
                    message.channel.sendMessage("Invalid args");
                } else {
                    var numReactions = parseInt(args[0], 10);
                    addReacts(reactionMessage, 127462, numReactions);
                }
            }).catch(e => {
                message.channel.sendMessage("Invalid args");
                console.log(e)
            });
        } else {
            message.channel.sendMessage("Invalid user");
            return;
        }
    },

    addReaction(message, args) {
        if (!message.guild || !message.guild.available || ["265512865413201920", "280910237807149056"].indexOf(message.guild.id) === -1) {
            message.channel.sendMessage("Invalid server");
            return;
        }
        var leadRole = message.guild.roles.find("name", "Project Lead");
        if (leadRole && message.member.roles.has(leadRole.id)) {
            message.channel.fetchMessage(args[1]).then(reactionMessage => {
                if (!reactionMessage) {
                    message.channel.sendMessage("Invalid args");
                } else {
                    reactionMessage.react(args[0]);
                }
            }).catch(e => {
                message.channel.sendMessage("Invalid args");
                console.log(e)
            });
        } else {
            message.channel.sendMessage("Invalid user");
            return;
        }
    },

    removeReactions(message, args) {
        if (!message.guild || !message.guild.available || ["265512865413201920", "280910237807149056"].indexOf(message.guild.id) === -1) {
            message.channel.sendMessage("Invalid server");
            return;
        }
        var leadRole = message.guild.roles.find("name", "Project Lead");
        if (leadRole && message.member.roles.has(leadRole.id)) {
            message.channel.fetchMessage(args[0]).then(reactionMessage => {
                if (!reactionMessage) {
                    message.channel.sendMessage("Invalid args");
                } else {
                    for (let [emoji, reaction] of reactionMessage.reactions) {
                        if (reaction.me) {
                            reaction.remove(Client.user.id).catch(e => {});
                        }
                    }
                }
            }).catch(e => {
                message.channel.sendMessage("Invalid args");
                console.log(e)
            });
        } else {
            message.channel.sendMessage("Invalid user");
            return;
        }
    },
}

Client.on('message', (message) => {
    try {
        var content = message.content;
        var hasAlreadyRunCommand = false
        if (message.content === "e$Fishfake" || message.content.toLowerCase() === "e$fakefishfake") {
            message.channel.sendMessage(
                ":fishing_pole_and_fish:  |  **" + message.author.username + ", you caught:**:paperclip:! Paid :yen: 0 for casting."
            ).catch(console.error);
        }
        if (message.content === "c!ping") {
            message.channel.sendMessage("pong");
        }
        for (var i in commands) {
            if (typeof commands[i] !== 'function') continue
            if (content.toLowerCase().startsWith(prefix + i.toLowerCase())) {
                var args = content.substr((prefix + i).length + 1, content.length).split(" ");
                commands[i](message, args)
                break;
            }
        }
    } catch (e) {
        message.channel.sendMessage('Error: ```javascript\n' + e + '```')
    }
})

Client.on('ready', () => {
    Client.user.setGame(prefix + 'help')
    Client.user.setAvatar('./images/image.png')
})

Client.on('messageDeleted', (message) => {
    console.log("Sup");
    console.log(`${message.author.username} said ${message.cleanContent} in #${message.channel.name}, before deleting it.`);
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
