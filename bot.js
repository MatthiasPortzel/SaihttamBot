/**
    Saihttam, Matthias's Discord bot.
**/

// Global dependencies
const passwords = require('./passwords.json');
// const mysql = require('mysql');

const Discord = require('discord.js');
const Client = new Discord.Client();

// I have a MySql server set up for Saihttam, but it's not currently being used
/*const con = mysql.createConnection({
  host: "localhost",
  user: "SaihttamBot",
  password: passwords.mysql,
  database: "saihttambot",
});

con.connect();
*/

const prefix = "./";

var runOnMessage = [];

function addReacts (message, codePoint, numReacts) {
    if (codePoint - 127462 >= numReacts) {
        return;
    } else {
        message.react(String.fromCodePoint(codePoint)).then(() => {
            addReacts(message, codePoint + 1, numReacts);
        });
    }
}

var commands = [
    {
        command: ["say", "echo"],
        func: function say (message, content) {
            message.channel.send(content);
        },
        args: "<message>",
        help: "Repeats back your message"
    },

    {
        command: ["help"],
        func: function help(message) {
            const helpEmbed = new Discord.RichEmbed({
                author: {
                    name: "Saihttam Help",
                    icon_url: "https://cdn.discordapp.com/avatars/251143910347243531/6613b6866204a95c82781c528da8bf99.jpg?size=64"
                },
                color: 0x377735
            });

            for (let {command: commandArr, args: arguments, help: description, hidden: hidden} of commands) {
                if (hidden) continue;
                helpEmbed.addField(prefix + commandArr[0] + (arguments ? " " + arguments : ""), description, true);
            }

            helpEmbed.addField("\u200B", "*Saihttam is coded and hosted by <@226887818364846082>, and is open source [on Github](https://github.com/MatthiasSaihttam/SaihttamBot).*");

            message.channel.send(helpEmbed);
        },
        hidden: true
    },

    {
        command: ["math"],
        func: function math(message, content) {
            message.channel.send(new Function("return " + (content.replace(/[^0-9+\/\-()*]/g, "")))());
        },
        args: "<expression>",
        help: "Evaluates *expression*"
    },

    {
        command: ["poll", "reactions"],
        func: function poll(message, content) {
            const args = content.split(" ");
            const numReactions = parseInt(args[0] || "2", 10);

            if (Number.isNaN(numReactions)) {
                message.channel.send("Error. Invalid number.");
                return;
            }

            message.channel.fetchMessages({ limit: 2 }).then(messages => messages.entries()).then(messages => {
                messages.next(); //Not the last message (the ./poll)
                const reactMessage = messages.next().value[1]; //But the one before that

                if (reactMessage.author !== message.author) {
                    message.channel.send("Use on your own message. (Right after you've sent a message)");
                    return;
                }

                if (numReactions === 2) {
                    reactMessage.react("\u{1f44d}").then(() => {
                        reactMessage.react("\u{1f44e}").catch(console.error);;
                    }).catch(console.error);
                }else {
                    addReacts(reactMessage, 127462, numReactions);
                }
            })
        },
        args: "<count>",
        help: "Adds *count* reactions to the previous message (so people can vote)"
    },

    {
        command: ["eval"],
        func: function
        eval(message) {
            if (message.author.id != "226887818364846082") {
                message.channel.send("You don't have permission to use this.");
                return;
            }
            try {
               var code = message.content.replace(/^\.\/eval\s*(?:-[a-zA-Z]+)?\s*(?:(?:```\w*[\r\n])|`)?([\s\S]*?)`{0,3}$/, "$1");
               var output = eval(code);

               //If -s flag is added, message is silent and doesn't send a reply automatically.
               var toOutput = !(message.content.match(/^\.\/eval\s*-s/));

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
            }
        },
        hidden: true,
        args: "[-s] <command>",
        help: "eval (for)"
    },
];

function verifyCarets (message) {
    //Verify carets
    if (message.channel.name === "caret") {
        var content = message.content
            .replace(/```(?:\w+\n)?([\s\S]+?)```/g, "$1")
            .replace(/`([\s\S]+?)`/g, "$1")
            .replace(/_([\s\S]+?)_/g, "$1")
            .replace(/\*([\s\S]+?)\*/g, "$1")
            .replace(/~~([\s\S]+?)~~/g, "$1")
        if (content.match(/[^^\uFF3E\s]/) || message.attachments.size || message.embeds.length || message.mentions.length) {
            message.delete();
            return false;
        }
        return true;
    }
}

Client.on('message', (message) => {
    try {
        for (var i = 0; i < runOnMessage.length; i++) {
            try {
                runOnMessage[i](message);
            }catch (e) {
                message.channel.send("```" + e + "```");
                message.channel.send("Run on message function failed. Removing it to save you.");
                runOnMessage.splice(i, 1);
                i--;
            }
        }

        const content = message.content;

        verifyCarets(message);

        if (content.startsWith(prefix)) {
            //Lowercase, starting past the prefix, grab until the first space or to the end of the string
            const commandName = content.toLowerCase().substring(prefix.length, (content.indexOf(" ") +1 || content.length +1) -1)

            const command = commands.find(c => c.command.indexOf(commandName) > -1);

            if (command) {
                //Call the command, remove the prefix, command name, and space
                command.func(message, content.slice((prefix + commandName).length + 1))
            }else {
                message.channel.send("It looks like you may have been trying to use a command. Try `./help`.");
            }
        }
    } catch (e) {
        message.channel.send('Error: ```javascript\n' + e + '```')
    }
})

Client.login(passwords.discord).catch(console.error);

Client.on('ready', () => {
    console.log("Connected to Discord");
    Client.user.setActivity(`for ${prefix}help`, { type: "WATCHING" });
    // Client.user.setAvatar('./images/image.png')
})

Client.on('messageUpdate', (oldMess, newMess) => {
    verifyCarets(newMess);
})

function exitHandler(options, err) {
    Client.destroy();
    // con.end();
    process.exit();
}

process.on('SIGINT', exitHandler);
process.on('exit', exitHandler);
process.on('uncaughtException', exitHandler);
