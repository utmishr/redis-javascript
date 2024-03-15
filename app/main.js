const MasterServer = require("./MasterServer");
const HOST = "127.0.0.1";
const PORT = "6379";

(function init() {
  let server = new MasterServer(HOST, PORT);
  server.startServer();
})();
