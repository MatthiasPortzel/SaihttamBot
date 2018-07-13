/**
    Saihttam, Matthias's Discord bot. Loosly based on Blaze's Tucker code.
*/

/* MODULES */

//jshint esversion:6

// Global dependencies
const request = require('request');
const querystring = require('querystring');
var j = request.jar();

const passwords = require('./passwords.json');
const btoa = require("btoa");
const mysql = require('mysql');

const Discord = require('discord.js');
const Client = new Discord.Client();

const con = mysql.createConnection({
  host: "localhost",
  user: "SaihttamBot",
  password: passwords.mysql,
  database: "saihttambot",
});

con.connect();

const prefix = "./";

var runOnMessage = [];

//Login to Khan Academy
var fkey;
var KArequest;

var settings = {
    method: "POST",
    form: {
        identifier: "SaihttamBot",
        password: passwords.khanacademy,
    },
    url: "https://www.khanacademy.org/login",
    jar: j,
};
request(settings, function (error, response, body) {
    if (response && response.statusCode === 200) {
        fkey = j.getCookies("https://www.khanacademy.org").find(c => c.key === "fkey").value;

        KArequest = request.defaults({"baseUrl": "https://www.khanacademy.org", jar: j, headers: { "X-KA-FKEY": fkey }});

        console.log("Logged in to Khan Academy.");

        Client.login(passwords.discord).catch(console.error);
    }else {
        console.log(error || response);
    }
});

var pending_links = [];

function replyCheckLoop () {
    KArequest("/api/internal/user/profile?username=SaihttamBot&projection={\"countBrandNewNotifications\":1}", function (e, r, d) {
        d = JSON.parse(d);

        console.log("Tick, notifs: ", d.countBrandNewNotifications);
        //If there's a notif
        if (d.countBrandNewNotifications > 0) {
            //Check the replies to any pending links.
            for (var i = 0; i < pending_links.length; i++) {

                //Sort by recent--we want the for loop to hit the oldest first
                KArequest(`/api/internal/discussions/${pending_links[i].kaEncryptedId}/replies?sort=2&projection=[{"normal":{"key":1,"content":1,"authorKaid":1,"authorNickname":1}}]&link_index=${i}`, function (error, response, data) {
                    data = JSON.parse(data);

                    if (response && !error && response.statusCode === 200) {
                        var obj = pending_links[parseInt(querystring.parse(response.request.uri.query).link_index)];

                        for (var j = 0; j < data.length; j++) {

                            var reply_data = data[j];

                            if (reply_data.content.includes(obj.verifyToken)) {
                                //Save a link into the database with the discord_id and KAID -
                                con.query(`INSERT INTO user_links (discord_id, kaid) VALUES ('${obj.author.id}', '${reply_data.authorKaid}')`, function (error, results, fields) {
                                    if (error) throw error;

                                    //Send message to the user stating the comment that was made and providing instructions on how to remove it +
                                    obj.author.send(`I've seen a comment from KA user` +
                                        ` ${reply_data.authorNickname} (https://khanacademy.org/profile/${reply_data.authorKaid}) with your reply code, and an account link has been successfully created.`);
                                    obj.author.send("If this is the wrong user, or you want to link a different account, you can remove this link by issuing `./linkkaaccount remove`");

                                    //Kill the timout
                                    clearTimeout(obj.deleteTimer);

                                    //Remove the pending link from the database +
                                    pending_links.splice(obj.index, 1);

                                    //Delete the comment
                                    KArequest.delete(`/api/internal/feedback/${obj.kaEncryptedId}`, function (e, r, d) {
                                        if (r.statusCode !== 200) console.error(e, r, d);
                                    });
                                });
                            }
                        }
                    }
                });
            }

            KArequest.post("/api/internal/user/notifications/clear_brand_new", function (e, r, d) {
                if (!r || r.statusCode !== 200) {
                    console.log(e, r);
                }else {
                    console.log("Read notifs")
                }
            });
        }

        if (pending_links.length > 0) {
            replyCheckLoop();
        }
    });
}

function addReacts (message, codePoint, numReacts) {
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
            var url = "/api/internal/signup/check-username?username=" + content;
            KArequest(url, function(error, response, body) {
                if (response) {
                    if (!error && response.statusCode === 200) {
                        var data = JSON.parse(body);
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

    linkkaaccount(message, content) {
        var args = content.split(" ");

        var discord_id = message.author.id;
        if (args.length && args[0] === "cancel") {
            var index = pending_links.findIndex(l => l.author.id === message.author.id);
            if (index === -1) {
                message.channel.send("You didn't have a pending link request.");
            }else {
                var obj = pending_links.splice(index, 1)[0];

                KArequest.delete(`/api/internal/feedback/${obj.kaEncryptedId}`,
                    (e, r, d) => { if (r.statusCode !== 200) console.log(e, r, d); }
                );

                message.channel.send("Your pending request has been deleted.");
            }
        }else if (args.length && args[0] === "remove") {
            con.query(`DELETE from user_links WHERE discord_id=${message.author.id}`, function (error, results, fields) {
                if (error) throw error;
                if (results.affectedRows) {
                    message.channel.send("KA account link removed successfully.");
                }else {
                    message.channel.send("You don't appear to have a KA account linked with your Discord account.")
                }
            });
        }else if (!args.length || !args[0]) {
            con.query(`SELECT kaid FROM user_links WHERE discord_id="${discord_id}"`, function (error, results, fields) {
                if (error) return console.error(error);

                if (results.length) {
                    message.channel.send(`Your Discord account is already linked to the following KA account: https://khanacademy.org/profile/${results[0].kaid}`);
                    return;
                }

                //Also, check if there's an already pending link.
                if (pending_links.find(l => l.discord_id === message.author.id)) {
                    message.channel.send("You already have a pending link request. Use `./linkkaaccount cancel` to cancel it.");
                    return;
                }

                message.channel.send("I'll PM you instructions on linking your KA account. One second.");

                var settings = {
                    url: "/api/internal/discussions/scratchpad/5118767575367680/comments",
                    method: "POST",
                    json: {
                        text: `If you are Discord user ${message.author.tag}, please comment below with the code I sent you.`,
                        topic_slug :"computer-programming",
                    },
                };
                KArequest(settings, function(error, response, data) {
                    if (response) {
                        if (!error && response.statusCode === 200) {
                            var time = Date.now();
                            //Generate a verification token
                            var verifyToken = btoa(`${discord_id};time;${btoa(Math.round(Math.random()*10000000))}`);
                            //Save link, time, discord_id, and verify_code
                            var link = `https://khanacademy.org${data.focusUrl}?qa_expand_key=${data.expandKey}`;
                            var kaEncryptedId = data.key;

                            var obj = {
                                "time": time,
                                "author": message.author,
                                "index": null,
                                "kaEncryptedId": kaEncryptedId,
                                "verifyToken": verifyToken
                            };

                            obj.index = pending_links.push(obj) - 1;

                            //Send user a message with a link to ther location and their verify code
                            message.author.send("In order to continue linking this Discord account with a KA account, please copy the following verification token.");
                            message.author.send('\u2015'.repeat(20) + "\n" + obj.verifyToken + "\n" + '\u2015'.repeat(20));
                            message.author.send("Please reply to the linked comment that I've created with your token.\n" + link);
                            message.author.send("If you do nothing after 3 minutes, or after you comment with your token, the KA comment will be deleted to protect the privacy of your Discord account.");
                            message.author.send("If you'd like to cancel this request you can reply with `./linkkaaccount cancel`.");

                            //Start a timeout for 3 minutes to delete the comment
                            obj.deleteTimer = setTimeout(function () {
                                KArequest.delete(`/api/internal/feedback/${kaEncryptedId}`, function(e, r, d) {
                                    if (e || r.statusCode !== 200) {
                                        console.error(e, r, d);
                                    }else {
                                        pending_links.splice(obj.index, 1);

                                        message.author.send("Since you haven't replied within 3 minutes, I've deleted my comment and canceled your request.");
                                        message.author.send("If you'd like to link your Discord and KA accounts, you can restart the process by replying with `./linkkaaccount`.");
                                    }
                                });


                            }, 1000 * 60 * 3);

                            //If it's not already running, start an interval to check notifications
                            if (pending_links.length === 1) {
                                replyCheckLoop();
                            }
                        } else {
                            console.log(error, response, data);
                        }
                    }
                });
            });
        }else {
            message.channel.send("Sorry, argument not recognized. Use `./linkkaaccount` in order to link your KA and Discord accounts.")
        }
    },

    bitcoin(message) {
        message.channel.startTyping();
        request("https://blockchain.info/tobtc?currency=USD&value=1", function (error, response, body) {
            if (response) {
                if (!error && response.statusCode === 200) {
                    var data = JSON.parse(body);
                    message.channel.send(`1 Bitcoin is currently worth $${(1/data).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.`);
                } else {
                    if (response) {
                        message.channel.send("\uD83D\uDCE3 I got an error. Please try again later. Status Code **" + response.statusCode + "**");
                    }
                }
                message.channel.stopTyping();
            }
        });
    },

    help(message) {
        message.channel.send('Current Commands:\n```' + prefix + Object.keys(this).join(`, ${prefix}`) + '```');
    },

    lmgtfy(message, content) {
        message.channel.send('Let me google that for you: <http://lmgtfy.com/?q=' + encodeURIComponent(content) + '>');
    },

    about(message) {
        message.channel.send("This is a bot developed by Matthias, based off of Blaze's Tucker" +
            " framework, but modified heavily. It mainly serves to help Matthias and to service the OurJSEditor server. " +
            "It's open source here: https://github.com/MatthiasSaihttam/SaihttamBot.");
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
        }
    },
}

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

        var content = message.content;
        if (content === "e$Fishfake" || content.toLowerCase() === "e$fakefishfake") {
            message.channel.send(
                ":fishing_pole_and_fish:  |  **" + message.author.username + ", you caught:**:paperclip:! Paid :yen: 0 for casting."
            ).catch(console.error);
        }
        if (content === "c!ping") {
            message.channel.send("pong");
        }

        verifyCarets(message);

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
    console.log("Connected to Discord");
    // Client.user.setGame(prefix + 'help')
    // Client.user.setAvatar('./images/image.png')
})

Client.on('messageDelete', (message) => {
    console.log(`${message.author.tag} said ${message.content} in #${message.channel.name}, before it was deleted`);
})

Client.on('messageUpdate', (oldMess, newMess) => {
    verifyCarets(newMess);
})

function exitHandler(options, err) {
    Client.destroy();
    con.end();
    process.exit();
}

process.on('SIGINT', exitHandler);
process.on('exit', exitHandler);
process.on('uncaughtException', exitHandler);
