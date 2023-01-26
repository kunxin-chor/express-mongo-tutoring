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

// enable form proccessing
app.use(express.urlencoded({
    'extended': true
}))

// the process object is always available
// to all NodeJS application
const mongoURI=process.env.MONGO_URI;

async function main() {

    const client = await mongo.connect(mongoURI,{
        useUnifiedTopology: true
    })

    const db = client.db("tutoring_recipes");

    app.get("/", function(req,res){
        res.send("<h1>Hello HTML</h1>");
    })

    app.get('/add-recipe', function(req,res){
        res.render('add-recipe');
    })

    app.post('/add-recipe', async function(req,res){
        const results = await db.collection("recipes").insertOne({
            "title": req.body.title,
            "ingredients": req.body.ingredients.split(",")
        })
        console.log(results);
        res.send("New recipe has been added");
    })
}

main();

app.listen(3000, function(){
    console.log("Server has started");
})