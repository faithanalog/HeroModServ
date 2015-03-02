var express = require('express');

var app = express();
app.get('/testValid', function(req, res) {
    res.send("yes");
});
app.listen(4071);
