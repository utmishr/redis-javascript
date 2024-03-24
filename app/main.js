const MasterServer = require("./MasterServer");
const SlaveServer = require("./SlaveServer");
const HOST = "127.0.0.1";
const PORT = "6379";

(function init(args) {
  console.log(args);
  if (args.length === 0) {
    let server = new MasterServer(HOST, PORT);
    server.startServer();
  } else if (args.length === 2) {
    let portFlag = args[0];
    let port = args[1];
    let server = new MasterServer(HOST, port);
    server.startServer();
  } else if (args.length === 5) {
    let portFlag = args[0];
    let port = args[1];
    let replicaFlag = args[2];
    let masterHost = args[3];
    let masterPort = args[4];
    let server = new SlaveServer(HOST, port, masterHost, masterPort);
    server.startServer();
  }
})(process.argv.slice(2));
