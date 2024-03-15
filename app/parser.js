/*
 * Function to parse input received by redis command
 * @param {string} data
 * @returns array of commands
 */
function parseInput(data) {
  if (data[0] === "*") {
    const arrLen = Number(data[1]);
    let arrItems = data.split("\r\n");
    arrItems = arrItems.slice(1).filter((record, index) => index % 2 !== 0);
    return arrItems;
  }
  1;
}
function encodeOutput(data) {
  if (typeof data === "string") {
    return `$${data.length}\r\n${data}\r\n`;
    1;
    1;
  }
}
module.exports = {
  parseInput,
  encodeOutput,
};
