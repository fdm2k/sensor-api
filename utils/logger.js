var winston = require('winston');
var path = require('path');
var fs = require('fs');

const logPath = process.env.LOG_PATH || '../logs/';
const logFile = process.env.LOG_FILENAME || 'access';

Date.prototype.yyyymmdd = function() {
   var yyyy = this.getFullYear().toString();
   var mm = (this.getMonth()+1).toString(); // getMonth() is zero-based
   var dd  = this.getDate().toString();
   return yyyy + (mm[1]?mm:"0"+mm[0]) + (dd[1]?dd:"0"+dd[0]); // padding
  };
d = new Date();

var logDir = path.join(__dirname, logPath);
var logDirFile = path.join(logDir + logFile + '-' + d.yyyymmdd() + '.log');

if (!fs.existsSync(logDir)){
    fs.mkdirSync(logDir);
}

winston.emitErrs = true;

var logger = new winston.Logger({
    transports: [
        new winston.transports.File({
            level: process.env.LOG_LEVEL,
            filename: logDirFile,
            handleExceptions: true,
            json: true,
            maxsize: 10485760, //10MB
            maxFiles: 30,
            colorize: false
        }),
        new winston.transports.Console({
            level: process.env.LOG_LEVEL,
            handleExceptions: true,
            json: false,
            colorize: true
        })
    ],
    exitOnError: false
});


module.exports = logger;
module.exports.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};
