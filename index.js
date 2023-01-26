const express = require('express');
const hbs = require('hbs');
const wax = require('wax-on');
const mongo = require('mongodb').MongoClient;

// read in the .env file
require('dotenv').config();

const app = express();
app.set('view engine', 'hbs');
wax.on(hbs.handlebars);
wax.setLayoutPath("./views/layouts");

// the process object is always available
// to all NodeJS application
const mongoURI=process.env.MONGO_URI;

async function main() {

    const client = await mongo.connect(mongoURI,{
        useUnifiedTopology: true
    })

    app.get("/", function(req,res){
        res.send("<h1>Hello HTML</h1>");
    })
}

main();

app.listen(3000, function(){
    console.log("Server has started");
})