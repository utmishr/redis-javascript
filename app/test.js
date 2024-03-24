const net = require("net");

const HOST = "127.0.0.1";
const PORT = 6379;

// Helper function to create a Redis command string
function createCommand(...args) {
  const commandString = `*${args.length}\r\n`;
  const argsWithLength = args.map(
    (arg) => `$${Buffer.byteLength(arg)}\r\n${arg}\r\n`
  );
  return commandString + argsWithLength.join("");
}

//Parse Response Function
function parseResponse(data) {
  const response = data.toString().trim(); // Trim any leading or trailing whitespace

  // Check the response type
  switch (response[0]) {
    case "+":
      // Simple string reply
      return response.slice(1);
    case "-":
      // Error reply
      return { error: response.slice(1) };
    case ":":
      // Integer reply
      return parseInt(response.slice(1));
    case "$":
      // Bulk string reply
      const lengthEndIndex = response.indexOf("\r\n");
      const length = parseInt(response.slice(1, lengthEndIndex));
      if (length === -1) {
        // Null bulk string
        return null;
      } else {
        // Non-null bulk string
        const contentStartIndex = lengthEndIndex + 2;
        return response.slice(contentStartIndex, contentStartIndex + length);
      }
    case "*":
      // Array reply
      const elements = [];
      let startIndex = 1; // Skip the '*'
      while (startIndex < response.length) {
        // Find the end index of the next element
        const elementEndIndex = response.indexOf("\r\n", startIndex);
        const elementLength = parseInt(
          response.slice(startIndex + 1, elementEndIndex)
        );
        if (elementLength === -1) {
          // Null element
          elements.push(null);
        } else {
          // Non-null element
          const contentStartIndex = elementEndIndex + 2;
          elements.push(
            response.slice(contentStartIndex, contentStartIndex + elementLength)
          );
        }
        // Move to the start of the next element
        startIndex = elementEndIndex + elementLength + 4; // 4 = length of '\r\n'
      }
      return elements;
    default:
      // Unknown response type
      return response;
  }
}

// async function testPingPong() {
//   const client = new net.Socket();

//   client.connect(PORT, HOST, () => {
//     console.log("Connected");

//     const pingCommand = createCommand("PING");
//     client.write(pingCommand);
//   });

//   client.on("data", (data) => {
//     console.log(`Data received: ${data.toString()}`);

//     // Parse the response based on your server's protocol
//     const response = parseResponse(data);
//     if (response === "PONG") {
//       console.log("PING command succeeded");
//     } else {
//       console.error("Unexpected response");
//     }

//     client.destroy(); // Kill the client after getting a response
//   });

//   client.on("error", (err) => {
//     console.error(`Error: ${err}`);
//   });

//   client.on("close", () => {
//     console.log("Connection closed");
//   });
// }

// // Replace this with your own parsing logic based on your server's protocol
// function parseResponse(data) {
//   const response = data.toString();
//   if (response.startsWith("+")) {
//     // Simple string reply
//     return response.slice(1, -2); // Remove the leading '+' and trailing '\r\n'
//   }
//   // Add additional parsing logic for other response types if needed
//   return response;
// }

// // Start the test
// testPingPong();

async function testGetSet() {
  const client = new net.Socket();

  client.connect(PORT, HOST, () => {
    console.log("Connected");

    // Testing SET command
    const setCommand = createCommand("SET", "key1", "value1");
    client.write(setCommand);
  });

  client.on("data", (data) => {
    console.log(`Data received: ${data.toString()}`);

    // Parse the response based on your server's protocol
    const response = parseResponse(data);
    console.log("Response:", response);

    // If the SET command succeeded, send a GET command
    if (response === "OK") {
      const getCommand = createCommand("GET", "key1");
      client.write(getCommand);
    }

    // No need to destroy the client connection here
    // It will be closed after receiving the response to the GET command
  });

  client.on("error", (err) => {
    console.error(`Error: ${err}`);
  });

  client.on("close", () => {
    console.log("Connection closed");
  });
}

// Start the test
testGetSet();
