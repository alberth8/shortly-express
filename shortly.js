var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
// var cookieParser = require('cookie-parser');
var session = require('express-session');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
// app.use(cookieParser());
app.use(session({secret: 'awesomebullets'}));


app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.get('/logout', function (req, res) {
  req.session.destroy(function() {
    res.redirect('/login');
  });
});

app.get('/', 
function(req, res) {
  // console.log("COOKIES:", req.cookies);
  console.log('SESSION:', req.session);

  if (req.session.userId) {
    res.render('index');
    // show your saved files
  } else {
    res.redirect('/login');
  }

});

app.get('/create', 
function(req, res) {
  if (req.session.userId) {
    res.render('index'); 
    // show your saved files
  } else {
    res.redirect('/login');
  }
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    if (req.session.userId) {
      res.status(200).send(links.models); // only send current users link !
    } else { 
      res.redirect('/login');
    }
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.sendStatus(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.status(200).send(found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.sendStatus(404);
        }

        Links.create({
          url: uri,
          title: title,
          baseUrl: req.headers.origin
        })
        .then(function(newLink) {
          res.status(200).send(newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/signup', 
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  // Checks if user exists, then...
  new User({username: username}).fetch().then(function(found) {
    // if found...
    if (found) {
      res.status(200).send(found.attributes);
    } else { // else need to create...

      Users.create({
        username: username,
        password: password,
      })
      .then(function() {

        res.redirect('/');
        res.end();
      });
    }
  });
});

app.get('/login', 
function(req, res) {
  res.render('login');
});

/// test
app.get('/test', 
function(req, res) {
  console.log('CURRENT SESSION: ', req.session);
  res.end();
});

app.post('/login', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  var authenticate = function (password, storedUser) {
    // if entered password is same as what's in the server
    if (password === storedUser.attributes.password) {
      return true;
    } else {
      return false;
    }
  };




  // Checks if user exists, then...
  new User({username: username}).fetch().then(function(found) {
    // if found...
    if (found && authenticate(password, found)) {
      req.session.userId = found.attributes.id;
      console.log('Updated?', req.session);
      res.redirect('/');
    } else { // else need to create...
      console.log('failed');
      res.redirect('/login');
      // if link is /create -> /login
      res.end();
    }
  });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        linkId: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits') + 1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
