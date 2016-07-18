// server.js

// BASE SETUP
// ==========================================================================
// Setup the app using Express
var express = require('express');
var app = express();
var sqlite3 = require('sqlite3').verbose();
var async = require('async');

// Custom app settings
app.disable('x-powered-by');


// CONFIGURATION
// ==========================================================================
var host = process.env.HOST || 'http://localhost';
var port = process.env.PORT || 3000;
var dbFile = 'data/cellar_temps.db';
var defLimit = 1440;
var maxLimit = 10080;
var defOffset = 0;
var defSortOrder = 'ASC';
var defSql = 'SELECT * FROM temps';
var defFieldOrder = 'datetime';
var sqlRecCount = 0;
var sqlTempsCount = 0;
var sqlSensors = 'SELECT DISTINCT sensor_id, sensor_name FROM temps';
var sqlCount = 'SELECT data_id AS count FROM temps';
var sqlPragma = 'PRAGMA table_info(temps)'
var legitFields = [];

// ROUTES
// ==========================================================================
var router = express.Router();

// setup middleware router
app.use(function(req, res, next) {
  // log each request to the consolec
  console.log(req.method, req.url);

  // continue doing what we were doing and go to the route
  next();
});

// route middleware to validate :name
router.param('sensors', function(req, res, next, name) {
  // do validation on name here
  // once validation is done save the new item in the req
  // go to the next thing
  next();
});

// home page route (http://host:port)
app.route('/')
  // default API landing page (GET http://host:port/)
  .get(function(req, res) {
    res.status(200)
      .json({
        message: 'You\'ve reached the home page!'
      });
    });

app.route('/sensors')
  // show available sensors (GET http://host:port/sensors)
  .get(function(req, res) {
    var db = new sqlite3.Database(dbFile);
    var row = '';
    var newsql = sqlSensors;

  	db.all(newsql, function(err, row) {
	    if (err)
  		  res.json(err);

      res.status(200);
    	res.json(row);
  	});
    db.close();
  });

app.route('/sensors/:sensor_id')
  // show specific sensor data (GET http://host:port/sensors/:sensor_id)
  .get(function(req, res) {
  	var db = new sqlite3.Database(dbFile);
    var row = '';
    var newSql = defSql + ' WHERE sensor_id="' + req.params.sensor_id + '" ORDER BY '+defFieldOrder + ' LIMIT ' + defLimit;

  	db.all(newSql, function(err, row) {
	    if (err)
    		res.json(err);

	    res.json(row);
  	});
    db.close();
  });

app.route('/temps')
  // show the sensor data (GET http://host:port/temps)
  .get(function(req, res) {
    // first setup any variables we need for this route
    console.log('== opening db connection ==');
    var db = new sqlite3.Database(dbFile);
    var buildSql = '';
    var buildQuery = [];
    var reqSort = defSortOrder;
    var fieldOrder = defFieldOrder;
    var reqLimit = defLimit;
    var row = '';

    // break the main code into two chunks: 1) query param code; and 2) non-query param code
    // check if there's any ? in the url querystring
    if (!/\?.+/.test(req.url)) {
      // no queryparam found
      var newSql = defSql + ' ORDER BY datetime ' + defSortOrder + ' LIMIT ' + defLimit;
      //console.log("No queryparams");
      console.log("SQL query (default): "+newSql);

      db.all(newSql, function (err, row) {
        res.json(row);
      });

      console.log('== closing db connection ==');

      db.close();
    } else {
      //console.log("1. There's a queryparam!");
      // declare any variables needed for queryparam code
      var legitFields = [];

      async.series([
        // 0. first grab total record count
        function(callback) {
          db.all(sqlCount, function (err, row) {
            sqlRecCount = row.length;
            console.log("0. count: "+sqlRecCount);
            callback();
          });
          //db.close();
        },
        // 1. queryparam of "sort"
        function(callback) {
          if (req.query.sort && req.query.sort.toLowerCase() === 'desc') {
            reqSort = 'DESC';
            console.log("1a. reqSort: "+reqSort);
          }
          callback();
        },
        // 2. queryparam of "limit"
        function(callback) {
          if (req.query.limit && req.query.limit > 0) {
            reqLimit = req.query.limit;

            if (reqLimit > maxLimit) {
              reqLimit = maxLimit;
            }
            console.log("2a. reqLimit: "+reqLimit);
          }
          callback();
        },
        // 3. queryparam of "offset" (for pagination)
        function(callback) {
          if (req.query.offset && req.query.offset > 0) {
            reqOffset = req.query.offset;
            // put some logic here to make sure the page sizes are right
            pages = Math.ceil(sqlRecCount / reqLimit);

            if (reqOffset > pages) {
              console.log("3a. WARNING! reqOffset("+reqOffset+") > pages("+pages+") - setting to max("+pages+")");
              reqOffset = pages;
            }

            console.log("3b. reqOffset: "+reqOffset+"; pages: "+pages);
          }
          callback();
        },
        // 4. queryparam of "fields"
        function(callback) {
          if (req.query.fields) {
            var fieldsArray = req.query.fields.split(",");
            console.log("4a. fields: "+fieldsArray);

            db.all(sqlPragma, function(err, row) {
              // add pragma results to array
              row.forEach(function (pragmaItem) {
                var x = pragmaItem.name;
                legitFields.push(x);
                //console.log("4a. pushing '"+x+"' into array");
              });
              //console.log(legitFields);
              fieldsArray.forEach(function (value) {
                //console.log("4a. value: "+value+"; legitFields: "+legitFields);
                if (legitFields.indexOf(value) > -1) {
                  buildQuery.push(value);
                  //console.log("4a. We have a winner! ["+value+"] is in legitFields");
                } else {
                  //console.log("4a. No match.");
                }
              });
              callback();
            });
          } else {
            buildQuery = ['*'];
            callback();
          }
        },
        // 5. respond to user
        function(callback) {
          buildSql = 'SELECT '+buildQuery.toString()+' FROM temps ORDER BY '+(fieldOrder || defFieldOrder)+' '+(reqSort || defSortOrder)+' LIMIT '+(reqLimit || defLimit);
          console.log("5a. SQL query (custom): "+buildSql);
          // run the sql against the db
          db.all(buildSql, function (err, row) {
            // send the response to the user
            res.json({
              message: row
            });
          });
          console.log('== closing db connection ==');
          db.close();
          callback();
        }
      ]);
    }
  })

app.route('/temps/count')

  .get(function(req, res) {
    var db = new sqlite3.Database(dbFile);

    db.all(sqlCount, function (err, row) {
      sqlTempsCount = row.length;
      console.log("0. count: "+sqlTempsCount);
      res.json({
        count: sqlTempsCount
      })
    });

  })


app.route('/test')
  // this is the test endpoint (GET http://host:port/test)
  .get(function(req, res) {
    res.json({
      message0: 'This is an example message.',
      message1: 'Enter query parameters to return additional example.',
      message2: 'Allowable examples include: sensor_name, temp_c and datetime)',
      querystring_sensorName: req.query.sensor_name,
      querystring_tempC: req.query.temp_c,
      querystring_datetime: req.query.datetime
    });
  })

app.route('*')
  // catch-all route for not_found
  .all(function(req, res, err) {
    res.status(404)
      .json({
        type: 'error',
        status: 404,
        code: 'not_found',
        message: 'Resource Not Found'
      });
  })


// apply the routes to our application
app.use('/', router);


// START THE SERVER
// ==========================================================================
app.listen(port);
console.log('Magic happens at '+host+':'+port+'/ in your browser.');
