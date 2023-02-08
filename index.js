const express = require('express');
const req = require('express/lib/request');
const hbs = require('hbs');
const { ObjectId } = require('mongodb');
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
const DB = "tutoring_recipes";
const COLLECTION="recipes";



async function main() {

    const client = await mongo.connect(mongoURI,{
        useUnifiedTopology: true
    })

    const db = client.db(DB);

    async function findRecipeByID(recipeId){
        const recipe = await db.collection(COLLECTION).findOne({
            _id: ObjectId(recipeId)
        });
        return recipe;
    }

    // app.get('/process_fruits', function(req,res){
    //     console.log(req.query);
    //     res.send("route called")
    // })

    app.get("/", function(req,res){
        res.send("<h1>Hello HTML</h1>");
    })
    
    app.get('/search-recipes', async function(req, res){

        // start with an empty critera object
        let criteria = {};

        // for a form submitted via get
        // retrieve its keys using req.query
        if (req.query.title) {
            criteria["title"] = {
                "$regex": req.query.title,
                "$options":"i"
            }
        }

        if (req.query.ingredients) {
            criteria["ingredients"] = {
                "$in": [req.query.ingredients]
            }
        }
            
        const results = await db.collection(COLLECTION).find(criteria).toArray();
        res.render('list-recipes',{
            "results": results,
            "title": req.query.title,
            "ingredients": req.query.ingredients
        })
    })

    app.get('/add-recipe', function(req,res){
        res.render('add-recipe');
    })

    app.post('/add-recipe', async function(req,res){
        const results = await db.collection(COLLECTION).insertOne({
            "title": req.body.title,
            "ingredients": req.body.ingredients.split(",")
        })
        
        res.redirect("/search-recipes");
    })

    app.get('/edit-recipe/:recipe_id',async function(req,res){
        const recipe = await findRecipeByID(req.params.recipe_id);
        res.render('update-recipe',{
            "recipe": recipe
        })
    });

    app.post('/edit-recipe/:recipe_id', async function(req, res){
        await db.collection(COLLECTION).updateOne({
            _id:ObjectId(req.params.recipe_id)
        },{
            "$set":{
                "title": req.body.title,
                "ingredients": req.body.ingredients.split(",")
            }
        })
        res.redirect("/search-recipes")
    })

    app.get('/delete-recipe/:recipe_id', async function(req,res){
        const recipe = await findRecipeByID(req.params.recipe_id);
        res.render('delete-recipe', {
            "recipe": recipe
        })
    });

    app.post('/delete-recipe/:recipe_id', async function(req,res){
        await db.collection(COLLECTION).deleteOne({
            _id: ObjectId(req.params.recipe_id)          
        });
        res.redirect('/search-recipes');
    })
}

main();

app.listen(3000, function(){
    console.log("Server has started");
})