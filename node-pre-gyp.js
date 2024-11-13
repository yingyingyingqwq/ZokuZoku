// Fake @mapbox/node-pre-gyp module for pymport
const os = require("os");
const path = require("path");

exports.find = function() {
    return path.join(os.homedir(), ".zokuzoku", "pymport", "pymport.node");
};