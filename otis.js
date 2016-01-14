var http = require('http'),
    fs = require('fs');

var config = {
    sourceBuild: false,
    devMode: false,
    tsdbHost: "localhost",
    tsdbPort: 4242,
    port: 8000
};
var args = process.argv.slice(2);
for (var i=0; i<args.length; i++) {
    switch (args[i]) {
        case '-d':
            config.devMode = true;
            break;
        case '-s':
            config.sourceBuild = true;
            break;
        case '-h':
            config.tsdbHost = args[++i];
            break;
        case '-p':
            config.tsdbPort = args[++i];
            break;
        case '-l':
            config.port = args[++i];
            break;
    }
}

if (config.devMode) {
    config.tsdbPort = config.port;
}

console.log("Config: "+JSON.stringify(config));

var express = require('express');

var app = express();
var router = express.Router();

// todo: m1: need to sort this out
if (config.sourceBuild) {
    app.use(express.static('.'));
}
app.use(express.static('./static-content'));

// fake tsdb
var tsdb = require('./faketsdb');
app.use('/api',tsdb);
app.use('/q',tsdb);


// otis backend
var otis = express.Router();

// middleware specific to this router
otis.use(function timeLog(req, res, next) {
    console.log(new Date(Date.now())+': '+req.originalUrl);
    next();
})
// define the
otis.get('/tags', function(req, res) {
    var requestJson = {"metric": req.query["metric"]};
    var postData = JSON.stringify(requestJson);
    var options = {
        hostname: config.tsdbHost,
        port: config.tsdbPort,
        path: '/api/search/lookup',
        method: 'POST',
        headers: {
            'Content-Type': 'text/json',
            'Content-Length': postData.length
        }
    };

    var clientReq = http.request(options, function(clientRes) {
        clientRes.setEncoding('utf8');
        var data = "";
        clientRes.on('data', function (chunk) {
            data += chunk;
        });
        clientRes.on('end', function() {
            var tagValues = {};

            var tsdbResponse = JSON.parse(data);
            var results = tsdbResponse.results;
            for (var i=0; i<results.length; i++) {
                var ts = results[i];
                for (var tagk in ts.tags) {
                    if (ts.tags.hasOwnProperty(tagk)) {
                        if (!(tagk in tagValues)) {
                            tagValues[tagk] = [];
                        }
                        if (tagValues[tagk].indexOf(ts.tags[tagk]) < 0) {
                            tagValues[tagk].push(ts.tags[tagk]);
                        }
                    }
                }
            }
            if (config.devMode) {
                tagValues["host"] = ["host1","host2","host3"];
                tagValues["user"] = ["jon","dave","joe","simon","fred"];
                tagValues["method"] = ["put","post","get","head","options","delete"];
            }
            res.json(tagValues);
        })
    });

    clientReq.write(postData);
    clientReq.end();

});
otis.get('/config', function(req, res) {
    res.json(config);
});

app.use('/otis',otis);


var server = app.listen(config.port, function() {
    var host = server.address().address
    var port = server.address().port

    console.log('Otis running at http://%s:%s', host, port)
});


