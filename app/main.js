const net = require("net");
const RequestParser = require("./RequestParser");

// Uncomment this block to pass the first stage
const server = net.createServer((connection) => {
  // Handle connection
  //Implementing simple Ping -- will handle multiple ping from single client
  connection.on("data", (data) => {
    const request = data.toString().trim();
    const parser = new RequestParser(request);
    const command = parser.parse();

    if (command.length > 0 && command[0] === "ECHO") {
      // If the command is ECHO, echo back the argument
      const echoedString = command[1]; // Assuming the echoed string is the second argument
      connection.write(`$${echoedString.length}\r\n${echoedString}\r\n`);
    } else {
      // If the command is not recognized or not implemented, return "PONG"
      connection.write(`+PONG\r\n`);
    }
  });
});

server.listen(6379, "127.0.0.1");
