const net = require("net");
const RequestParser = require("./RequestParser");

const server = net.createServer((connection) => {
  connection.on("data", (data) => {
    const request = data.toString().trim();
    const parser = new RequestParser(request);
    const command = parser.parse();

    if (command.length > 0 && command[0].toUpperCase() === "ECHO") {
      // If the command is ECHO, echo back the argument
      const echoedString = command[1];
      const response = `$${echoedString.length}\r\n${echoedString}\r\n`;
      connection.write(response);
    } else {
      // If the command is not recognized or not implemented, return "PONG"
      connection.write(`+PONG\r\n`);
    }
  });
});

server.listen(6379, "127.0.0.1");
