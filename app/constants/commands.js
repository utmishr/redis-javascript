const PONG = "+PONG\r\n";
const OK = "+OK\r\n";
const commands = {
  Echo: "echo",
  Get: "get",
  Set: "set",
  Ping: "ping",
};

module.exports = {
  PONG,
  commands,
  OK,
};
