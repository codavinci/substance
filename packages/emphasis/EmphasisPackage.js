'use strict';

var Emphasis = require('./Emphasis');
var EmphasisTool = require('./EmphasisTool');
var EmphasisCommand = require('./EmphasisCommand');

module.exports = {
  name: 'emphasis',
  configure: function(config, options) {
    config.addNode(Emphasis);
    config.addCommand(EmphasisCommand);
    config.addTool(EmphasisTool);
  }
};

