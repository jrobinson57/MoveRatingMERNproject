const express = require('express')
const mongoose = require('mongoose')
const cors = require('cors')
const MovieModel = require('./models/Movies')
const RegisterUserModel = require('./models/Register')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const cookieParser = require('cookie-parser')


//mongo
const username = encodeURIComponent("robins57");
const password = encodeURIComponent("Bruh5");
const cluster = "fullstackproject";
const appName = "FullStackProject"

let uri = `mongodb+srv://${username}:${password}@${cluster}.nhzv5ms.mongodb.net/?retryWrites=true&w=majority&appName=${appName}`;

const app = express()
//only allowing GET, POST, PUT, and DELETE methods from http://localhost:5173
app.use(cors({
  origin: ["http://localhost:5173"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))
app.use(cookieParser())
app.use(express.json())

// Connecting to the Mongo DB
mongoose.connect(uri, {
  })
  .then(() => {
    console.log('Connected to MongoDB');
  })
  .catch((error) => {
    console.error('Error connecting to MongoDB:', error);
  });


  // Authentication middleware, if token is valid then the request can proceed, otherwise returns an error
  const verifyUser = (req, res, next) => {
    const token = req.cookies.token;
    console.log(token);
    if (!token) {
        return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    jwt.verify(token, "jwt-secret-key", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: "Unauthorized: Invalid token" });
        }
        req.user = decoded;
        console.log(decoded);
        next();
    });
};

  // Protected route, can only load database entries and crud abilities if user is verified
  app.get('/', verifyUser, async (req, res) => {
    const userId = req.user.id;
    console.log(userId);

    try {
        // Find movies associated with the authenticated user
        const user = await RegisterUserModel.findById(userId).populate('Movies');

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(user.Movies); // Return the user's movies
    } catch (error) {
        res.status(500).json({ error: "Error fetching user's movies" });
    }
});

app.get('/getMovie/:id', (req, res) => {
    const id = req.params.id;
    MovieModel.findById({_id:id})
    .then(movies => res.json(movies))
    .catch(err => res.json(err))
})

app.put('/updateMovie/:id', (req, res) => {
    console.log("Recieved PUT request to /updateMovie")
    const id = req.params.id;
    MovieModel.findByIdAndUpdate({_id: id}, {
        title: req.body.title, 
        genre: req.body.genre, 
        rating: req.body.rating})
    .then(movies => res.json(movies))
    .catch(err => res.json(err))
})

app.delete('/deleteMovie/:id', (req, res) => {
    console.log("Recieved delete request to /deleteMovie")
    const id = req.params.id;
    MovieModel.findByIdAndDelete({_id: id})
    .then(res => res.json(res))
    .catch(err => res.json(err))
})

app.post("/createMovie", verifyUser, (req, res) => {
  console.log("Received POST request to /createMovie");
  const { title, genre, rating } = req.body;
  const userId = req.user.id; // Access userId from req.user object
  console.log(userId);

  // Create the movie document
  MovieModel.create({ title, genre, rating })
      .then(movie => {
          // Add the movie reference to the user's Movies array
          RegisterUserModel.findByIdAndUpdate(userId, { $push: { Movies: movie._id } })
              .then(() => res.json(movie))
              .catch(err => res.status(500).json({ error: "Error updating user's Movies array" }));
      })
      .catch(err => res.status(500).json({ error: "Error creating movie" }));
});


  /**
 * POST endpoint to register a new user.
 * 
 * param {Object} req - The request object containing user data.
 * param {Object} res - The response object used to send back the response.
 */
  app.post("/register", (req, res) => {
    console.log("Received POST request to /register");
    const { name, email, password } = req.body;
  
    // Hashing the password
    bcrypt.hash(password, 10)
      .then(hashedPassword => {
        RegisterUserModel.findOne({ email: email })
          .then(user => {
            if (user) {
              res.json("User already has an account with that email");
            } else {
              RegisterUserModel.create({
                name: name,
                email: email,
                password: hashedPassword  // Storing hashed password
              })
                .then(result => res.json("Account Created"))
                .catch(err => res.json("Error while creating user" + err));
            }
          })
          .catch(err => res.json(err));
      })
      .catch(err => res.json(err));
  });
  

  /**
 * POST endpoint for user login.
 * 
 * param {Object} req - The request object containing user credentials.
 * pparam {Object} res - The response object used to send back the response.
 */
  app.post("/login", (req, res) => {
    console.log("Recieved POST request to /login")
    const {email, password} = req.body;
    RegisterUserModel.findOne({email: email})
    .then(user => {
      if(user) {
          bcrypt.compare(password, user.password, (err, response) => {
            if(response) {
              const token = jwt.sign({email: user.email, id: user._id}, "jwt-secret-key", {expiresIn:"1d"})
              //Sets token in cookie
              res.cookie("token", token);
              // Sends success message along with token
              res.json({ message: "Successful login.", token: token });
            } else {
              res.json("The password is incorrect")
            }
          })
      } else {
        // if no user found in DB collection
        res.json("No record exists for this email/pass combo");
      }
    }) .catch(err => res.json(err))
  })

  // Endpoint for fetching username
  app.get("/userInfo", verifyUser, async (req, res) => {
    const userId = req.user.id; // Extract user ID from the token
  
    try {
      const user = await RegisterUserModel.findById(userId, "name"); // Fetch only the name field
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
  
      res.json({ name: user.name }); // Return the user's name
    } catch (error) {
      res.status(500).json({ error: "Error fetching user information" });
    }
  });


// Starting the server
app.listen(3001, () => {
    console.log("Server is running")
})