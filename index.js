 if (process.env.NODE_ENV !== 'production') {
     require('dotenv').config()
 }
 /**
 * Required External Modules
 */

const express = require('express');
const path = require('path');
var mysql = require('mysql');   
const omdbapi = new (require('omdbapi'))('12687fb7'); 
const bcrypt = require('bcryptjs');
const passport = require('passport')
const initializePassport = require('./passport-config')
const flash = require('express-flash');
const session = require('express-session')
const methodOverride = require('method-override')

initializePassport(
    passport, 
    getUserByEmail,
    getUserById
)

function getUserByEmail(email) {
    return new Promise(function(resolve, reject) {
        connection.query("SELECT DISTINCT * FROM `user-data` WHERE `email`=?",email, function(error, rows, fields) {  
            resolve(rows[0]);
        }, function() {
            reject([]);
        }
        )
    })
}
function getUserById(id) {
    return new Promise(function(resolve, reject) {
        connection.query("SELECT DISTINCT * FROM `user-data` WHERE `id`=?",id, function(error, rows, fields) {  
            resolve(rows[0]);
        }, function() {
            reject([]);
        }
        )
    })
} 

/**
 * App Variables
 */

 const app = express();
 const port = process.env.PORT || "8000";
 

/**
 *  App and db Configuration
 */

var connection = mysql.createConnection({
    // properties
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'watchlistuserdata',
        multipleStatements: true
})

connection.connect(function(error) {
    if (error) {
        console.log('error connecting to db');
    } else {
        console.log('connected to db');
    }
})

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.use(express.static(path.join(__dirname, "public")));
app.use(express.urlencoded({extended: false}));
app.use(express.json())  
app.use(flash())
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false
}))
app.use(passport.initialize())
app.use(passport.session())
app.use(methodOverride('_method'))

/**
 * Routes Definitions
 */

app.get("/", checkNotAuthenticated, (req,res) => { //sign in page
    res.render("index",{title:"Welcome"});
});

app.get("/signup" ,checkNotAuthenticated, (req,res) => { //sign up page
    res.render("signup",{title:"Sign Up"});
}); 

app.post("/login", checkNotAuthenticated, passport.authenticate('local',{failureRedirect: '/'}), function(req,res) { 
    var id = req.user.id;  
    res.redirect('/users?valid='+id)
})

app.post("/register", checkNotAuthenticated, async (req,res) => {
    try {
        const hashedPassword = await bcrypt.hash(req.body.password, 10)
        var name = req.body.name
        var email = req.body.email
        var password = hashedPassword 
        var sql = "INSERT INTO `user-data` (`id`, `Name`, `email`, `password`, `imdbid`) VALUES (NULL, ?, ?, ?, '');";
        var values = [name, email, password]
        //"INSERT INTO `user-data` (`id`, `Name`, `email`, `password`, `imdbid`) VALUES (NULL, 'nani', 'nani', 'nani', 'nani');"
        console.log(name);
        connection.query(sql, values, function(error, rows, fields) {
            console.log(rows);
            res.redirect('/')
        }) 
        
    } catch (e) {  
        console.log(e);
        res.redirect('/signup')
    } 
})

app.get("/users", checkAuthenticated, (req,res) => {
    connection.query("SELECT Name, imdbid, id FROM `user-data` ", function(error, rows, fields) {
        if (error) {
            res.send(error);
        } else {        
            req.user.then((resp) => {
                id = resp.id;
                res.render("users", {data: rows, title:"Home", id: id}); 
            })
        } 
    })
}) 

app.get("/remove-from-list", (req,res) => { 
    var id = 0;
    var imdbidToRemove = 0
    req.user.then((resp)=> {
        imdbidToRemove = req.query.valid + ","; 
        id = resp.id;
        var query = "UPDATE `user-data` SET imdbid = REPLACE(imdbid, ?, '') WHERE `user-data`.`id` = ?;"  
        connection.query(query, [imdbidToRemove,id], function(error, rows, fields) {  
            connection.query("SELECT Name, imdbid FROM `user-data` ", function(error, rows1, fields) { 
                if (error) {
                    res.send(error);
                } else {     
                    res.redirect('/users?valid='+id);  
                }
            })
        }) 
    });
    
})

app.post("/add-to-list", (req,res) => {
    var id;
    req.user.then((res)=> {id = res.id;});
    if (req.body.addToList.trim()=='') { 
        res.redirect('/users')
    } else {
        var title = req.body.addToList;  
        omdbapi.get({ 
            title: title // optionnal (requires imdbid or title) 
        }).then(resp => { 
            connection.query("SELECT imdbid FROM `user-data` WHERE `id`=? ", id, function(error, rows, fields) {
                var i = 0;
                var repeat = new Boolean(false);
                var ids = rows[0].imdbid.split(",");
                for (i = 0; i < ids.length; ++i) {
                    if (ids[i].trim()==resp.imdbid) {
                        repeat = new Boolean(true);
                    }
                }  
                if (repeat==true) { 
                    res.redirect('/users');
                } else { 
                    var input = ""+resp.imdbid+",";
                    var query = "UPDATE `user-data` SET imdbid = CONCAT(?,imdbid) WHERE `user-data`.`id` = ?;"  // needs to be changed to specific for logged in user
                    connection.query(query, [input,id], function(error, rows, fields) { 
                        connection.query("SELECT Name, imdbid FROM `user-data` ", function(error, rows, fields) {
                            if (error) {
                                res.send(error);
                            } else {     
                                res.redirect('/users?valid='+id); 
                            }
                        });
                    })
                }
            })
    }) 
    }
})

app.delete('/logout', (req, res)=> {
    req.logOut()
    res.redirect('/')
})

function checkAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return next()
    }

    res.redirect('/')
}

function checkNotAuthenticated(req, res, next) {
    if (req.isAuthenticated()) {
        return res.redirect('/users');
    }
    next();
}
/**
 * Server Activation
 */
app.listen(port, () => {
    console.log('Listening to requests on http://localhost:${port}')
});