const net = require("net");
const fs = require("fs");
const path = require("path");
const Encoder = require("./Encoder");
const RequestParser = require("./RequestParser");
const HashTable = require("./HashTable");
const RDBParser = require("./RDBParser");
function getUid(socket) {
  return socket.remoteAddress + ":" + socket.remotePort;
}
class MasterServer {
  constructor(host, port, config = null) {
    this.host = host;
    this.port = port;
    this.clientBuffers = {};
    this.dataStore = new HashTable();
    this.masterReplId = "8371b4fb1155b71f4a04d3e1bc3e18c4a990aeeb";
    this.masterReplOffset = 0;
    this.replicas = {};
    this.config = config;
  }
  startServer() {
    this.loadRDBFile();
    const server = net.createServer((socket) => {
      this.clientBuffers[getUid(socket)] = "";
      socket.on(`data`, (data) => {
        this.clientBuffers[getUid(socket)] += data.toString();
        this.processClientBuffer(socket);
      });
      socket.on("error", (err) => {
        console.log(`Socket Error: ${err}`);
        delete this.clientBuffers[getUid(socket)];
      });
      socket.on(`close`, () => {
        console.log(`Disconnecting client: ${getUid(socket)}`);
        delete this.clientBuffers[getUid(socket)];
      });
    });
    server.listen(this.port, this.host, () => {
      console.log(`Server Listening on ${this.host}:${this.port}`);
    });
  }
  loadRDBFile() {
    if (!this.config) return;
    let filePath = path.join(this.config["dir"], this.config["dbfilename"]);
    if (!fs.existsSync(filePath)) return;
    const fileBuffer = fs.readFileSync(filePath);
    let rdbParser = new RDBParser(fileBuffer);
    rdbParser.parse();
    this.dataStore = rdbParser.dataStore;
  }
  processClientBuffer(socket) {
    const clientKey = getUid(socket);
    const buffer = this.clientBuffers[clientKey];
    let requestParser = new RequestParser(buffer);
    while (true) {
      let args = requestParser.parse();
      if (args.length === 0) break;
      let currentRequest = requestParser.currentRequest;
      this.handleCommand(socket, args, currentRequest);
    }
    this.clientBuffers[clientKey] = requestParser.getRemainingRequest();
  }
  handleCommand(socket, args, request) {
    let command = args[0].toLowerCase();
    switch (command) {
      case "ping":
        socket.write(this.handlePing());
        break;
      case "echo":
        socket.write(this.handleEcho(args.slice(1)));
        break;
      case "set":
        socket.write(this.handleSet(args.slice(1)));
        this.propagate(request);
        break;
      case "get":
        socket.write(this.handleGet(args.slice(1)));
        break;
      case "info":
        socket.write(this.handleInfo(args.slice(1)));
        break;
      case "replconf":
        this.handleReplconf(args.slice(1), socket);
        break;
      case "psync":
        socket.write(this.handlePsync(args.slice(1), socket));
        this.replicas[getUid(socket)] = { socket, state: "connected" };
        break;
      case "wait":
        this.handleWait(args.slice(1), socket, request);
        break;
      case "config":
        socket.write(this.handleConfig(args.slice(1)));
        break;
      case "keys":
        socket.write(this.handleKeys(args.slice(1)));
        break;
      case "type":
        socket.write(this.handleType(args.slice(1)));
        break;
      case "xadd":
        this.handleXadd(args.slice(1), socket);
        break;
      case "xrange":
        socket.write(this.handleXrange(args.slice(1)));
        break;
      case "xread":
        this.handleXread(args.slice(1), socket);
        break;
    }
  }
  handlePing() {
    return Encoder.createSimpleString("PONG");
  }
  handleEcho(args) {
    return Encoder.createBulkString(args[0]);
  }
  handleSet(args) {
    let key = args[0];
    let value = args[1];
    if (args.length == 2) {
      this.dataStore.insert(key, value);
    } else {
      let arg = args[2];
      let expiryTime = args[3];
      1;
      this.dataStore.insertWithExpiry(key, value, expiryTime);
    }
    return Encoder.createSimpleString("OK");
  }
  handleGet(args) {
    let key = args[0];
    let value = this.dataStore.get(key);
    if (value === null) {
      return Encoder.createBulkString("", true);
    }
    return Encoder.createBulkString(value);
  }
  handleInfo(args) {
    let section = args[0].toLowerCase();
    let response = "";
    if (section === "replication") {
      response = "role:master\n";
      response += `master_replid:${this.masterReplId}\n`;
      response += `master_repl_offset:${this.masterReplOffset}`;
    }
    return Encoder.createBulkString(response);
  }
  handleReplconf(args, socket) {
    let arg = args[0].toLowerCase();
    if (arg === "ack") {
      this.acknowledgeReplica(parseInt(args[1]));
    } else {
      socket.write(Encoder.createSimpleString("OK"));
    }
  }
  handlePsync(args, socket) {
    socket.write(
      Encoder.createSimpleString(
        `FULLRESYNC ${this.masterReplId} ${this.masterReplOffset}`
      )
    );
    const emptyRDB =
      "524544495330303131fa0972656469732d76657205372e322e30fa0a72656469732d62697473c040fa056374696d65c26d08bc65fa08757365642d6d656dc2b0c41000fa08616f662d62617365c000fff06e3bfec0ff5aa2";
    const buffer = Buffer.from(emptyRDB, "hex");
    const finalBuffer = Buffer.concat([
      Buffer.from(`$${buffer.length}\r\n`),
      buffer,
    ]);
    1;
    return finalBuffer;
  }
  handleConfig(args) {
    let getCommand = args[0];
    let arg = args[1].toLowerCase();
    return Encoder.createArray([
      Encoder.createBulkString(arg),
      Encoder.createBulkString(this.config[arg]),
    ]);
  }
  handleType(args) {
    let key = args[0];
    let type = this.dataStore.getType(key);
    if (type === null) {
      return Encoder.createSimpleString("none");
    } else {
      return Encoder.createSimpleString(type);
    }
  }
  handleXadd(args, socket) {
    let streamKey = args[0];
    let streamEntry = {};
    let streamEntryId = args[1];
    streamEntry["id"] = streamEntryId;
    for (let i = 2; i < args.length; i += 2) {
      let entryKey = args[i];
      let entryValue = args[i + 1];
      streamEntry[entryKey] = entryValue;
    }
    if (streamEntryId === "0-0") {
      socket.write(
        Encoder.createSimpleError(
          "ERR The ID specified in XADD must be greater than 0-0"
        )
      );
      return;
    }
    let entryId = this.dataStore.insertStream(streamKey, streamEntry);
    if (entryId === null) {
      socket.write(
        Encoder.createSimpleError(
          "ERR The ID specified in XADD is equal or smaller than the target stream top item"
        )
      );
      return;
    }
    socket.write(Encoder.createBulkString(entryId));
    this.checkBlock();
  }
  handleXrange(args) {
    let streamKey = args[0];
    let startId = args[1];
    let endId = args[2];
    let entries = this.dataStore.getStreamBetween(streamKey, startId, endId);
    if (entries.length === 0) {
      return Encoder.createBulkString("nil");
    }
    let ret = [];
    for (const entry of entries) {
      let id = entry[0];
      let keyValues = entry[1];
      ret.push(
        Encoder.createArray([
          Encoder.createBulkString(id),
          Encoder.createArray(
            keyValues.map((value) => Encoder.createBulkString(value))
          ),
        ])
      );
    }
    return Encoder.createArray(ret);
  }
  handleXread(args, socket) {
    if (args[0].toLowerCase() !== "block") {
      args = args.slice(1);
      const mid = Math.ceil(args.length / 2);
      let streamKeys = args.slice(0, mid);
      let startIds = args.slice(mid);
      let entries = this.dataStore.getStreamAfter(streamKeys, startIds);
      let response = this.getXreadResponse(entries);
      socket.write(response);
      return;
    }
    let timeoutTime = Number.parseInt(args[1]);
    args = args.slice(3);
    const mid = Math.ceil(args.length / 2);
    let streamKeys = args.slice(0, mid);
    let startIds = args.slice(mid);
    startIds = this.processStartIds(streamKeys, startIds);
    this.block = { streamKeys, startIds, isDone: false };
    this.block.socket = socket;
    this.block.timeout = -1;
    if (timeoutTime != 0) {
      this.block.timeout = setTimeout(() => {
        let entries = this.dataStore.getStreamAfter(
          this.block.streamKeys,
          this.block.startIds
        );
        let response = this.getXreadResponse(entries);
        this.block.socket.write(response);
        this.block.isDone = true;
      }, timeoutTime);
    }
    this.checkBlock();
  }
  processStartIds(streamKeys, startIds) {
    for (let i = 0; i < streamKeys.length; i++) {
      let key = streamKeys[i];
      let startId = startIds[i];
      if (startId !== "$") continue;
      let entries = this.dataStore.get(key);
      if (entries === null || entries.length === 0) startId = "0-0";
      let lastEntryId = entries.slice(-1)[0].id;
      let lastEntryIdMS = lastEntryId.split("-")[0];
      let lastEntryIdSeq = lastEntryId.split("-")[1];
      startId = lastEntryIdMS + "-" + `${Number.parseInt(lastEntryIdSeq)}`;
      startIds[i] = startId;
    }
    return startIds;
  }
  checkBlock() {
    if (!this.block || this.block.isDone) return;
    let entries = this.dataStore.getStreamAfter(
      this.block.streamKeys,
      this.block.startIds
    );
    if (entries.length === 0) return;
    let response = this.getXreadResponse(entries);
    this.block.socket.write(response);
    this.block.isDone = true;
    if (this.block.timeout != -1) {
      clearTimeout(this.block.timeout);
    }
  }
  getXreadResponse(entries) {
    if (entries.length === 0) {
      return Encoder.createBulkString("nil", true);
    }
    let ret = [];
    for (const keyEntries of entries) {
      let key = keyEntries[0];
      let arr = [Encoder.createBulkString(key)];
      let entriesForKey = [];
      for (const entries of keyEntries[1]) {
        let id = entries[0];
        let keyValues = entries[1];
        entriesForKey.push(
          Encoder.createArray([
            Encoder.createBulkString(id),
            Encoder.createArray(
              keyValues.map((value) => Encoder.createBulkString(value))
            ),
          ])
        );
      }
      arr.push(Encoder.createArray(entriesForKey));
      ret.push(Encoder.createArray(arr));
    }
    let response = Encoder.createArray(ret);
    return response;
  }
  propagate(request) {
    for (const replica of Object.values(this.replicas)) {
      const socket = replica.socket;
      socket.write(request);
    }
    this.masterReplOffset += request.length;
  }
  handleWait(args, socket, request) {
    if (Object.keys(this.replicas).length === 0) {
      socket.write(Encoder.createInteger(0));
      return;
    }
    if (this.masterReplOffset === 0) {
      socket.write(Encoder.createInteger(Object.keys(this.replicas).length));
      return;
    }
    let numOfReqReplicas = args[0];
    let timeoutTime = args[1];
    // Register a wait
    this.wait = {};
    this.wait.numOfAckReplicas = 0;
    this.wait.numOfReqReplicas = numOfReqReplicas;
    this.wait.socket = socket;
    this.wait.isDone = false;
    this.wait.request = request;
    this.wait.timeout = setTimeout(() => {
      this.respondToWait();
    }, timeoutTime);

    for (const replica of Object.values(this.replicas)) {
      const socket = replica.socket;
      socket.write(
        Encoder.createArray([
          Encoder.createBulkString("REPLCONF"),
          Encoder.createBulkString("GETACK"),
          Encoder.createBulkString("*"),
        ])
      );
    }
  }
  handleKeys(args) {
    if (args[0] === "*") {
      let arr = this.dataStore.getAllKeys().map((value) => {
        return Encoder.createBulkString(value);
      });
      return Encoder.createArray(arr);
    }
    return Encoder.createBulkString("", true);
  }

  respondToWait() {
    clearTimeout(this.wait.timeout);
    this.masterReplOffset += this.wait.request.length;
    this.wait.socket.write(Encoder.createInteger(this.wait.numOfAckReplicas));
    this.wait.isDone = true;
  }
  acknowledgeReplica(replicaOffset) {
    if (this.wait.isDone) return;
    if (replicaOffset >= this.masterReplOffset) {
      this.wait.numOfAckReplicas++;
      if (this.wait.numOfAckReplicas >= this.wait.numOfReqReplicas)
        this.respondToWait();
    }
  }
}
module.exports = MasterServer;
//
