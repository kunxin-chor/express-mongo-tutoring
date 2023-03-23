const express = require('express');
const hbs = require('hbs');
const { ObjectId } = require('mongodb');
const wax = require('wax-on');
const mongo = require('mongodb').MongoClient;

// for sessions
const session = require('express-session');
// create a file store to save the sessions
const FileStore = require('session-file-store')(session);

// read in the .env file
require('dotenv').config();

const app = express();
app.set('view engine', 'hbs');

// setup the sessions
app.use(session({
    "store": new FileStore(),
    "secret": "your_secret_key",
    "resave": false,
    "saveUninitialized": true,
    "cookie": {
        "maxAge": 864000000
    }
}))

require('handlebars-helpers')(
    {
        "handlebars": hbs.handlebars
    }
)


wax.on(hbs.handlebars);
wax.setLayoutPath("./views/layouts");

// MIDDLEWARES are functions that are executed before
// route functions

// enable form proccessing
app.use(express.urlencoded({
    'extended': true
}))

function checkIfAuthenticated(req, res, next) {
    // the next parameter is the next function to call
    //(it could be another middleware or the route function)
    if (req.session.userId) {
        // move on to the next middleware or route function
        // if this is the last middleware
        next();
    } else {
        res.redirect("/login");
    }
}

// the process object is always available
// to all NodeJS application
const mongoURI = process.env.MONGO_URI;
const DB = "tutoring_recipes";
const COLLECTION = "recipes";
const USERS = "users";

// write our own custom helpers
hbs.handlebars.registerHelper("ifEquals", function (arg1, arg2, options) {
    if (arg1 == arg2) {
        return options.fn(this);
    } else {
        return options.inverse(this);
    }
})


async function main() {

    const client = await mongo.connect(mongoURI, {
        useUnifiedTopology: true
    })

    const db = client.db(DB);

    async function findRecipeByID(recipeId) {
        const recipe = await db.collection(COLLECTION).findOne({
            _id: ObjectId(recipeId)
        });
        return recipe;
    }

    app.get("/", function (req, res) {
        res.send("<h1>Hello HTML</h1>");
    })

    app.get('/search-recipes', async function (req, res) {

        // start with an empty critera object
        let criteria = {};

        // for a form submitted via get
        // retrieve its keys using req.query
        if (req.query.title) {
            criteria["title"] = {
                "$regex": req.query.title,
                "$options": "i"
            }
        }

        if (req.query.ingredients) {
            criteria["ingredients"] = {
                "$in": [req.query.ingredients]
            }
        }

        const results = await db.collection(COLLECTION).find(criteria).toArray();
        res.render('list-recipes', {
            "results": results,
            "title": req.query.title,
            "ingredients": req.query.ingredients
        })
    })

    app.get('/add-recipe',  [checkIfAuthenticated], function (req, res) {
        res.render('add-recipe', {
            "oldValues": {
                "cuisine": "chinese",
                "selectedTags": []
            }
        });
    })

    // the validation rules are:
    // - title: must be not empty (at least 1 character)
    // - ingredients: at least three ingredient
    app.post('/add-recipe',  [checkIfAuthenticated], async function (req, res) {



        const errors = [];  // the array is store all the possible error messages

        if (!req.body.cuisine) {
            errors.push("Please select a cuisine type");
        }

        if (!req.body.title) {
            errors.push("Please provide the title of the recipe");
        }

        const ingredients = req.body.ingredients.split(",");

        if (ingredients.length < 3) {
            errors.push("Please provide at least three ingredients");
        }

        // if no tags selected -> empty array
        // if one tag selected -> an array with one string
        // if two or more tags selected -> an array with the strings
        let selectedTags = req.body.tags ? (Array.isArray(req.body.tags) ? req.body.tags : [req.body.tags]) : [];

        // if no errors detected
        if (errors.length == 0) {
            const results = await db.collection(COLLECTION).insertOne({
                "title": req.body.title,
                "ingredients": req.body.ingredients.split(","),
                "cuisine": req.body.cuisine,
                "selectedTags": selectedTags,
                "author": ObjectId(req.session.userId)

            })

            res.redirect("/search-recipes");
        } else {


            // if there is error
            res.status(400);
            res.render("add-recipe", {
                "errors": errors,
                "oldValues": { ...req.body, "selectedTags": selectedTags }
            })
        }


    })

    app.get('/edit-recipe/:recipe_id', async function (req, res) {
        const recipe = await findRecipeByID(req.params.recipe_id);
        const selectedTags = recipe.selectedTags || [];
        const merged = { ...recipe, "selectedTags": selectedTags };
        console.log(merged);
        res.render('recipe-form', {
            "oldValues": merged
        })
    });

    app.post('/edit-recipe/:recipe_id', async function (req, res) {
        await db.collection(COLLECTION).updateOne({
            _id: ObjectId(req.params.recipe_id)
        }, {
            "$set": {
                "title": req.body.title,
                "ingredients": req.body.ingredients.split(",")
            }
        })
        res.redirect("/search-recipes")
    })

    app.get('/delete-recipe/:recipe_id', async function (req, res) {
        const recipe = await findRecipeByID(req.params.recipe_id);
        res.render('delete-recipe', {
            "recipe": recipe
        })
    });

    app.post('/delete-recipe/:recipe_id', async function (req, res) {
        await db.collection(COLLECTION).deleteOne({
            _id: ObjectId(req.params.recipe_id)
        });
        res.redirect('/search-recipes');
    })

    // RECIPES MANAGEMENT ROUTES BEGIN HERE

    // this is to display all the reviews of a recipe
    app.get("/recipes/:recipe_id/reviews", async function (req, res) {
        const recipe = await findRecipeByID(req.params.recipe_id);
        res.render('reviews', {
            'recipe_id': req.params.recipe_id,
            'recipe': recipe
        })
    })

    app.get("/recipes/:recipe_id/reviews/add",function (req, res) {
        res.render("add-review")
    })

    app.post("/recipes/:recipe_id/reviews/add", async function (req, res) {
        const result = await db.collection(COLLECTION)
            .updateOne({
                "_id": ObjectId(req.params.recipe_id)
            }, {
                "$push": {
                    "reviews": {
                        "_id": ObjectId(),
                        "email": req.body.email,
                        "review": req.body.review
                    }
                }
            })
        res.redirect(`/recipes/${req.params.recipe_id}/reviews`);
    });

    // display the form to edit one review
    app.get('/recipes/:recipe_id/reviews/:review_id', async function (req, res) {
        const data = await db.collection(COLLECTION)
            .findOne({
                "_id": ObjectId(req.params.recipe_id),
                "reviews._id": ObjectId(req.params.review_id)
            }, {
                "projection": {
                    // the $ refers to the index of the review
                    // that matches the `reviews._id` criteria
                    "reviews.$": 1
                }
            })
        const reviewToEdit = data.reviews[0];
        res.render('edit-review', {
            'review': reviewToEdit
        })
    })

    app.post('/recipes/:recipe_id/reviews/:review_id', async function (req, res) {
        await db.collection(COLLECTION)
            .updateOne({
                "_id": ObjectId(req.params.recipe_id),
                "reviews._id": ObjectId(req.params.review_id)
            }, {
                "$set": {
                    "reviews.$": {
                        "email": req.body.email,
                        "review": req.body.review
                    }
                }
            });
        res.redirect(`/recipes/${req.params.recipe_id}/reviews`);
    });

    app.get('/recipes/:recipe_id/reviews/:review_id/delete', async function (req, res) {
        await db.collection(COLLECTION)
            .updateOne({
                "_id": ObjectId(req.params.recipe_id),
                "reviews._id": ObjectId(req.params.review_id)
            }, {
                "$pull": {
                    "reviews": {
                        "_id": ObjectId(req.params.review_id)
                    }
                }
            })

        res.redirect(`/recipes/${req.params.recipe_id}/reviews`);
    });

    // Display a form to create a new user
    app.get('/users/create', function (req, res) {
        res.render('register');
    })

    app.post('/users/create', async function (req, res) {
        await db.collection(USERS)
            .insertOne({
                email: req.body.email,
                password: req.body.password
            })
        res.send("Your account has been created!");
    })

    app.get("/login", function (req, res) {
        res.render("login")
    })

    app.post("/login", async function (req, res) {
        // try to get the password and user
        const user = await db.collection(USERS)
            .findOne({
                "email": req.body.email
            });
        if (user.password === req.body.password) {
            // remember the user's id and email
            req.session.userId = user._id;
            req.session.email = user.email;
            res.send("Login successful!");
        } else {
            res.send("Login failed!");
        }

    });

    app.get("/logout", function (req, res) {
        res.render("logout")
    })

    app.post("/logout", async function (req, res) {
        req.session.userId = null;
        req.session.email = null;
        res.redirect("/login")
    })

    // use the checkIfAuthenticated middleware
    // to see if the user has logged in
    app.get("/profile", [checkIfAuthenticated], async function (req, res) {

        const user = await db.collection(USERS)
            .findOne({
                _id: ObjectId(req.session.userId)
            })
        res.render('profile', {
            "user": user
        })



    })
}

main();

app.listen(3001, function () {
    console.log("Server has started");
})