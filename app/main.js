const net = require("net");
const { commands, PONG, OK } = require("./constants/commands");
const { parseInput, encodeOutput } = require("./parser");

const map = new Map();

const server = net.createServer((connection) => {
  connection.on("data", (redisCommand) => {
    const redisCommandInString = Buffer.from(redisCommand).toString();
    console.log(JSON.stringify(redisCommandInString, null, 4));
    // Return the echo string in case of echo command or else Pong
    if (redisCommandInString) {
      const input = parseInput(redisCommandInString); // Convert command string to array of commands
      if (input[0].toLowerCase() === commands.Echo) {
        connection.write(encodeOutput(input[1]));
      } else if (input[0].toLowerCase() === commands.Ping) {
        connection.write(PONG);
      } else if (input[0].toLowerCase() === commands.Set) {
        map.set(input[1], input[2]);
        connection.write(OK);
      } else if (input[0].toLowerCase() === commands.Get) {
        connection.write(encodeOutput(map.get(input[1])));
      }
    } else {
      connection.write(commands.PONG);
    }
  });
});

server.listen(6379, "127.0.0.1");
